import Database from 'better-sqlite3';

interface Langs {
  [name: string]: number;
}

export class DB {
  public sql;
  private langs: Langs | null;

  /**
   * Class constructor.
   *
   * @param fileName file name for the database.
   * @param options options for the database.
   */
  constructor(fileName = '', options = {}) {
    this.sql = new Database(fileName, options);
    this.langs = null;
    this.setup();
    this.create();
  }

  public addLanguages(names: Array<string>) {
    const stmt = this.sql.prepare(`INSERT OR IGNORE INTO languages (name) VALUES (?)`);
    for (const name of names) {
      stmt.run(name);
    }
    this.langs = null;
  }

  public addWords(names: Array<string>) {
    const stmt = this.sql.prepare(`INSERT OR IGNORE INTO words (name, language_id) VALUES (?, ?)`);
    for (let name of names) {
      let lang = 0;
      if (name.indexOf(':') < 0) {
        lang = this.getLanguage();
      } else {
        const [l, n] = name.split(':');
        lang = this.getLanguage(l);
        name = n;
      }
      stmt.run(name, lang);
    }
  }

  private getLanguage(name = '') {
    if (!this.langs) {
      const stmt = this.sql.prepare(`SELECT * FROM languages ORDER BY name`);
      this.langs = {};
      for (const row of stmt.iterate()) {
        this.langs[row.name] = row.id;
      }
    }
    return this.langs[name || 'en'];
  }

  private setup() {
    // allow foreign keys in the DB.
    this.sql.exec('PRAGMA foreign_keys = ON');
  }

  private create() {
    const tables = [
      {
        name: 'languages',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, UNIQUE(name))',
      },
      {
        name: 'words',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, language_id INTEGER, UNIQUE(name, language_id), FOREIGN KEY (language_id) REFERENCES languages(id) ON UPDATE CASCADE)',
      },
    ];
    for (const table of tables) {
      const sql = `CREATE TABLE IF NOT EXISTS ${table.name} ${table.definition}`;
      this.sql.exec(sql);
    }
  }
}
