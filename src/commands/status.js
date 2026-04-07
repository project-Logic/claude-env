const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

async function status() {
  const tmpBase = '/tmp';
  let entries;

  try {
    entries = await fs.readdir(tmpBase);
  } catch {
    console.log(chalk.yellow('No active environments.'));
    return;
  }

  const envDirs = entries.filter(e => e.startsWith('claude-env-'));

  if (envDirs.length === 0) {
    console.log(chalk.yellow('No active environments.'));
    return;
  }

  console.log(chalk.bold('Active environments:\n'));

  for (const dir of envDirs) {
    const fullPath = path.join(tmpBase, dir);
    const metaPath = path.join(fullPath, '.claude', 'env-meta.json');

    if (await fs.pathExists(metaPath)) {
      const meta = await fs.readJson(metaPath);
      const links = (meta.links || []).map(l => l.as).join(', ');
      console.log(chalk.green(`  ${meta.feature}`));
      console.log(chalk.gray(`    Path:    ${fullPath}`));
      console.log(chalk.gray(`    Created: ${meta.createdAt}`));
      console.log(chalk.gray(`    Links:   ${links || 'none'}`));
      console.log('');
    } else {
      console.log(chalk.green(`  ${dir.replace('claude-env-', '')}`));
      console.log(chalk.gray(`    Path: ${fullPath}`));
      console.log(chalk.gray(`    (no metadata found)`));
      console.log('');
    }
  }
}

module.exports = status;
