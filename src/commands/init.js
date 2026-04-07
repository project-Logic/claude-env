const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const os = require('os');

function stripQuotes(s) {
  return s.trim().replace(/^["']+|["']+$/g, '');
}

async function init() {
  console.log(chalk.bold('\nclaude-env init\n'));

  // 1. Feature name
  const { feature } = await inquirer.prompt([{
    type: 'input',
    name: 'feature',
    message: 'Feature name:',
    validate: v => v.trim() ? true : 'Feature name is required',
  }]);

  const envJson = { feature: feature.trim(), links: [], deps: { agents: [], skills: [] }, mcp: [], agentRouting: {} };

  // 2. Check if cwd is a git repo, offer to add as link
  const git = simpleGit();
  const isRepo = await git.checkIsRepo();
  if (isRepo) {
    const { addCurrent } = await inquirer.prompt([{
      type: 'confirm',
      name: 'addCurrent',
      message: 'Current directory is a git repo. Add it as a link?',
      default: true,
    }]);
    if (addCurrent) {
      const { alias } = await inquirer.prompt([{
        type: 'input',
        name: 'alias',
        message: 'Alias for current repo:',
        default: path.basename(process.cwd()),
      }]);
      envJson.links.push({ from: '.', as: alias });
    }
  }

  // 3. Additional links
  console.log(chalk.gray('\nAdd more links (paths or empty to skip):'));
  while (true) {
    const { linkPath } = await inquirer.prompt([{
      type: 'input',
      name: 'linkPath',
      message: 'Path (or Enter to skip):',
    }]);
    if (!linkPath.trim()) break;

    const { linkAlias } = await inquirer.prompt([{
      type: 'input',
      name: 'linkAlias',
      message: 'Alias:',
      default: path.basename(stripQuotes(linkPath)),
    }]);
    envJson.links.push({ from: stripQuotes(linkPath), as: linkAlias });
  }

  // 4. GitHub repos for deps
  console.log(chalk.gray('\nAdd GitHub repos for agents/skills (or empty to skip):'));
  while (true) {
    const { repoUrl } = await inquirer.prompt([{
      type: 'input',
      name: 'repoUrl',
      message: 'GitHub repo URL (or Enter to skip):',
    }]);
    if (!repoUrl.trim()) break;

    const { repoRef } = await inquirer.prompt([{
      type: 'input',
      name: 'repoRef',
      message: 'Git ref (commit/branch):',
      default: 'main',
    }]);

    // Try to find agents/skills in that repo
    console.log(chalk.gray('  Cloning to discover agents/skills...'));
    const repoName = path.basename(repoUrl.trim(), '.git').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloneDir = path.join('/tmp', `_cenv_init_${repoName}`);
    try {
      await fs.remove(cloneDir);
      await simpleGit().clone(repoUrl.trim(), cloneDir, ['--depth=1']);

      // Find agents
      const agentsDir = path.join(cloneDir, '.claude', 'agents');
      if (await fs.pathExists(agentsDir)) {
        const agentFiles = (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'));
        if (agentFiles.length > 0) {
          const { selectedAgents } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedAgents',
            message: 'Select agents:',
            choices: agentFiles,
          }]);
          for (const f of selectedAgents) {
            envJson.deps.agents.push({
              repo: repoUrl.trim(),
              path: `.claude/agents/${f}`,
              ref: repoRef,
            });
          }
        }
      }

      // Find skills
      const skillsDir = path.join(cloneDir, '.claude', 'skills');
      if (await fs.pathExists(skillsDir)) {
        const skillFiles = (await fs.readdir(skillsDir)).filter(f => f.endsWith('.md'));
        if (skillFiles.length > 0) {
          const { selectedSkills } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedSkills',
            message: 'Select skills:',
            choices: skillFiles,
          }]);
          for (const f of selectedSkills) {
            envJson.deps.skills.push({
              repo: repoUrl.trim(),
              path: `.claude/skills/${f}`,
              ref: repoRef,
            });
          }
        }
      }
    } catch (err) {
      console.log(chalk.yellow(`  Could not clone repo: ${err.message}`));
    } finally {
      await fs.remove(cloneDir);
    }
  }

  // 4b. Local agents (file or directory + ref)
  console.log(chalk.gray('\nAdd local agents — file or folder (or empty to skip):'));
  while (true) {
    const { agentPath } = await inquirer.prompt([{
      type: 'input',
      name: 'agentPath',
      message: 'Agent path (or Enter to skip):',
    }]);
    if (!agentPath.trim()) break;

    const cleanPath = stripQuotes(agentPath);
    const resolved = path.resolve(cleanPath);
    const { agentRef } = await inquirer.prompt([{
      type: 'input',
      name: 'agentRef',
      message: 'Git ref (commit/branch):',
      default: 'main',
    }]);

    if (await fs.pathExists(resolved) && (await fs.stat(resolved)).isDirectory()) {
      const files = (await fs.readdir(resolved)).filter(f => f.endsWith('.md'));
      if (files.length === 0) {
        console.log(chalk.yellow('  No .md files found in directory.'));
        continue;
      }
      const { selected } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select agents:',
        choices: files,
      }]);
      for (const f of selected) {
        envJson.deps.agents.push({ path: path.join(resolved, f), ref: agentRef });
      }
    } else {
      envJson.deps.agents.push({ path: resolved, ref: agentRef });
    }
  }

  // 4c. Local skills (file or directory + ref)
  console.log(chalk.gray('\nAdd local skills — file or folder (or empty to skip):'));
  while (true) {
    const { skillPath } = await inquirer.prompt([{
      type: 'input',
      name: 'skillPath',
      message: 'Skill path (or Enter to skip):',
    }]);
    if (!skillPath.trim()) break;

    const cleanPath = stripQuotes(skillPath);
    const resolved = path.resolve(cleanPath);
    const { skillRef } = await inquirer.prompt([{
      type: 'input',
      name: 'skillRef',
      message: 'Git ref (commit/branch):',
      default: 'main',
    }]);

    if (await fs.pathExists(resolved) && (await fs.stat(resolved)).isDirectory()) {
      const files = (await fs.readdir(resolved)).filter(f => f.endsWith('.md'));
      if (files.length === 0) {
        console.log(chalk.yellow('  No .md files found in directory.'));
        continue;
      }
      const { selected } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select skills:',
        choices: files,
      }]);
      for (const f of selected) {
        envJson.deps.skills.push({ path: path.join(resolved, f), ref: skillRef });
      }
    } else {
      envJson.deps.skills.push({ path: skillPath.trim(), ref: skillRef });
    }
  }

  // 5. MCP servers from user settings
  const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (await fs.pathExists(userSettingsPath)) {
    const userSettings = await fs.readJson(userSettingsPath);
    if (userSettings.mcpServers && Object.keys(userSettings.mcpServers).length > 0) {
      const mcpNames = Object.keys(userSettings.mcpServers);
      const { selectedMcp } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedMcp',
        message: 'Select MCP servers:',
        choices: mcpNames,
      }]);
      envJson.mcp = selectedMcp;
    }
  }

  // 6. Default model for agent routing
  const { defaultModel } = await inquirer.prompt([{
    type: 'input',
    name: 'defaultModel',
    message: 'Default model for agentRouting (or Enter to skip):',
  }]);
  if (defaultModel.trim()) {
    envJson.agentRouting.default = defaultModel.trim();
  }

  // Clean up empty sections
  if (envJson.deps.agents.length === 0 && envJson.deps.skills.length === 0) {
    delete envJson.deps;
  }
  if (envJson.mcp.length === 0) delete envJson.mcp;
  if (Object.keys(envJson.agentRouting).length === 0) delete envJson.agentRouting;

  // 7. Confirm and write
  console.log(chalk.bold('\nGenerated env.json:'));
  console.log(JSON.stringify(envJson, null, 2));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Write to .claude/env.json?',
    default: true,
  }]);

  if (confirm) {
    const outDir = path.join(process.cwd(), '.claude');
    await fs.ensureDir(outDir);
    await fs.writeJson(path.join(outDir, 'env.json'), envJson, { spaces: 2 });
    console.log(chalk.green('\n✔ Written to .claude/env.json'));
    console.log(chalk.gray('  Run `claude-env up` to deploy the environment.'));
  } else {
    console.log(chalk.yellow('Cancelled.'));
  }
}

module.exports = init;
