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

interface IntToBool {
  [name: number]: boolean;
}

interface IntToStr {
  [name: number]: string;
}

interface StrToInt {
  [name: string]: number;
}

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_PART = 'noun';

export class DB {
  public sql;

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
    this.setup();
    this.create();
    this.populate();
    this.getPart();
    this.getLanguage();
  }

  // public addLanguages(lang: string, names: Array<string>) {
  //   const stmt = this.sql.prepare('INSERT OR IGNORE INTO languages (name) VALUES (?)');
  //   for (const name of names) {
  //     stmt.run(name);
  //   }
  //   this.hLangs = false;
  // }

  // public addParts(lang: string, names: Array<string>) {
  //   const stmt = this.sql.prepare('INSERT OR IGNORE INTO parts (name) VALUES (?)');
  //   for (const name of names) {
  //     stmt.run(name);
  //   }
  //   this.hParts = false;
  // }

  public searchWords(lang: string, names: Array<string>) {
    const l = this.getLanguage(lang);
    const stmt_sel_wnl = this.sql.prepare('SELECT id FROM words WHERE name LIKE ? AND language_id = ?');
    const stmt_sel_wn  = this.sql.prepare('SELECT id FROM words WHERE name LIKE ?');
    const stmt_sel_cwc = this.sql.prepare('SELECT C.id, C.part_id FROM concepts C JOIN concept_words CW ON C.id = CW.concept_id WHERE CW.word_id = ? ORDER BY 2, 1');
    const stmt_sel_cww = this.sql.prepare('SELECT W.name, W.language_id FROM words W JOIN concept_words CW ON W.id = CW.word_id WHERE CW.concept_id = ? ORDER BY 2, 1');
    let count = 0;
    let concept_seen: IntToBool = {};
    for (const name of names) {
      let wl = -1;
      let wn = name;
      if (name.indexOf(':') >= 0) {
        const [sl, sn] = name.split(':');
        wl = this.getLanguage(sl);
        wn = sn;
      }
      const pat = `%${wn}%`;
      const words = wl < 0 ? stmt_sel_wn.all(pat) : stmt_sel_wnl.all(pat, wl);
      for (const word of words) {
        for (const concept of stmt_sel_cwc.iterate(word.id)) {
          if (concept.id in concept_seen) continue;
          concept_seen[concept.id] = true;
          const pid = concept.part_id;
          if (count > 0) console.log('');
          console.log(`Searching for [${wn}] => ${this.iParts[pid]}`);
          for (const word of stmt_sel_cww.iterate(concept.id)) {
            console.log(`=> ${this.iLangs[word.language_id]} ${word.name}`);
          }
          ++count;
        }
      }
    }
  }

  public addWords(lang: string, part: string, names: Array<string>) {
    const l = this.getLanguage(lang);
    const p = this.getPart(part);
    const words: StrToInt = {};
    const stmt_ins_word = this.sql.prepare('INSERT OR IGNORE INTO words (name, language_id) VALUES (?, ?)');
    const stmt_sel_word = this.sql.prepare('SELECT id FROM words WHERE name = ? AND language_id = ?');
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
      const word = `${wlang}:${wn}`;
      console.log(`Add [${p}:${part}] => [${wl}:${wlang}] [${wn}]`);
      stmt_ins_word.run(wn, wl);
      const data = stmt_sel_word.get(wn, wl);
      words[word] = data.id;
    }
    console.log(words);
    const stmt_sel_conc = this.sql.prepare('SELECT C.id FROM concepts C JOIN concept_words CW ON C.id = CW.concept_id WHERE CW.word_id = ? AND C.part_id = ?');
    let cid = -1;
    for (const word of Object.keys(words)) {
      const wid = words[word];
      const concepts = stmt_sel_conc.all(wid, p);
      if (!concepts || concepts.length < 1) continue;
      console.log(`concepts for [${word}]`, concepts);
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
      console.log('AMBIGUOUS');
      return;
    }
    if (cid < 0) {
      const stmt_ins_conc = this.sql.prepare('INSERT INTO concepts (part_id) VALUES (?)');
      const info = stmt_ins_conc.run(p);
      cid = info.lastInsertRowid as number;
    }
    if (cid < 0) {
      console.log('COULD NOT ADD CONCEPT');
      return;
    }
    console.log(`will use concept id ${cid}`);
    const stmt_ins_cw = this.sql.prepare('INSERT OR IGNORE INTO concept_words (concept_id, word_id) VALUES (?, ?)');
    for (const word of Object.keys(words)) {
      // TODO: we could skip words that we know are already there for the concept
      const wid = words[word];
      stmt_ins_cw.run(cid, wid);
    }
  }

  private getLanguage(name = '') {
    if (!this.hLangs) {
      const stmt = this.sql.prepare('SELECT * FROM languages');
      this.nLangs = {};
      this.iLangs = {};
      for (const row of stmt.iterate()) {
        this.nLangs[row.name] = row.id;
        this.iLangs[row.id] = row.name;
      }
      this.hLangs = true;
    }
    return this.nLangs[name || DEFAULT_LANGUAGE];
  }

  private getPart(name = '') {
    if (!this.hParts) {
      const stmt = this.sql.prepare('SELECT * FROM parts');
      this.nParts = {};
      this.iParts = {};
      for (const row of stmt.iterate()) {
        this.nParts[row.name] = row.id;
        this.iParts[row.id] = row.name;
      }
      this.hParts = true;
    }
    return this.nParts[name || DEFAULT_PART];
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
        name: 'parts',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, UNIQUE(name))',
      },
      {
        name: 'words',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, language_id INTEGER, UNIQUE(name, language_id), FOREIGN KEY (language_id) REFERENCES languages(id) ON UPDATE CASCADE)',
      },
      {
        name: 'concepts',
        definition: '(id INTEGER PRIMARY KEY AUTOINCREMENT, part_id INTEGER, FOREIGN KEY (part_id) REFERENCES parts(id) ON UPDATE CASCADE)',
      },
      {
        name: 'concept_words',
        definition: '(concept_id INTEGER, word_id INTEGER, PRIMARY KEY (concept_id, word_id), FOREIGN KEY (concept_id) REFERENCES concepts(id) ON UPDATE CASCADE, FOREIGN KEY (word_id) REFERENCES words(id) ON UPDATE CASCADE)',
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
    const stmt = this.sql.prepare('INSERT OR IGNORE INTO languages (name) VALUES (?)');
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
    const stmt = this.sql.prepare('INSERT OR IGNORE INTO parts (name) VALUES (?)');
    for (const row of rows) {
      stmt.run(row);
    }
  }
}
