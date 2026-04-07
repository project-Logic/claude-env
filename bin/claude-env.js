#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('claude-env')
  .description('CLI for managing isolated Claude Code environments')
  .version(pkg.version);

program
  .command('init')
  .description('Interactively create .claude/env.json')
  .action(async () => {
    const init = require('../src/commands/init');
    await init();
  });

program
  .command('up [envfile]')
  .description('Deploy environment (default: .claude/env.json in cwd)')
  .action(async (envfile) => {
    const up = require('../src/commands/up');
    await up(envfile);
  });

program
  .command('down [feature]')
  .description('Remove environment by feature name')
  .action(async (feature) => {
    const down = require('../src/commands/down');
    await down(feature);
  });

program
  .command('status')
  .description('List all active environments')
  .action(async () => {
    const status = require('../src/commands/status');
    await status();
  });

program.parse();
