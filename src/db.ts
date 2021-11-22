import Database from 'better-sqlite3';

interface StrToInt {
  [name: string]: number;
}

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_PART = 'noun';

export class DB {
  public sql;
  private languages: StrToInt | null = null;
  private parts: StrToInt | null = null;

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
  }

  // public addLanguages(lang: string, names: Array<string>) {
  //   const stmt = this.sql.prepare('INSERT OR IGNORE INTO languages (name) VALUES (?)');
  //   for (const name of names) {
  //     stmt.run(name);
  //   }
  //   this.languages = null;
  // }

  // public addParts(lang: string, names: Array<string>) {
  //   const stmt = this.sql.prepare('INSERT OR IGNORE INTO parts (name) VALUES (?)');
  //   for (const name of names) {
  //     stmt.run(name);
  //   }
  //   this.parts = null;
  // }

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
    if (!this.languages) {
      const stmt = this.sql.prepare('SELECT * FROM languages');
      this.languages = {};
      for (const row of stmt.iterate()) {
        this.languages[row.name] = row.id;
      }
    }
    return this.languages[name || DEFAULT_LANGUAGE];
  }

  private getPart(name = '') {
    if (!this.parts) {
      const stmt = this.sql.prepare('SELECT * FROM parts');
      this.parts = {};
      for (const row of stmt.iterate()) {
        this.parts[row.name] = row.id;
      }
    }
    return this.parts[name || DEFAULT_PART];
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
