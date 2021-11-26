import * as SQLite from 'better-sqlite3';
import { StrToInt, IntToStr } from './common';

export class Mapping {
  private sel: SQLite.Statement;
  private ins: SQLite.Statement;
  private have = false;
  private n2i: StrToInt = {};
  private i2n: IntToStr = {};

  constructor(private sql: SQLite.Database, private table: string, names: Array<string>) {
    this.sel = this.sql.prepare(`SELECT * FROM ${this.table}`);
    this.ins = this.sql.prepare(`INSERT OR IGNORE INTO ${this.table} (name) VALUES (?)`);
    this.maybePopulate(names);
  }

  public getById(id: number) {
    this.maybeLoad();
    return this.i2n[id];
  }

  public getByName(name: string) {
    this.maybeLoad();
    return this.n2i[name];
  }

  public forget() {
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
