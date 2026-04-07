const path = require('path');
const fs = require('fs-extra');
const os = require('os');

/**
 * Generate .claude/settings.json for the environment.
 *
 * Reads the user's global ~/.claude/settings.json,
 * picks only MCP servers listed in envJson.mcp,
 * and adds agentRouting from envJson.agentRouting.
 */
async function generateSettings(envJson, userSettingsPath) {
  const settingsPath = userSettingsPath ||
    path.join(os.homedir(), '.claude', 'settings.json');

  let userSettings = {};
  if (await fs.pathExists(settingsPath)) {
    userSettings = await fs.readJson(settingsPath);
  }

  const result = {};

  // Pick MCP servers
  if (envJson.mcp && envJson.mcp.length > 0 && userSettings.mcpServers) {
    result.mcpServers = {};
    for (const name of envJson.mcp) {
      if (userSettings.mcpServers[name]) {
        result.mcpServers[name] = userSettings.mcpServers[name];
      }
    }
  }

  // Add agent routing
  if (envJson.agentRouting) {
    result.agentRouting = envJson.agentRouting;
  }

  return result;
}

module.exports = { generateSettings };
