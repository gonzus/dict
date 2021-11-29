import fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { DB } from './db';
import { Options, Program } from './common';

/**
 * Class to encapsulate our command-line application.
 */
export class App {
  private db: DB;
  private command: Command;

  /**
   * Class constructor.
   */
  constructor() {
    this.db = new DB('dict.db');
    this.command = new Command();

    this.setup();
  }

  /**
   * Run the application, parsing all args and executing the desired commands.
   *
   * @return A status code to return to the OS.
   */
  public run() : number {
    this.command.parse();
    return 0;
  }

  private setup() {
    this.command
      .version(Program.Version)
      .configureOutput({
        outputError: (str, write) => write(errorColor(str))
      })
    ;

    this.command
      .command('search')
      .alias('s')
      .argument('<words...>')
      .description('search for words matching input')
      .option('-l, --lang <lang>', 'restrict to this language', '')
      .action((words, options) => {
        this.db.searchWords(words, options);
      })
    ;

    this.command
      .command('list')
      .alias('l')
      .description('list known words')
      .option('-l, --lang <lang>', 'restrict to this language', '')
      .action((options) => {
        this.db.listWords(options);
      })
    ;

    this.command
      .command('show')
      .alias('w')
      .argument('[categories...]')
      .description('show words in categories')
      .action((categories, options) => {
        this.db.showWords(categories, options);
      })
    ;

    // TODO: add a merge command to merge sets of concepts

    this.command
      .command('add')
      .alias('a')
      .argument('<part>')
      .argument('<words...>')
      .description('add a list of words as a single concept')
      .option('-c, --categories <categories>', 'Optional categories for added words', '')
      .action((part, words, options) => {
        this.db.addWords(part, words, options);
      })
    ;

    this.command
      .command('note')
      .alias('n')
      .argument('<part>')
      .argument('<word>')
      .argument('<note...>')
      .description('add a note to a word')
      .action((part, words, note, options) => {
        this.db.addNote(part, words, note, options);
      })
    ;

    this.command
      .command('load')
      .alias('d')
      .argument('<files...>')
      .description('load data from a file')
      .action((files, options) => {
        this.loadFiles(files, options);
      })
    ;
  }

  private loadFiles(files: Array<string>, options: Options) {
    for (const file of files) {
      this.loadFile(file, options);
    }
  }

  private loadFile(file: string, options: Options) {
    log(`Loading file [${file}]`);
    const data = fs.readFileSync(file, 'utf-8');
    const lines = data.split(/\r?\n/);
    this.db.runLines(lines, this.command, options);
  }
}

function errorColor(str: string) {
  return chalk.red(str);
}

function log(str: string) {
  console.log(chalk.cyan(str));
}
