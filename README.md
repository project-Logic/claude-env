# claude-env

**One config, one command — and Claude sees everything it needs.**

If you've used Claude Code on a project that touches multiple repos, you know the pain: Claude can only see the directory it's launched in. You end up copy-pasting context, re-explaining architecture, or just giving up and doing it yourself.

`claude-env` fixes this. You describe your working context once in a simple JSON file, commit it to the repo, and anyone on the team can spin up an identical environment in seconds.

## The problem

You're refactoring an auth flow. The code lives across three repos: backend, frontend, and a shared library. Claude Code can only work in one directory at a time, so you either:

- Open three terminals and copy-paste between them
- Manually symlink everything into a temp folder
- Lose 10 minutes explaining the architecture every new conversation

Multiply this by every developer on the team, every feature branch, every context switch.

## The solution

```bash
claude-env up
cd /tmp/claude-env-auth-refactor
claude
```

That's it. Claude now sees all three codebases, has the right agents and skills loaded, and MCP servers are pre-configured. Your teammate runs the same command and gets the same setup.

## How it works

A declarative config (`.claude/env.json`) describes everything Claude needs:

```json
{
  "feature": "auth-refactor",

  "links": [
    { "from": "./src",                        "as": "backend"  },
    { "from": "../frontend/src",              "as": "frontend" },
    { "from": "$MONOREPO/libs/shared",        "as": "shared"   },
    { "repo": "https://github.com/org/auth",
      "ref": "a3f9c12",                       "as": "auth-lib" }
  ],

  "deps": {
    "agents": [
      { "repo": "https://github.com/team/agents",
        "path": ".claude/agents/reviewer.md", "ref": "b1e4d87" }
    ],
    "skills": [
      { "path": "$SHARED/skills/security.md", "ref": "c2f1a09" }
    ]
  },

  "mcp": ["tracker", "playwright"],

  "agentRouting": {
    "explorer": "claude-haiku-4-5-20251001",
    "default": "claude-sonnet-4-6"
  }
}
```

`claude-env up` reads this and creates a temporary directory with:

```
/tmp/claude-env-auth-refactor/
  backend/     → symlink to your code
  frontend/    → symlink to your code
  shared/      → symlink to your code
  auth-lib/    → symlink to cloned repo
  scratchpad/
  .claude/
    agents/       ← versioned agents from your team
    skills/       ← versioned skills
    settings.json ← MCP servers + model routing
    CLAUDE.md     ← auto-generated context
```

## Why teams love it

- **Reproducible environments.** Commit `env.json` to your repo — everyone gets the same Claude setup. No more "works on my machine" for AI-assisted development.

- **Multi-repo projects just work.** Symlink any combination of local directories and git repos. Claude sees them all as one workspace.

- **Versioned agents and skills.** Pin agents to specific git refs. No surprises when someone updates a shared agent mid-sprint.

- **MCP servers included.** Declare which MCP servers Claude needs — they're pulled from your global config automatically.

- **Zero lock-in.** It's just symlinks and JSON files. Remove `claude-env` and everything still works manually.

- **Team-friendly paths.** Use `$ENV_VARS` in paths so the same config works on every developer's machine.

## Install

```bash
npm i -g git+https://github.com/project-Logic/claude-env.git
```

Or clone and link:

```bash
git clone https://github.com/project-Logic/claude-env.git
cd claude-env
npm install
npm link
```

## Quick start

```bash
# One person creates the config
claude-env init
git add .claude/env.json && git push

# Everyone else
git pull
claude-env up
cd /tmp/claude-env-<feature>
claude
```

## Commands

### `claude-env init`

Interactive wizard that walks you through creating `.claude/env.json`:

1. Feature name
2. Code directories to link (local paths or git repos)
3. Agents and skills to include (shows checkboxes for `.md` files)
4. MCP servers (picked from your `~/.claude/settings.json`)
5. Default model for agent routing

### `claude-env up [envfile]`

Deploys the environment. Reads `.claude/env.json` by default.

- Creates symlinks to all linked directories
- Fetches agents and skills at pinned versions
- Generates `.claude/settings.json` with MCP servers and routing
- Collects `CLAUDE.md` files from linked directories
- Creates `scratchpad/` for temporary files

### `claude-env down [feature]`

Removes the environment directory. Clean and simple.

### `claude-env status`

Lists all active environments with metadata.

## Config reference

### Links

Three ways to link code into the environment:

| Type | Example | What happens |
|------|---------|--------------|
| Relative path | `{ "from": "./src", "as": "src" }` | Resolved relative to repo root |
| Absolute path | `{ "from": "/mono/services/auth", "as": "auth" }` | Used as-is |
| Git repo | `{ "repo": "https://...", "ref": "abc", "as": "lib" }` | Cloned with `--depth=1` |

### Deps (agents & skills)

| Type | Example | What happens |
|------|---------|--------------|
| Local + ref | `{ "path": "/repo/agents/x.md", "ref": "abc" }` | Extracted via `git show ref:path` |
| Local file | `{ "path": "/path/to/agent.md" }` | Copied directly |
| Remote repo | `{ "repo": "https://...", "path": "x.md", "ref": "abc" }` | Cloned, then extracted |

### Environment variables

Paths support `$VAR` and `${VAR}` expansion so the same config works across different machines:

```json
{ "from": "$MONOREPO/services/auth", "as": "auth" }
```

If a variable is not set, `claude-env up` fails with a clear error message.

### MCP servers

Names in `"mcp"` are matched against your `~/.claude/settings.json`. Only matching servers are included in the environment.

### CLAUDE.md collection

If any linked directory has a `CLAUDE.md` at its root, its content is automatically appended to the environment's `.claude/CLAUDE.md`.

## Tech stack

Node.js (CommonJS), commander, inquirer@8, chalk@4, ora@5, simple-git, fs-extra.

## License

MIT
