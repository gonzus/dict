import Database from 'better-sqlite3';

export class DB {
  public sql;

  /**
   * Class constructor.
   *
   * @param fileName file name for the database.
   * @param options options for the database.
   */
  constructor(fileName = '', options = {}) {
    this.sql = new Database(fileName, options);
    this.setup();
    this.create();

  }

  private setup() {
    // allow foreign keys in the DB.
    this.sql.exec('PRAGMA foreign_keys = ON');
  }

  private create() {
    const tables = [
      {
        name: 'languages',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)',
      },
    ];
    for (const table of tables) {
      const sql = `CREATE TABLE IF NOT EXISTS ${table.name} ${table.definition}`;
      this.sql.exec(sql);
    }
  }
}
