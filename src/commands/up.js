const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');
const { resolveLink, fetchDepContent } = require('../lib/resolver');
const { generateSettings } = require('../lib/settings');

async function up(envFile) {
  // 1. Find env.json
  const envPath = envFile
    ? path.resolve(envFile)
    : path.resolve(process.cwd(), '.claude', 'env.json');

  if (!await fs.pathExists(envPath)) {
    console.error(chalk.red(`env.json not found: ${envPath}`));
    process.exit(1);
  }

  const envJson = await fs.readJson(envPath);
  // envDir is the repo root: parent of .claude/ where env.json lives
  // If env.json is at .claude/env.json, envDir = parent of .claude/
  // If env.json is given directly as a path, envDir = its parent
  const rawDir = path.dirname(envPath);
  const envDir = path.basename(rawDir) === '.claude'
    ? path.dirname(rawDir)
    : rawDir;
  const feature = envJson.feature;

  if (!feature) {
    console.error(chalk.red('env.json must have a "feature" field'));
    process.exit(1);
  }

  // 2. Create tmp dir
  const tmpDir = path.join('/tmp', `claude-env-${feature}`);
  let spinner = ora('Preparing environment directory').start();
  await fs.remove(tmpDir);
  await fs.ensureDir(tmpDir);
  spinner.succeed('Environment directory ready');

  // 3. Create subdirectories
  spinner = ora('Creating directory structure').start();
  await fs.ensureDir(path.join(tmpDir, '.claude', 'agents'));
  await fs.ensureDir(path.join(tmpDir, '.claude', 'skills'));
  await fs.ensureDir(path.join(tmpDir, 'scratchpad'));
  spinner.succeed('Directory structure created');

  // 4. Create symlinks for links
  if (envJson.links && envJson.links.length > 0) {
    spinner = ora('Creating symlinks').start();
    for (const link of envJson.links) {
      try {
        const sourcePath = await resolveLink(link, envDir, tmpDir);
        const linkPath = path.join(tmpDir, link.as);
        await fs.ensureSymlink(sourcePath, linkPath);
        spinner.text = `Linked ${link.as}`;
      } catch (err) {
        spinner.fail(`Failed to link ${link.as}: ${err.message}`);
        process.exit(1);
      }
    }
    spinner.succeed(`Created ${envJson.links.length} symlink(s)`);
  }

  // 5. Fetch agents
  if (envJson.deps && envJson.deps.agents && envJson.deps.agents.length > 0) {
    spinner = ora('Fetching agents').start();
    for (const dep of envJson.deps.agents) {
      try {
        const content = await fetchDepContent(dep, envDir);
        const basename = path.basename(dep.path);
        const destPath = path.join(tmpDir, '.claude', 'agents', basename);
        await fs.writeFile(destPath, content, 'utf8');
        spinner.text = `Fetched agent: ${basename}`;
      } catch (err) {
        spinner.fail(`Failed to fetch agent ${dep.path}: ${err.message}`);
        process.exit(1);
      }
    }
    spinner.succeed(`Fetched ${envJson.deps.agents.length} agent(s)`);
  }

  // 6. Fetch skills
  if (envJson.deps && envJson.deps.skills && envJson.deps.skills.length > 0) {
    spinner = ora('Fetching skills').start();
    for (const dep of envJson.deps.skills) {
      try {
        const content = await fetchDepContent(dep, envDir);
        const basename = path.basename(dep.path);
        const destPath = path.join(tmpDir, '.claude', 'skills', basename);
        await fs.writeFile(destPath, content, 'utf8');
        spinner.text = `Fetched skill: ${basename}`;
      } catch (err) {
        spinner.fail(`Failed to fetch skill ${dep.path}: ${err.message}`);
        process.exit(1);
      }
    }
    spinner.succeed(`Fetched ${envJson.deps.skills.length} skill(s)`);
  }

  // 7. Generate settings.json
  spinner = ora('Generating settings.json').start();
  const settings = await generateSettings(envJson);
  await fs.writeJson(
    path.join(tmpDir, '.claude', 'settings.json'),
    settings,
    { spaces: 2 }
  );
  spinner.succeed('settings.json generated');

  // 8. Write CLAUDE.md (header + collected CLAUDE.md from linked dirs)
  spinner = ora('Writing CLAUDE.md').start();
  const dirs = (envJson.links || []).map(l => `- \`${l.as}/\``).join('\n');
  let claudeMd = `# ${feature}\n\nEnvironment created by claude-env.\n\n## Directories\n\n${dirs}\n\n## Scratchpad\n\nUse \`scratchpad/\` for temporary files.\n`;

  // Collect CLAUDE.md from each linked directory
  for (const link of (envJson.links || [])) {
    const sourcePath = await resolveLink(link, envDir, tmpDir);
    const linkClaudeMd = path.join(sourcePath, 'CLAUDE.md');
    if (await fs.pathExists(linkClaudeMd)) {
      const content = await fs.readFile(linkClaudeMd, 'utf8');
      claudeMd += `\n---\n\n# ${link.as}\n\n${content}\n`;
    }
  }

  await fs.writeFile(path.join(tmpDir, '.claude', 'CLAUDE.md'), claudeMd, 'utf8');
  spinner.succeed('CLAUDE.md written');

  // 9. Write env-meta.json
  spinner = ora('Writing env-meta.json').start();
  const meta = {
    feature,
    createdAt: new Date().toISOString(),
    envFile: envPath,
    links: envJson.links || [],
    deps: envJson.deps || {},
  };
  await fs.writeJson(
    path.join(tmpDir, '.claude', 'env-meta.json'),
    meta,
    { spaces: 2 }
  );
  spinner.succeed('env-meta.json written');

  // 10. Done
  console.log('');
  console.log(chalk.green.bold('Environment ready!'));
  console.log(chalk.cyan(`  cd ${tmpDir}`));
  console.log(chalk.cyan(`  claude`));
  console.log('');
}

module.exports = up;
