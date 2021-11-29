import * as SQLite from 'better-sqlite3';
import { StrToInt, IntToStr } from './common';

/**
 * A class that keeps an in-memory copy of an SQLite table with columns `id`
 * (number) and `name` (string), where both id and name are unique.  This
 * in-memory copy can be easily and cheaply queried.
 */
export class Mapping {
  private sel: SQLite.Statement; // statement to select data
  private ins: SQLite.Statement; // statement to insert data
  private have = false;
  private n2i: StrToInt = {};
  private i2n: IntToStr = {};

  /**
   * Class constructor.
   *
   * @param sql The SQLite database to use.
   * @param table The table name.
   * @param names An array of strings to insert into the table as data.
   */
  constructor(private sql: SQLite.Database, private table: string, names: Array<string>) {
    this.sel = this.sql.prepare(`SELECT * FROM ${this.table}`);
    this.ins = this.sql.prepare(`INSERT OR IGNORE INTO ${this.table} (name) VALUES (?)`);
    this.maybePopulate(names);
  }

  /**
   * Given a numeric id, get the string name associated with it.
   *
   * @param id The desired id.
   * @return The string name associated with the id.
   */
  public getById(id: number) : string {
    this.maybeLoad();
    return this.i2n[id];
  }

  /**
   * Given a string name, get the numeric id associated with it.
   *
   * @param name The desired name.
   * @return The numeric id associated with the name.
   */
  public getByName(name: string) : number {
    this.maybeLoad();
    return this.n2i[name];
  }

  /**
   * Forget the loaded data and force a reload on the next call to {@linkcode
   * getById} or {@linkcode getByName}.
   */
  public forget() : void {
    this.have = false;
  }

  private maybePopulate(names: Array<string>) {
    for (const name of names) {
      this.ins.run(name);
    }
  }

  private maybeLoad() {
    if (this.have) return;

    this.n2i = {};
    this.i2n = {};
    for (const row of this.sel.iterate()) {
      this.n2i[row.name] = row.id;
      this.i2n[row.id] = row.name;
    }
    this.have = true;
  }
}
