import * as SQLite from 'better-sqlite3';
import Debug from 'debug';
const log = Debug('pool');

/**
 * Type describing a cached SQLite prepared Statement.
 */
interface Statement {
  query: string;
  prepared?: SQLite.Statement;
}

/**
 * Type describing a pool of cached Statements.
 */
interface StatementPool {
  [name: string]: Statement;
}

/**
 * Class to keep a pool of SQLite prepared statements, which are prepared
 * on-demand the first time they are used.
 */
export class Pool {
  private stmts: StatementPool;

  /**
   * Class constructor.
   *
   * @param sql The SQLite database to use.
   */
  constructor(private sql: SQLite.Database) {
    this.stmts = {
      'select_cat': {
        query: 'SELECT name FROM categories ORDER BY 1',
      },
      'select_cat_equal': {
        query: 'SELECT id, name FROM categories WHERE name = ?',
      },
      'select_cat_like': {
        query: 'SELECT id, name FROM categories WHERE name LIKE ?',
      },
      'select_cat_con': {
        query: 'SELECT C.name FROM categories C JOIN category_concepts CC ON C.id = CC.category_id WHERE CC.concept_id = ? ORDER BY 1',
      },
      'select_con_cat': {
        query: 'SELECT C.id, C.part_id FROM concepts C JOIN category_concepts CC ON C.id = CC.concept_id WHERE CC.category_id = ? ORDER BY 2, 1',
      },
      'select_w': {
        query: 'SELECT id FROM words WHERE name = ? AND language_id = ?',
      },
      'select_wl': {
        query: 'SELECT L.name AS language, W.name AS word FROM words W JOIN languages L ON W.language_id = L.id WHERE ? = 0 OR L.id = ? ORDER BY 1, 2',
      },
      'select_wlc': {
        query: 'SELECT L.name AS language_name, W.id, W.name, W.language_id, CW.note FROM words W JOIN languages L ON W.language_id = L.id JOIN concept_words CW ON W.id = CW.word_id WHERE CW.concept_id = ? ORDER BY 1, 3, 2',
      },
      'select_words_like': {
        query: 'SELECT id FROM words WHERE name LIKE ? AND (? = 0 OR language_id = ?)',
      },
      'select_concept_words': {
        query: 'SELECT C.id, C.part_id FROM concepts C JOIN concept_words CW ON C.id = CW.concept_id WHERE CW.word_id = ? AND (? = 0 OR C.part_id = ?) ORDER BY 2, 1',
      },
      'select_concept_words_notes': {
        query: 'SELECT CW.concept_id, CW.word_id, note from concept_words CW JOIN concepts C ON CW.concept_id = C.id JOIN words W ON CW.word_id = W.id WHERE C.part_id = ? AND W.language_id = ? AND W.name = ?',
      },
      'select_extra_noun_nl': {
        query: 'SELECT gender FROM extra_noun_nl WHERE word_id = ?',
      },
      'select_extra_noun_es': {
        query: 'SELECT gender FROM extra_noun_es WHERE word_id = ?',
      },
      'insert_word': {
        query: 'INSERT OR IGNORE INTO words (name, language_id) VALUES (?, ?)',
      },
      'insert_concept': {
        query: 'INSERT OR IGNORE INTO concepts (part_id) VALUES (?)',
      },
      'insert_concept_word': {
        query: 'INSERT OR IGNORE INTO concept_words (concept_id, word_id) VALUES (?, ?)',
      },
      'insert_cat': {
        query: 'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      },
      'insert_cc': {
        query: 'INSERT OR IGNORE INTO category_concepts (category_id, concept_id) VALUES (?, ?)',
      },
      'insert_extra_noun_nl': {
        query: 'INSERT OR IGNORE INTO extra_noun_nl (word_id, gender) VALUES (?, ?)',
      },
      'insert_extra_noun_es': {
        query: 'INSERT OR IGNORE INTO extra_noun_es (word_id, gender) VALUES (?, ?)',
      },
      'update_concept_word': {
        query: 'UPDATE concept_words SET note = ? WHERE concept_id = ? AND word_id = ?',
      },
    };
  }

  /**
   * Determine whether a given name corresponds to a known statement.
   *
   * @param name The desired name.
   * @return true if `name` is a known statement.
   */
  public haveStatement(name: string) : boolean {
    return (name in this.stmts);
  }

  /**
   * Return the prepared statement associated with a given name.
   *
   * @param name The desired name.
   * @return A prepared statement associated with the name.
   */
  public getStatement(name: string) : SQLite.Statement {
    let stmt = this.stmts[name];
    if (!stmt) throw new Error(`Cannot find statement in pool with name [${name}]`);
    if (!stmt.prepared) {
      log(`Preparing statement [${name}]`);
      stmt.prepared = this.sql.prepare(stmt.query);
    }
    return stmt.prepared;
  }
}
