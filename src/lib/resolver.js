const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');

/**
 * Expand $VAR and ${VAR} in a string using process.env.
 */
function expandVars(str) {
  return str.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, a, b) => {
    const name = a || b;
    if (process.env[name] == null) {
      throw new Error(`Environment variable $${name} is not set`);
    }
    return process.env[name];
  });
}

/**
 * Sanitize a string for use as a directory name.
 */
function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Resolve a link entry to an absolute source path.
 *
 * Three types:
 *   { from: './relative', as }  → resolve relative to envDir
 *   { from: '/absolute', as }   → use as-is
 *   { repo, ref, as }           → clone into tmpDir/.repos/NAME, return path
 */
async function resolveLink(link, envDir, tmpDir) {
  if (link.repo) {
    const repoName = sanitize(path.basename(link.repo, '.git'));
    const cloneDir = path.join(tmpDir, '.repos', repoName);
    if (!await fs.pathExists(cloneDir)) {
      await fs.ensureDir(path.dirname(cloneDir));
      const git = simpleGit();
      await git.clone(link.repo, cloneDir, ['--depth=1']);
    }
    if (link.ref) {
      const git = simpleGit(cloneDir);
      await git.checkout(link.ref);
    }
    return cloneDir;
  }

  const from = expandVars(link.from);
  if (path.isAbsolute(from)) {
    return from;
  }
  return path.resolve(envDir, from);
}

/**
 * Fetch dependency file content.
 *
 * Two types:
 *   { path, ref }              → git show ref:relpath from nearest git repo
 *   { repo, path, ref }        → clone to /tmp/_cenv_NAME, git show ref:path
 */
async function fetchDepContent(dep, envDir) {
  if (dep.repo) {
    const repoName = sanitize(path.basename(dep.repo, '.git'));
    const cacheDir = path.join('/tmp', `_cenv_${repoName}`);
    if (!await fs.pathExists(cacheDir)) {
      const git = simpleGit();
      await git.clone(dep.repo, cacheDir, ['--depth=1']);
    }
    const git = simpleGit(cacheDir);
    // Fetch the ref if not already available
    try {
      const content = await git.show([`${dep.ref}:${dep.path}`]);
      return content;
    } catch {
      await git.fetch(['origin']);
      const content = await git.show([`${dep.ref}:${dep.path}`]);
      return content;
    }
  }

  // Local path — resolve and check if inside a git repo
  const expanded = expandVars(dep.path);
  const depPath = path.isAbsolute(expanded)
    ? expanded
    : path.resolve(envDir, expanded);

  const repoDir = path.dirname(depPath);

  // Try git show if inside a git repo
  try {
    const git = simpleGit(repoDir);
    const root = (await git.revparse(['--show-toplevel'])).trim();
    const relPath = path.relative(root, depPath).replace(/\\/g, '/');
    const content = await git.show([`${dep.ref}:${relPath}`]);
    return content;
  } catch {
    // Not a git repo — read file directly
    const content = await fs.readFile(depPath, 'utf8');
    return content;
  }
}

module.exports = { resolveLink, fetchDepContent, sanitize, expandVars };
