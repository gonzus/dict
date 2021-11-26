#!/usr/bin/env node

import { App } from './app';

if (require.main === module) {
  process.exitCode = main();
}

function main() {
  const app = new App();
  return app.run();
}
