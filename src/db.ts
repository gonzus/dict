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

import Database from 'better-sqlite3';
import { Options, Default } from './common';

interface IntToBool {
  [name: number]: boolean;
}

interface IntToStr {
  [name: number]: string;
}

interface StrToInt {
  [name: string]: number;
}

interface Concept {
  id: number;
  part_id: number;
}

interface Statement {
  sql: string;
  prepared?: Database.Statement;
}
interface StatementPool {
  [name: string]: Statement;
}


export class DB {
  public sql;
  private stmts: StatementPool;

  private hLangs = false;
  private nLangs: StrToInt = {};
  private iLangs: IntToStr = {};

  private hParts = false;
  private nParts: StrToInt = {};
  private iParts: IntToStr = {};

  /**
   * Class constructor.
   *
   * @param fileName file name for the database.
   * @param options options for the database.
   */
  constructor(fileName = '', options = {}) {
    this.sql = new Database(fileName, options);
    this.stmts = {
      'select_langs': {
        sql: 'SELECT * FROM languages',
      },
      'select_parts': {
        sql: 'SELECT * FROM parts',
      },
      'select_cat': {
        sql: 'SELECT name FROM categories ORDER BY 1',
      },
      'select_cat_equal': {
        sql: 'SELECT id, name FROM categories WHERE name = ?',
      },
      'select_cat_like': {
        sql: 'SELECT id, name FROM categories WHERE name LIKE ?',
      },
      'select_cat_con': {
        sql: 'SELECT C.name FROM categories C JOIN category_concepts CC ON C.id = CC.category_id WHERE CC.concept_id = ? ORDER BY 1',
      },
      'select_con_cat': {
        sql: 'SELECT C.id, C.part_id FROM concepts C JOIN category_concepts CC ON C.id = CC.concept_id WHERE CC.category_id = ? ORDER BY 2, 1',
      },
      'select_w': {
        sql: 'SELECT id FROM words WHERE name = ? AND language_id = ?',
      },
      'select_wl': {
        sql: 'SELECT L.name AS language, W.name AS word FROM words W JOIN languages L ON W.language_id = L.id WHERE ? = 0 OR L.id = ? ORDER BY 1, 2',
      },
      'select_wlc': {
        sql: 'SELECT L.name AS language_name, W.id, W.name, W.language_id, CW.note FROM words W JOIN languages L ON W.language_id = L.id JOIN concept_words CW ON W.id = CW.word_id WHERE CW.concept_id = ? ORDER BY 1, 3, 2',
      },
      'select_words_like': {
        sql: 'SELECT id FROM words WHERE name LIKE ? AND (? = 0 OR language_id = ?)',
      },
      'select_concept_words': {
        sql: 'SELECT C.id, C.part_id FROM concepts C JOIN concept_words CW ON C.id = CW.concept_id WHERE CW.word_id = ? AND (? = 0 OR C.part_id = ?) ORDER BY 2, 1',
      },
      'select_concept_words_notes': {
        sql: 'SELECT CW.concept_id, CW.word_id, note from concept_words CW JOIN concepts C ON CW.concept_id = C.id JOIN words W ON CW.word_id = W.id WHERE C.part_id = ? AND W.language_id = ? AND W.name = ?',
      },
      'select_extra_noun_nl': {
        sql: 'SELECT gender FROM extra_noun_nl WHERE word_id = ?',
      },
      'select_extra_noun_es': {
        sql: 'SELECT gender FROM extra_noun_es WHERE word_id = ?',
      },
      'insert_lang': {
        sql: 'INSERT OR IGNORE INTO languages (name) VALUES (?)',
      },
      'insert_part': {
        sql: 'INSERT OR IGNORE INTO parts (name) VALUES (?)',
      },
      'insert_word': {
        sql: 'INSERT OR IGNORE INTO words (name, language_id) VALUES (?, ?)',
      },
      'insert_concept': {
        sql: 'INSERT OR IGNORE INTO concepts (part_id) VALUES (?)',
      },
      'insert_concept_word': {
        sql: 'INSERT OR IGNORE INTO concept_words (concept_id, word_id) VALUES (?, ?)',
      },
      'insert_cat': {
        sql: 'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      },
      'insert_cc': {
        sql: 'INSERT OR IGNORE INTO category_concepts (category_id, concept_id) VALUES (?, ?)',
      },
      'insert_extra_noun_nl': {
        sql: 'INSERT OR IGNORE INTO extra_noun_nl (word_id, gender) VALUES (?, ?)',
      },
      'insert_extra_noun_es': {
        sql: 'INSERT OR IGNORE INTO extra_noun_es (word_id, gender) VALUES (?, ?)',
      },
      'update_concept_word': {
        sql: 'UPDATE concept_words SET note = ? WHERE concept_id = ? AND word_id = ?',
      },
    };

    this.setup();
    this.create();
    this.populate();
    this.getPart();
    this.getLanguage();
  }

  private showConcept(concept: Concept, name: string, count: number, seen: IntToBool) {
    if (concept.id in seen) return;
    seen[concept.id] = true;

    const pid = concept.part_id;
    if (count > 0) console.log('');

    const stmt_sel_cc = this.getStatement('select_cat_con');
    const cats = stmt_sel_cc.all(concept.id).map(c => c.name);
    const part = this.iParts[pid];
    console.log(`[${name}] => ${part} (${cats.join(', ')})`);

    const stmt_sel_cww = this.getStatement('select_wlc');
    for (const word of stmt_sel_cww.iterate(concept.id)) {
      const lang = this.iLangs[word.language_id];
      let display = word.name;
      const sel_extra = `select_extra_${part}_${lang}`;
      if (this.haveStatement(sel_extra)) {
        const stmt = this.getStatement(sel_extra);
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
    const l = lang ? this.getLanguage(lang) : 0;
    let count = 0;
    let seen: IntToBool = {};
    for (const name of names) {
      const pat = `%${name}%`;
      const stmt_sel_wnl = this.getStatement('select_words_like');
      for (const word of stmt_sel_wnl.iterate(pat, l, l)) {
        const stmt_sel_cwc = this.getStatement('select_concept_words');
        for (const concept of stmt_sel_cwc.iterate(word.id, 0, 0)) {
          this.showConcept(concept, name, count++, seen);
        }
      }
    }
  }

  public listWords(options: Options) {
    const lang = options.lang || '';
    const l = lang ? this.getLanguage(lang) : 0;
    const stmt = this.getStatement('select_wl');
    for (const row of stmt.iterate(l, l)) {
      console.log(row.language, row.word);
    }
  }

  public showWords(categories: Array<string>, options: Options) {
    if (categories.length <= 0) {
      const stmt = this.getStatement('select_cat');
      for (const row of stmt.iterate()) {
        console.log(row.name);
      }
      return;
    }

    let count = 0;
    let seen: IntToBool = {};
    for (const category of categories) {
      const pat = `%${category}%`;
      const stmt_sel_cat = this.getStatement('select_cat_like');
      for (const cat of stmt_sel_cat.iterate(pat)) {
        const stmt_sel_con = this.getStatement('select_con_cat');
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
      const stmt_ins_cat = this.getStatement('insert_cat');
      stmt_ins_cat.run(category);

      const stmt_sel_cat = this.getStatement('select_cat_equal');
      const data = stmt_sel_cat.get(category);
      if (data) {
        cats[data.name] = data.id;
      }
    }
    const lang = Default.Language;
    const l = this.getLanguage(lang);
    const p = this.getPart(part);
    const words: StrToInt = {};
    for (const name of names) {
      let wlang = lang;
      let wl = l;
      let wn = name;
      if (name.indexOf(':') >= 0) {
        const separated = name.split(':');
        wlang = separated[0];
        wl = this.getLanguage(wlang);
        wn = separated[1];
      }
      let extra = '';
      if (wn.indexOf('+') >= 0) {
        const separated = wn.split('+');
        wn = separated[0];
        extra = separated[1];
      }
      const word = `${wlang}:${wn}`;
      const stmt_ins_word = this.getStatement('insert_word');
      stmt_ins_word.run(wn, wl);
      const stmt_sel_word = this.getStatement('select_w');
      const data = stmt_sel_word.get(wn, wl);
      words[word] = data.id;

      const ins_extra = `insert_extra_${part}_${wlang}`;
      if (this.haveStatement(ins_extra)) {
        const stmt = this.getStatement(ins_extra);
        stmt.run(data.id, extra);
      }
    }
    let cid = -1;
    for (const word of Object.keys(words)) {
      const wid = words[word];
      const stmt_sel_conc = this.getStatement('select_concept_words');
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
      const stmt_ins_conc = this.getStatement('insert_concept');
      const info = stmt_ins_conc.run(p);
      cid = info.lastInsertRowid as number;
    }
    if (cid < 0) {
      console.log('COULD NOT ADD CONCEPT');
      return;
    }

    const stmt_ins_cc = this.getStatement('insert_cc');
    for (const cat of Object.keys(cats)) {
      stmt_ins_cc.run(cats[cat], cid);
    }

    const stmt_ins_cw = this.getStatement('insert_concept_word');
    for (const word of Object.keys(words)) {
      // TODO: we could skip words that we know are already there for the concept
      stmt_ins_cw.run(cid, words[word]);
    }
  }

  public addNote(part: string, word: string, note: Array<string>, options: Options) {
    const lang = Default.Language;
    let l = this.getLanguage(lang);
    const p = this.getPart(part);
    if (word.indexOf(':') >= 0) {
      const separated = word.split(':');
      l = this.getLanguage(separated[0]);
      word = separated[1];
    }
    const stmt_sel = this.getStatement('select_concept_words_notes');
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
    const stmt_upd = this.getStatement('update_concept_word');
    stmt_upd.run(n, row.concept_id, row.word_id);
  }

  private getLanguage(name = '') {
    if (!this.hLangs) {
      this.nLangs = {};
      this.iLangs = {};
      const stmt = this.getStatement('select_langs');
      for (const row of stmt.iterate()) {
        this.nLangs[row.name] = row.id;
        this.iLangs[row.id] = row.name;
      }
      this.hLangs = true;
    }
    return this.nLangs[name || Default.Language];
  }

  private getPart(name = '') {
    if (!this.hParts) {
      this.nParts = {};
      this.iParts = {};
      const stmt = this.getStatement('select_parts');
      for (const row of stmt.iterate()) {
        this.nParts[row.name] = row.id;
        this.iParts[row.id] = row.name;
      }
      this.hParts = true;
    }
    return this.nParts[name || Default.Part];
  }

  private setup() {
    // enforce foreign keys in the DB.
    this.sql.exec('PRAGMA foreign_keys = ON');
  }

  private create() {
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
      const sql = `CREATE TABLE IF NOT EXISTS ${table.name} ${table.definition}`;
      this.sql.exec(sql);
    }
  }

  private populate() {
    this.populateLanguages();
    this.populateParts();
  }

  private populateLanguages() {
    const rows = [
      "en",
      "nl",
      "es",
      "it",
    ];
    const stmt = this.getStatement('insert_lang');
    for (const row of rows) {
      stmt.run(row);
    }
  }

  private populateParts() {
    const rows = [
      "verb",
      "article",
      "noun",
      "adjective",
      "adverb",
      "pronoun",
      "preposition",
      "conjunction",
      "interjection",
    ];
    const stmt = this.getStatement('insert_part');
    for (const row of rows) {
      stmt.run(row);
    }
  }

  private haveStatement(name: string) {
    return (name in this.stmts);
  }

  private getStatement(name: string) {
    let stmt = this.stmts[name];
    if (!stmt) throw new Error(`Cannot find statement with name [${name}]`);
    if (!stmt.prepared) {
      // console.log(`Preparing statement [${name}]`);
      stmt.prepared = this.sql.prepare(stmt.sql);
    }
    return stmt.prepared;
  }
}
