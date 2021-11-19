#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

function errorColor(str: string) {
  return chalk.red(str);
}

function main() {
  const program = new Command();
  program
    .version('3.14.16')
    .configureOutput({
      outputError: (str, write) => write(errorColor(str))
    });

  program
    .option('-d, --debug', 'output extra debugging')
    .option('-s, --small', 'small pizza size')
    .option('-p, --pizza-type <type>', 'flavour of pizza')
    .option('-c, --config <path>', 'set config path', './deploy.conf');

  program
    .command('exec <script>')
    .alias('ex')
    .description('execute the given remote cmd')
    .option('-e, --exec_mode <mode>', 'Which exec mode to use', 'fast')
    .action((script, options) => {
      console.log('read config from %s', program.opts().config);
      console.log('exec "%s" using %s mode and config %s', script, options.exec_mode, program.opts().config);
    });

  program.parse(process.argv);
  const options = program.opts();
  if (options.debug) console.log(options);
  console.log('pizza details:');
  if (options.small) console.log('- small pizza size');
  if (options.pizzaType) console.log(`- ${options.pizzaType}`);
}

if (require.main === module) {
  main();
}
