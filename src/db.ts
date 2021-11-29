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
import type { Command } from 'commander';
import { Options, Default, StrToInt, IntToBool } from './common';
import { Builder } from './builder';
import { Pool } from './pool';
import { Mapping } from './mapping';
import chalk from 'chalk';
import Debug from 'debug';
const logWord = Debug('db:word');
const logNote = Debug('db:note');

/**
 * Type representing a concept.
 */
interface Concept {
  id: number;
  part_id: number;
}

/**
 * Class to interact with the dict SQLite database.
 */
export class DB {
  private sql: SQLite.Database;
  private builder: Builder;
  private pool: Pool;
  private langs: Mapping;
  private parts: Mapping;

  /**
   * Class constructor.
   *
   * @param fileName The name of the dict SQLite database file; empty string to
   * use the default name.
   * @param options Options to pass to the SQLite constructor.
   */
  constructor(fileName = '', options = {}) {
    this.sql = new SQLite.default(fileName, options);

    // Configure the SQLite database.
    this.setup();

    // Create any missing tables.
    this.builder = new Builder(this.sql);
    this.builder.maybeCreateSchema();

    // Create our prepared statement pool.
    this.pool = new Pool(this.sql);

    // Populate / load our in-memory mapping of the languages table.
    this.langs = new Mapping(this.sql, 'languages', [
      'en',
      'nl',
      'es',
      'it',
    ]);

    // Populate / load our in-memory mapping of the parts table.
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

  /**
   * Search for one or more words in the DB.
   *
   * @param names The words to search for.
   * @param options Additional command-line options.
   */
  public searchWords(names: Array<string>, options: Options) : void {
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

  /**
   * List known words in the DB.
   *
   * @param options Additional command-line options.
   */
  public listWords(options: Options) : void {
    const lang = options.lang || '';
    const l = lang ? this.langs.getByName(lang || Default.Language) : 0;
    const stmt = this.pool.getStatement('select_wl');
    for (const row of stmt.iterate(l, l)) {
      console.log(row.language, row.word);
    }
  }

  /**
   * Show known words in the DB given one or more categories.
   *
   * @param categories The categories to search for.
   * @param options Additional command-line options.
   */
  public showWords(categories: Array<string>, options: Options) : void {
    if (categories.length <= 0) {
      // no categories given => show all known categories
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

  /**
   * Add one or more words to the DB, associating these words with all
   * categories passed to the `categories` option.
   *
   * @param part The name of the part (noun, verb) the words must be added as.
   * @param names The words to add, as `word` or `XX:word`, where `XX` is a
   * language code (en, nl, etc).
   * @param options Additional command-line options.
   */
  public addWords(part: string, names: Array<string>, options: Options) : void {
    logWord('Adding words as part %s: %o', part, names);

    // Build a hash with all given categories, inserting them into the DB if
    // necessary.
    const cats: StrToInt = {};
    const categories = options.categories || '';
    for (const category of categories.split(',')) {
      // Insert category (NOOP if it already exists)
      const stmt_ins_cat = this.pool.getStatement('insert_cat');
      stmt_ins_cat.run(category);

      // Select category to get its id
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
      // Each word could be, for example, "dog" or "en:dog", so we need to
      // extract the language and name, or use the default language.
      let wlang = lang;
      let wl = l;
      let wn = name;
      if (name.indexOf(':') >= 0) {
        const separated = name.split(':');
        wlang = separated[0];
        wl = this.langs.getByName(wlang || Default.Language);
        wn = separated[1];
      }

      // Each word could have extra info, to be placed in a table called
      // 'extra_XXX'; this is denoted as "word+extra", so we need to extract
      // that information.
      let extra = '';
      if (wn.indexOf('+') >= 0) {
        const separated = wn.split('+');
        wn = separated[0];
        extra = separated[1];
      }

      // Insert the "standardized" word, if not already there.
      const word = `${wlang}:${wn}`;
      const stmt_ins_word = this.pool.getStatement('insert_word');
      stmt_ins_word.run(wn, wl);

      // Select back the word, to get its id.
      const stmt_sel_word = this.pool.getStatement('select_w');
      const data = stmt_sel_word.get(wn, wl);
      words[word] = data.id;

      // If there was extra information, and we do know an extra table for this
      // combination of part and language, insert the extra information.
      if (extra) {
        const ins_extra = `insert_extra_${part}_${wlang}`;
        if (this.pool.haveStatement(ins_extra)) {
          const stmt = this.pool.getStatement(ins_extra);
          stmt.run(data.id, extra);
        }
      }
    }

    // We want that all the words we want to add have either NO concept
    // associated with them, or they all have the SAME concept.
    let cid = -1;
    for (const word of Object.keys(words)) {
      const wid = words[word];
      const stmt_sel_conc = this.pool.getStatement('select_concept_words');
      const concepts = stmt_sel_conc.all(wid, p, p);
      if (!concepts || concepts.length < 1) continue;
      if (concepts.length == 1) {
        if (cid < 0) {
          // First time we find a concept, remember it.
          cid = concepts[0].id;
        } else if (cid != concepts[0].id) {
          // We found a concept and we had found a different one before; bad.
          cid = -2;
          break;
        }
      }
    }
    if (cid == -2) {
      error('AMBIGUOUS CONCEPT');
      return;
    }

    // No concept found for any of the words, insert a new one.
    if (cid < 0) {
      const stmt_ins_conc = this.pool.getStatement('insert_concept');
      const info = stmt_ins_conc.run(p);
      cid = info.lastInsertRowid as number;
    }
    if (cid < 0) {
      error('COULD NOT ADD CONCEPT');
      return;
    }

    // Insert the categories for the concept, if needed.
    const stmt_ins_cc = this.pool.getStatement('insert_cc');
    for (const cat of Object.keys(cats)) {
      // TODO: we could skip categories that are already there
      stmt_ins_cc.run(cats[cat], cid);
    }

    // Insert the words for the concept, if needed.
    const stmt_ins_cw = this.pool.getStatement('insert_concept_word');
    for (const word of Object.keys(words)) {
      // TODO: we could skip words that are already there
      stmt_ins_cw.run(cid, words[word]);
    }
  }

  /**
   * Add a note to a word in the DB.
   *
   * @param part The name of the part (noun, verb) the words must be added as.
   * @param word The word to add the note to.
   * @param note The elements that will compone the note.
   * @param options Additional command-line options.
   */
  public addNote(part: string, word: string, note: Array<string>, options: Options) : void {
    logNote('Adding note as part %s to word %s: %o', part, word, note);
    const lang = Default.Language;
    let l = this.langs.getByName(lang || Default.Language);
    const p = this.parts.getByName(part || Default.Part);

    // Each word could be, for example, "dog" or "en:dog", so we need to
    // extract the language and name, or use the default language.
    if (word.indexOf(':') >= 0) {
      const separated = word.split(':');
      l = this.langs.getByName(separated[0] || Default.Language);
      word = separated[1];
    }

    // Get current note for the given word.
    const stmt_sel = this.pool.getStatement('select_concept_words_notes');
    const rows = stmt_sel.all(p, l, word);
    if (!rows || rows.length <= 0) {
      error('WORD NOT FOUND');
      return;
    }
    if (rows.length > 1) {
      error('AMBIGUOUS WORD');
      return;
    }

    // Append given note to current data.
    const row = rows[0];
    const n = (row.note ? (row.note + '; ') : '') + note.join(' ');
    const stmt_upd = this.pool.getStatement('update_concept_word');
    stmt_upd.run(n, row.concept_id, row.word_id);
  }

  /**
   * Run a list of commands as a single unit.
   *
   * @param lines The commands to run (likely read from a file).
   * @param command The command object that knows how to run a command.
   * @param options Additional command-line options.
   */
  public runLines(lines: Array<string>, command: Command, options: Options) : void {
    // Run all lines in a transaction.
    // The speed difference is between 10x and 100x.
    const runner = this.sql.transaction((lines, command) => {
      for (const line of lines) {
        if (line.match(/^\s*$/)) continue; // ignore empty lines
        if (line.match(/^\s*#/)) continue; // ignore comments
        const args = line.split(/\s+/);
        command.parse(args, { from: 'user' });
      }
    });
    runner(lines, command);
  }

  private setup() {
    // enforce foreign keys in the DB.
    this.sql.exec('PRAGMA foreign_keys = ON');
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
}

function error(str: string) {
  console.error(chalk.red(str));
}
