#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DB } from './db';

const VERSION = '0.0.1';

if (require.main === module) {
  main();
}

function main() {
  const db = new DB('dict.db');
  const program = new Command();
  program
    .version(VERSION)
    .configureOutput({
      outputError: (str, write) => write(errorColor(str))
    })
    .option('-l, --lang <lang>', 'use this language', 'en')
  ;

  program
    .command('search <words>')
    .alias('s')
    .description('search for words matching input')
    .action((options) => {
      const lang = program.opts().lang;
      const args = program.args.slice(1);
      db.searchWords(lang, args);
    })
  ;

  program
    .command('list')
    .alias('l')
    .description('list known words')
    .action((options) => {
      db.listWords();
    })
  ;

  // TODO: have a merge command?
  program
    .command('add <part> <words...>')
    .alias('a')
    .description('add a list of words acting as the stated part')
    .action((part, options) => {
      const lang = program.opts().lang;
      const args = program.args.slice(2);
      db.addWords(lang, part, args);
    })
  ;

  program.parse();
  // console.log('----');
  // console.log(program.args);
  // console.log(program.processedArgs);
}

function errorColor(str: string) {
  return chalk.red(str);
}
