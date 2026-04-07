# claude-env

CLI for managing isolated Claude Code environments.

When working on a feature that spans multiple repositories, you need an isolated place where Claude sees all the relevant code, agents, and skills without mixing with other projects. `claude-env` sets that up declaratively.

## Install

```bash
npm install -g claude-env
```

Or run locally:

```bash
git clone <repo-url>
cd claude-env
npm install
npm link
```

## Quick start

```bash
# one person creates the config
claude-env init
git add .claude/env.json && git push

# everyone else
git pull
claude-env up
cd \tmp\claude-env-<feature>
claude
```

## Commands

### `claude-env init`

Interactive wizard that creates `.claude/env.json`. Walks you through:

1. Feature name
2. Links to code directories (local paths or repos)
3. Agents — from GitHub repos or local folders (shows checkbox for `.md` files)
4. Skills — same as agents
5. MCP servers — picked from your `~/.claude/settings.json`
6. Default model for agent routing

### `claude-env up [envfile]`

Deploys environment to `/tmp/claude-env-<feature>/`. Reads `.claude/env.json` by default.

Creates:
- Symlinks to all linked directories
- `.claude/agents/` and `.claude/skills/` with fetched files
- `.claude/settings.json` with MCP servers and agent routing
- `.claude/CLAUDE.md` — feature header + collected CLAUDE.md from linked dirs
- `scratchpad/` for temporary files

### `claude-env down [feature]`

Removes the environment directory.

### `claude-env status`

Lists all active environments with metadata.

## env.json

Lives at `.claude/env.json` in your repo.

```json
{
  "feature": "trading-refactor",

  "links": [
    { "from": "./src", "as": "src" },
    { "from": "$MONOREPO/services/auth", "as": "auth" },
    { "repo": "https://github.com/me/backend", "ref": "a3f9c12", "as": "backend" }
  ],

  "deps": {
    "agents": [
      { "path": "/shared/.claude/agents/explorer.md", "ref": "a3f9c12" },
      { "repo": "https://github.com/team/agents", "path": ".claude/agents/reviewer.md", "ref": "b1e4d87" }
    ],
    "skills": [
      { "path": "$SHARED/skills/security.md", "ref": "c2f1a09" }
    ]
  },

  "mcp": ["tracker", "playwright"],

  "agentRouting": {
    "explorer": "deepseek-chat",
    "default": "gpt-4o"
  }
}
```

### Links

Three types of `from`:

| Type | Example | Resolves to |
|------|---------|-------------|
| Relative | `./src` | Relative to repo root (parent of `.claude/`) |
| Absolute | `/monorepo/services/auth` | Used as-is |
| Git repo | `{ "repo": "https://...", "ref": "abc123" }` | Cloned with `--depth=1` |

### Deps

Agents and skills fetched by version:

| Type | Example | How it works |
|------|---------|-------------|
| Local + ref | `{ "path": "/repo/agents/x.md", "ref": "abc" }` | `git show ref:path` |
| Local (no git) | `{ "path": "/path/to/agent.md" }` | Read file directly |
| Remote | `{ "repo": "https://...", "path": "agents/x.md", "ref": "abc" }` | Clone + `git show` |

Agents must have YAML frontmatter to be recognized by Claude Code:

```markdown
---
name: explorer
description: Explores codebase structure
tools: Read, Glob, Grep
model: haiku
---

Your system prompt here.
```

### Environment variables

Paths support `$VAR` and `${VAR}` expansion:

```json
{ "from": "$MONOREPO/services/auth", "as": "auth" }
{ "path": "${SHARED_AGENTS}/explorer.md", "ref": "main" }
```

This lets the team share one `env.json` while each person configures their own paths via environment variables.

If a variable is not set, `claude-env up` will fail with a clear error.

### CLAUDE.md collection

During `up`, if any linked directory contains a `CLAUDE.md` at its root, its content is automatically appended to the environment's `.claude/CLAUDE.md`. No extra config needed.

### MCP servers

Names listed in `mcp` are matched against your `~/.claude/settings.json`. Only matching servers are copied into the environment's `settings.json`.

## Deployed structure

```
/tmp/claude-env-<feature>/
  .claude/
    agents/          <- from deps.agents
    skills/          <- from deps.skills
    settings.json    <- MCP servers + agentRouting
    CLAUDE.md        <- feature header + collected from links
    env-meta.json    <- metadata (feature, createdAt, source env.json)
  src/       -> symlink
  auth/      -> symlink
  scratchpad/
```

## Tech stack

- Node.js (CommonJS)
- commander — CLI
- inquirer@8 — interactive prompts (CommonJS-compatible)
- chalk@4 — colors
- ora@5 — spinners
- simple-git — git operations
- fs-extra — file operations
