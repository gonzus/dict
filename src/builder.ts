import * as SQLite from 'better-sqlite3';

export class Builder {
  constructor(private sql: SQLite.Database) {
  }

  public maybeCreate() {
    const tables = [
      {
        name: 'languages',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, UNIQUE(name))',
      },
      {
        name: 'parts',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, UNIQUE(name))',
      },
      {
        name: 'words',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, language_id INTEGER NOT NULL, UNIQUE(name, language_id), FOREIGN KEY (language_id) REFERENCES languages(id) ON UPDATE CASCADE)',
      },
      {
        name: 'concepts',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, part_id INTEGER NOT NULL, FOREIGN KEY (part_id) REFERENCES parts(id) ON UPDATE CASCADE)',
      },
      {
        name: 'concept_words',
        definition: '(concept_id INTEGER NOT NULL, word_id INTEGER NOT NULL, note TEXT NULL, PRIMARY KEY (concept_id, word_id), FOREIGN KEY (concept_id) REFERENCES concepts(id) ON UPDATE CASCADE, FOREIGN KEY (word_id) REFERENCES words(id) ON UPDATE CASCADE)',
      },
      {
        name: 'categories',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, UNIQUE(name))',
      },
      {
        name: 'category_concepts',
        definition: '(category_id INTEGER NOT NULL, concept_id INTEGER NOT NULL, PRIMARY KEY (category_id, concept_id), FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE, FOREIGN KEY (concept_id) REFERENCES concepts(id) ON UPDATE CASCADE)',
      },

      {
        name: 'extra_noun_nl',
        definition: "(word_id INTEGER PRIMARY KEY NOT NULL, gender TEXT CHECK(gender IN ('de', 'het')) NOT NULL DEFAULT 'de', FOREIGN KEY (word_id) REFERENCES words(id) ON UPDATE CASCADE)",
      },
      {
        name: 'extra_noun_es',
        definition: "(word_id INTEGER PRIMARY KEY NOT NULL, gender TEXT CHECK(gender IN ('el', 'la', 'los', 'las')) NOT NULL DEFAULT 'el', FOREIGN KEY (word_id) REFERENCES words(id) ON UPDATE CASCADE)",
      },
    ];
    for (const table of tables) {
      const query = `CREATE TABLE IF NOT EXISTS ${table.name} ${table.definition}`;
      this.sql.exec(query);
    }
  }
}
