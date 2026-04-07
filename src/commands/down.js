const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');

async function down(feature) {
  // If no feature given, try to detect from cwd
  if (!feature) {
    const cwd = process.cwd();
    const metaPath = path.join(cwd, '.claude', 'env-meta.json');
    if (await fs.pathExists(metaPath)) {
      const meta = await fs.readJson(metaPath);
      feature = meta.feature;
    } else {
      console.error(chalk.red('No feature name provided and not inside a claude-env directory.'));
      console.error(chalk.yellow('Usage: claude-env down <feature>'));
      process.exit(1);
    }
  }

  const tmpDir = path.join('/tmp', `claude-env-${feature}`);

  if (!await fs.pathExists(tmpDir)) {
    console.error(chalk.red(`Environment not found: ${tmpDir}`));
    process.exit(1);
  }

  const spinner = ora(`Removing ${tmpDir}`).start();
  await fs.remove(tmpDir);
  spinner.succeed(`Environment "${feature}" removed`);
}

module.exports = down;
