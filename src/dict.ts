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
    .command('search')
    .alias('s')
    .argument('<words...>')
    .description('search for words matching input')
    .action((words, options) => {
      const lang = program.opts().lang;
      db.searchWords(lang, words);
    })
  ;

  program
    .command('list')
    .alias('l')
    .description('list known words')
    .action((options) => {
      const lang = program.opts().lang;
      db.listWords(lang);
    })
  ;

  program
    .command('show')
    .alias('w')
    .argument('[categories...]')
    .description('show words in categories')
    .action((categories, options) => {
      const lang = program.opts().lang;
      db.showWords(lang, categories);
    })
  ;

  // TODO: add a merge command to merge sets of concepts

  program
    .command('add')
    .alias('a')
    .argument('<part>')
    .argument('<words...>')
    .description('add a list of words acting as the stated part')
    .option('-c, --categories <categories>', 'Optional categories for added words', '')
    .action((part, words, options) => {
      const lang = program.opts().lang;
      db.addWords(lang, part, words, options);
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
