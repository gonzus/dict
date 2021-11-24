#!/usr/bin/env node

import fs from 'fs';
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
  ;

  program
    .command('search')
    .alias('s')
    .argument('<words...>')
    .description('search for words matching input')
    .option('-l, --lang <lang>', 'restrict to this language', '')
    .action((words, options) => {
      db.searchWords(words, options);
    })
  ;

  program
    .command('list')
    .alias('l')
    .description('list known words')
    .option('-l, --lang <lang>', 'restrict to this language', '')
    .action((options) => {
      db.listWords(options);
    })
  ;

  program
    .command('show')
    .alias('w')
    .argument('[categories...]')
    .description('show words in categories')
    .action((categories, options) => {
      db.showWords(categories, options);
    })
  ;

  // TODO: add a merge command to merge sets of concepts

  program
    .command('add')
    .alias('a')
    .argument('<part>')
    .argument('<words...>')
    .description('add a list of words as a single concept')
    .option('-c, --categories <categories>', 'Optional categories for added words', '')
    .action((part, words, options) => {
      db.addWords(part, words, options);
    })
  ;

  program
    .command('note')
    .alias('n')
    .argument('<part>')
    .argument('<word>')
    .argument('<note...>')
    .description('add a note to a word')
    .action((part, words, note, options) => {
      db.addNote(part, words, note, options);
    })
  ;

  program
    .command('load')
    .alias('d')
    .argument('<files...>')
    .description('load data from a file')
    .action((files, options) => {
      for (const file of files) {
        console.log(`Loading file [${file}]`);
        const data = fs.readFileSync(file, 'utf-8');
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
          if (line.match(/^\s*$/)) continue; // ignore empty lines
          if (line.match(/^\s*#/)) continue; // ignore comments
          const args = line.split(/\s+/);
          // console.log(args);
          program.parse(args, { from: 'user' });
        }
      }
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
