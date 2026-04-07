# claude-env — CLI для управления Claude Code окружениями

## Что это

Node.js CLI утилита (`claude-env`) которая разворачивает изолированные временные окружения для Claude Code.

Проблема которую решает: когда работаешь над фичей затрагивающей несколько репозиториев, нужно изолированное место где Claude видит весь нужный код + нужные агенты и скиллы, и не смешивается с другими фичами/проектами.

Флоу использования:
```
# один человек в команде создаёт конфиг
claude-env init
git add .claude/env.json && git push

# все остальные просто
claude-env up
cd /tmp/claude-env-{feature} && claude
```

## Как работает

`env.json` лежит в `.claude/env.json` в репо. Описывает окружение декларативно.
`claude-env up` читает его и создаёт `/tmp/claude-env-{feature}/` с:
- симлинками на нужные кодовые базы
- агентами и скиллами подтянутыми из других репо через git
- готовым `.claude/settings.json` с MCP серверами и agentRouting

## Структура env.json

```json
{
  "feature": "trading-refactor",

  "links": [
    { "from": "./src",                              "as": "src"      },
    { "from": "../frontend/src",                    "as": "frontend" },
    { "from": "/monorepo/services/auth",            "as": "auth"     },
    { "repo": "https://github.com/me/backend",
      "ref": "a3f9c12",                             "as": "backend"  }
  ],

  "deps": {
    "agents": [
      { "path": "/monorepo/shared/.claude/agents/explorer.md", "ref": "a3f9c12" },
      { "repo": "https://github.com/team/agents", "path": ".claude/agents/reviewer.md", "ref": "b1e4d87" }
    ],
    "skills": [
      { "path": "/monorepo/team-alpha/.claude/skills/security.md", "ref": "c2f1a09" }
    ]
  },

  "mcp": ["tracker", "playwright"],

  "agentRouting": {
    "explorer": "deepseek-chat",
    "default":  "gpt-4o"
  }
}
```

Три типа `links.from`:
- `./relative` — относительно директории где лежит env.json
- `/absolute` — абсолютный путь (монорепо)
- `{ repo, ref }` — внешний git репо, клонируется временно

Три типа `deps[].path`:
- локальный путь — берёт файл через `git show ref:path` из ближайшего git репо
- `{ repo, path, ref }` — берёт файл из внешнего репо

## Что разворачивается в tmp dir

```
/tmp/claude-env-{feature}/
  .claude/
    agents/       ← из deps.agents (конкретная версия по ref)
    skills/       ← из deps.skills
    settings.json ← MCP серверы + agentRouting
    CLAUDE.md     ← название фичи + список директорий
    env-meta.json ← метаданные (feature, createdAt, ссылка на env.json)
  src       → симлинк
  frontend  → симлинк
  auth      → симлинк
  scratchpad/
```

## Технический стек

- Node.js (CommonJS)
- `commander` — CLI
- `inquirer@8` — интерактивный init (CommonJS совместимая версия)
- `chalk` — цвета в выводе
- `ora` — спиннеры
- `simple-git` — git операции (clone, show)
- `fs-extra` — файловые операции

## Структура проекта

```
claude-env/
  bin/
    claude-env.js         ← точка входа CLI, commander
  src/
    commands/
      init.js             ← интерактивная генерация env.json через inquirer
      up.js               ← главная команда: разворачивает окружение
      down.js             ← удаляет tmp dir
      status.js           ← список активных окружений
    lib/
      resolver.js         ← resolveLink + fetchDepContent
      settings.js         ← generateSettings (читает ~/.claude/settings.json)
  package.json
```

## Команды

```bash
claude-env init           # интерактивно создаёт .claude/env.json
claude-env up [envfile]   # разворачивает окружение (по умолчанию .claude/env.json в cwd)
claude-env down [feature] # удаляет /tmp/claude-env-{feature}/
claude-env status         # список всех активных окружений
```

## Порядок реализации

1. `src/lib/resolver.js`
2. `src/lib/settings.js`
3. `src/commands/up.js`
4. `bin/claude-env.js`
5. `src/commands/down.js`
6. `src/commands/status.js`
7. `src/commands/init.js`

После шага 4 уже можно тестировать основной флоу.

## Детали реализации

### resolver.js

```js
// resolveLink(link, envDir, tmpDir) → string (абсолютный путь источника)
// Три типа link:
//   { from: './src', as: 'src' }          → path.resolve(envDir, './src')
//   { from: '/abs/path', as: 'x' }        → '/abs/path'
//   { repo: 'https://...', ref, as: 'x' } → клонирует в tmpDir/.repos/NAME, возвращает путь

// fetchDepContent(dep, envDir) → string (содержимое файла)
// Два типа dep:
//   { path: '/abs/or/rel', ref }           → git show ref:relpath в ближайшем git репо
//   { repo: 'https://...', path, ref }     → клонирует во /tmp/_cenv_NAME, git show ref:path
```

### settings.js

```js
// generateSettings(envJson, userSettingsPath) → object
// Читает ~/.claude/settings.json, берёт только mcpServers перечисленные в envJson.mcp
// Добавляет agentRouting из envJson.agentRouting
// Возвращает объект для записи в .claude/settings.json
```

### up.js (алгоритм)

```
1. Найти env.json (аргумент или .claude/env.json в cwd)
2. tmpDir = /tmp/claude-env-{feature} — удалить если есть, создать
3. Создать .claude/agents/, .claude/skills/, scratchpad/
4. links → симлинки
5. deps.agents → fetchDepContent → .claude/agents/{basename}
6. deps.skills → fetchDepContent → .claude/skills/{basename}
7. generateSettings → .claude/settings.json
8. Записать .claude/CLAUDE.md (feature name + список директорий)
9. Записать .claude/env-meta.json { feature, createdAt, envFile, links, deps }
10. Вывести: путь к tmpDir + "cd {tmpDir} && claude"
```

Каждый шаг оборачивать в ora спиннер. Ошибки через chalk.red + process.exit(1).

### init.js (интерактивный флоу через inquirer@8)

```
1. input: название фичи
2. simple-git().checkIsRepo() → если репо, confirm: добавить как link?
3. input: ещё пути для links (можно пустой, Enter пропускает)
4. input: GitHub URL для deps (можно пустой)
   → если указан: клонировать, показать checkbox файлов из .claude/agents/ и .claude/skills/
5. checkbox: какие MCP серверы (список из ~/.claude/settings.json)
6. input: модель по умолчанию для agentRouting (например gpt-4o)
7. confirm → записать .claude/env.json
```

## Важные детали

- `inquirer@8` — обязательно именно v8, не v13 (v13 ESM, несовместим с CommonJS)
- `links[].repo` клонировать с `--depth=1` для скорости
- `deps` клонировать в `/tmp/_cenv_{sanitized_name}` — не в tmpDir, это кэш между запусками (но без инвалидации)
- При `up` если tmpDir уже существует — удалить и пересоздать без вопросов
- `env-meta.json` нужен для `status` и `down` без аргументов
- MCP серверы в `settings.json` берутся из `~/.claude/settings.json` пользователя — это где Claude Code хранит глобальные настройки
