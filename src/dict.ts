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
    });

  program
    .command('list <what>')
    .alias('l')
    .description('list the elements of <what>')
    .action((what, options) => {
      const stmt = db.sql.prepare(`SELECT * FROM ${what} ORDER BY name`);
      for (const row of stmt.iterate()) {
        console.log(row.name);
      }
    });

  program
    .command('add <what>')
    .alias('a')
    .description('add an element to <what>')
    .action((what, options) => {
      const args = program.args.slice(2);
      if (what === 'languages') {
        db.addLanguages(args);
      } else if (what === 'words') {
        db.addWords(args);
      } else {
      }
    });

  program.parse();
  // console.log('----');
  // console.log(program.args);
  // console.log(program.processedArgs);
}

function errorColor(str: string) {
  return chalk.red(str);
}
