// Very useful query:
//
// select C.id, P.name, W.name, L.name from concepts C JOIN parts P on C.part_id = P.id JOIN concept_words CW ON C.id = CW.concept_id JOIN words W ON CW.word_id = W.id JOIN languages L ON W.language_id = L.id order by 1, 2, 3, 4;
//   1|noun|boy|en
//   1|noun|niño|es
//   2|noun|jongen|nl
//   2|noun|ragazzo|it
//   3|verb|comer|es
//   3|verb|eat|en
//   3|verb|eten|nl
//   4|noun|comida|es
//   4|noun|eten|nl
//   4|noun|food|en
//   5|noun|girl|en
//   5|noun|meisje|nl
//   6|noun|estudiante|es
//   6|noun|student|en
//   6|noun|student|nl

import * as SQLite from 'better-sqlite3';
import { Options, Default, StrToInt, IntToBool } from './common';
import { Builder } from './builder';
import { Pool } from './pool';
import { Mapping } from './mapping';

interface Concept {
  id: number;
  part_id: number;
}

export class DB {
  private sql: SQLite.Database;
  private builder: Builder;
  private pool: Pool;
  private langs: Mapping;
  private parts: Mapping;

  constructor(fileName = '', options = {}) {
    this.sql = new SQLite.default(fileName, options);
    this.setup();

    this.builder = new Builder(this.sql);
    this.builder.maybeCreate();

    this.pool = new Pool(this.sql);

    this.langs = new Mapping(this.sql, 'languages', [
      'en',
      'nl',
      'es',
      'it',
    ]);

    this.parts = new Mapping(this.sql, 'parts', [
      'verb',
      'article',
      'noun',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'interjection',
    ]);
  }

  private showConcept(concept: Concept, name: string, count: number, seen: IntToBool) {
    if (concept.id in seen) return;
    seen[concept.id] = true;

    const pid = concept.part_id;
    if (count > 0) console.log('');

    const stmt_sel_cc = this.pool.getStatement('select_cat_con');
    const cats = stmt_sel_cc.all(concept.id).map(c => c.name);
    const part = this.parts.getById(pid);
    console.log(`[${name}] => ${part} (${cats.join(', ')})`);

    const stmt_sel_cww = this.pool.getStatement('select_wlc');
    for (const word of stmt_sel_cww.iterate(concept.id)) {
      const lang = this.langs.getById(word.language_id);
      let display = word.name;
      const sel_extra = `select_extra_${part}_${lang}`;
      if (this.pool.haveStatement(sel_extra)) {
        const stmt = this.pool.getStatement(sel_extra);
        const data = stmt.get(word.id);
        if (data) {
          display += ` (${data.gender})`;
        }
      }
      if (word.note) {
        display += ` | ${word.note}`;
      }
      console.log(`${lang} ${display}`);
    }
  }

  public searchWords(names: Array<string>, options: Options) {
    const lang = options.lang || '';
    const l = lang ? this.langs.getByName(lang || Default.Language) : 0;
    let count = 0;
    let seen: IntToBool = {};
    for (const name of names) {
      const pat = `%${name}%`;
      const stmt_sel_wnl = this.pool.getStatement('select_words_like');
      for (const word of stmt_sel_wnl.iterate(pat, l, l)) {
        const stmt_sel_cwc = this.pool.getStatement('select_concept_words');
        for (const concept of stmt_sel_cwc.iterate(word.id, 0, 0)) {
          this.showConcept(concept, name, count++, seen);
        }
      }
    }
  }

  public listWords(options: Options) {
    const lang = options.lang || '';
    const l = lang ? this.langs.getByName(lang || Default.Language) : 0;
    const stmt = this.pool.getStatement('select_wl');
    for (const row of stmt.iterate(l, l)) {
      console.log(row.language, row.word);
    }
  }

  public showWords(categories: Array<string>, options: Options) {
    if (categories.length <= 0) {
      const stmt = this.pool.getStatement('select_cat');
      for (const row of stmt.iterate()) {
        console.log(row.name);
      }
      return;
    }

    let count = 0;
    let seen: IntToBool = {};
    for (const category of categories) {
      const pat = `%${category}%`;
      const stmt_sel_cat = this.pool.getStatement('select_cat_like');
      for (const cat of stmt_sel_cat.iterate(pat)) {
        const stmt_sel_con = this.pool.getStatement('select_con_cat');
        for (const concept of stmt_sel_con.iterate(cat.id)) {
          this.showConcept(concept, cat.name, count++, seen);
        }
      }
    }
  }

  public addWords(part: string, names: Array<string>, options: Options) {
    const cats: StrToInt = {};
    const categories = options.categories || '';
    for (const category of categories.split(',')) {
      const stmt_ins_cat = this.pool.getStatement('insert_cat');
      stmt_ins_cat.run(category);

      const stmt_sel_cat = this.pool.getStatement('select_cat_equal');
      const data = stmt_sel_cat.get(category);
      if (data) {
        cats[data.name] = data.id;
      }
    }
    const lang = Default.Language;
    const l = this.langs.getByName(lang || Default.Language);
    const p = this.parts.getByName(part || Default.Part);
    const words: StrToInt = {};
    for (const name of names) {
      let wlang = lang;
      let wl = l;
      let wn = name;
      if (name.indexOf(':') >= 0) {
        const separated = name.split(':');
        wlang = separated[0];
        wl = this.langs.getByName(wlang || Default.Language);
        wn = separated[1];
      }
      let extra = '';
      if (wn.indexOf('+') >= 0) {
        const separated = wn.split('+');
        wn = separated[0];
        extra = separated[1];
      }
      const word = `${wlang}:${wn}`;
      const stmt_ins_word = this.pool.getStatement('insert_word');
      stmt_ins_word.run(wn, wl);
      const stmt_sel_word = this.pool.getStatement('select_w');
      const data = stmt_sel_word.get(wn, wl);
      words[word] = data.id;

      const ins_extra = `insert_extra_${part}_${wlang}`;
      if (this.pool.haveStatement(ins_extra)) {
        const stmt = this.pool.getStatement(ins_extra);
        stmt.run(data.id, extra);
      }
    }
    let cid = -1;
    for (const word of Object.keys(words)) {
      const wid = words[word];
      const stmt_sel_conc = this.pool.getStatement('select_concept_words');
      const concepts = stmt_sel_conc.all(wid, p, p);
      if (!concepts || concepts.length < 1) continue;
      if (concepts.length == 1) {
        if (cid < 0) {
          cid = concepts[0].id;
        } else if (cid != concepts[0].id) {
          cid = -2;
          break;
        }
      }
    }
    if (cid == -2) {
      console.log('AMBIGUOUS CONCEPT');
      return;
    }
    if (cid < 0) {
      const stmt_ins_conc = this.pool.getStatement('insert_concept');
      const info = stmt_ins_conc.run(p);
      cid = info.lastInsertRowid as number;
    }
    if (cid < 0) {
      console.log('COULD NOT ADD CONCEPT');
      return;
    }

    const stmt_ins_cc = this.pool.getStatement('insert_cc');
    for (const cat of Object.keys(cats)) {
      stmt_ins_cc.run(cats[cat], cid);
    }

    const stmt_ins_cw = this.pool.getStatement('insert_concept_word');
    for (const word of Object.keys(words)) {
      // TODO: we could skip words that we know are already there for the concept
      stmt_ins_cw.run(cid, words[word]);
    }
  }

  public addNote(part: string, word: string, note: Array<string>, options: Options) {
    const lang = Default.Language;
    let l = this.langs.getByName(lang || Default.Language);
    const p = this.parts.getByName(part || Default.Part);
    if (word.indexOf(':') >= 0) {
      const separated = word.split(':');
      l = this.langs.getByName(separated[0] || Default.Language);
      word = separated[1];
    }
    const stmt_sel = this.pool.getStatement('select_concept_words_notes');
    const rows = stmt_sel.all(p, l, word);
    if (!rows || rows.length <= 0) {
      console.log('NOT FOUND');
      return;
    }
    if (rows.length > 1) {
      console.log('AMBIGUOUS WORD');
      return;
    }
    const row = rows[0];
    const n = (row.note ? (row.note + '; ') : '') + note.join(' ');
    const stmt_upd = this.pool.getStatement('update_concept_word');
    stmt_upd.run(n, row.concept_id, row.word_id);
  }

  private setup() {
    // enforce foreign keys in the DB.
    this.sql.exec('PRAGMA foreign_keys = ON');
  }
}
