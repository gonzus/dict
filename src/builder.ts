import * as SQLite from 'better-sqlite3';
import Debug from 'debug';
const log = Debug('builder');

interface Column {
  type: string;
  nullable?: boolean;
  values?: Array<string>;
  default?: string;
  name?: string;
}

interface TableColumns {
  [name: string]: Column;
}

interface Reference {
  table: string;
  columns: Array<string>;
}

interface Key {
  columns: Array<string>;
  reference?: Reference;
}

interface TableKeys {
  primary: Key;
  unique?: Array<Key>;
  foreign?: Array<Key>;
}

interface Table {
  columns: TableColumns;
  keys: TableKeys;
}

interface Schema {
  [name: string]: Table;
}

export class Builder {
  constructor(private sql: SQLite.Database) {
  }

  public maybeCreateSchema() {
    const schema: Schema = {
      languages: {
        columns: {
          id  : { type: 'INTEGER' },
          name: { type: 'TEXT'    },
        },
        keys: {
          primary: { columns: ['id'] },
          unique: [
            { columns: ['name'] }
          ],
        },
      },
      parts: {
        columns: {
          id  : { type: 'INTEGER' },
          name: { type: 'TEXT'    },
        },
        keys: {
          primary: { columns: ['id'] },
          unique: [
            { columns: ['name'] }
          ],
        },
      },
      words: {
        columns: {
          id         : { type: 'INTEGER' },
          name       : { type: 'TEXT'    },
          language_id: { type: 'INTEGER' },
        },
        keys: {
          primary: { columns: ['id'] },
          unique: [
            { columns: ['name', 'language_id'] },
          ],
          foreign: [
            { columns: ['language_id'], reference: { table: 'languages', columns: ['id'] } },
          ],
        },
      },
      concepts: {
        columns: {
          id     : { type: 'INTEGER' },
          part_id: { type: 'INTEGER' },
        },
        keys: {
          primary: { columns: ['id'] },
          foreign: [
            { columns: ['part_id'], reference: { table: 'parts', columns: ['id'] } },
          ],
        },
      },
      concept_words: {
        columns: {
          concept_id: { type: 'INTEGER' },
          word_id   : { type: 'INTEGER' },
          note      : { type: 'TEXT'   , nullable: true },
        },
        keys: {
          primary: { columns: ['concept_id', 'word_id'] },
          foreign: [
            { columns: ['concept_id'], reference: { table: 'concepts', columns: ['id'] } },
            { columns: ['word_id']   , reference: { table: 'words'   , columns: ['id'] } },
          ],
        },
      },
      categories: {
        columns: {
          id  : { type: 'INTEGER' },
          name: { type: 'TEXT'    },
        },
        keys: {
          primary: { columns: ['id'] },
          unique: [
            { columns: ['name'] }
          ],
        },
      },
      category_concepts: {
        columns: {
          category_id: { type: 'INTEGER' },
          concept_id : { type: 'INTEGER' },
        },
        keys: {
          primary: { columns: ['category_id', 'concept_id'] },
          foreign: [
            { columns: ['category_id'], reference: { table: 'categories', columns: ['id'] } },
            { columns: ['concept_id'] , reference: { table: 'concepts'  , columns: ['id'] } },
          ],
        },
      },
      extra_noun_nl: {
        columns: {
          word_id: { type: 'INTEGER' },
          gender : { type: 'TEXT'  , values: [ 'de', 'het' ], default: 'de' },
        },
        keys: {
          primary: { columns: ['word_id'] },
          foreign: [
            { columns: ['word_id'], reference: { table: 'words', columns: ['id'] } },
          ],
        },
      },
      extra_noun_es: {
        columns: {
          word_id: { type: 'INTEGER' },
          gender : { type: 'TEXT'  , values: ['el', 'la', 'los', 'las'], default: 'el' },
        },
        keys: {
          primary: { columns: ['word_id'] },
          foreign: [
            { columns: ['word_id'], reference: { table: 'words', columns: ['id'] } },
          ],
        },
      },
    };

    this.buildSchema(schema);
  }

  private buildSchema(schema: Schema) {
    for (const tabName of Object.keys(schema)) {
      const table = schema[tabName];
      const query = this.buildTable(table, tabName);
      log(query);
      this.sql.exec(query);
    }
  }

  private buildTable(table: Table, tabName: string) {
    const cols = [];
    for (const colName of Object.keys(table.columns)) {
      const col = table.columns[colName];
      cols.push(this.buildCol(col, colName));
    }

    const keys = [];
    keys.push(this.buildKey(table.keys.primary, 'PRIMARY'));
    if (table.keys.unique) {
      for (const key of table.keys.unique) {
        keys.push(this.buildKey(key, 'UNIQUE', false));
      }
    }
    if (table.keys.foreign) {
      for (const key of table.keys.foreign) {
        keys.push(this.buildKey(key, 'FOREIGN'));
      }
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${tabName} (${cols.join(', ')}, ${keys.join(', ')})`;
    return sql;
  }

  private buildCol(col: Column, colName: string) {
    let sql = `${colName} ${col.type}`;
    if (!col.nullable) {
      sql += ' NOT';
    }
    sql += ' NULL';
    if (col.values) {
      const values = col.values.map(v => `'${v}'`);
      sql += ` CHECK(${colName} IN (${values.join(', ')}))`;
    }
    if (col.default) {
      sql += ` DEFAULT '${col.default}'`;
    }
    return sql;
  }

  private buildKey(key: Key, label: string, useWordKey = true) {
    let sql = label.toUpperCase();
    if (useWordKey) sql += ' KEY';
    sql += `(${key.columns.join(', ')})`;
    if (key.reference) {
      sql += ` REFERENCES ${key.reference.table}(${key.reference.columns.join(', ')})`;
    }
    return sql;
  }
}
