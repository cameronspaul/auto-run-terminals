# Auto-Run Terminals

Automatically launch and run your favorite terminals when VS Code starts. Choose between split panes or separate tabs.

## Features
- Configure multiple terminals with names and commands.
- Choose `split` layout for side-by-side panes or `tabs` for individual terminals.
- Warns when too many splits might crowd the panel.
- Optional workspace config file override.
- Optionally close any existing terminals before launching yours.

## Configuration
Add the following to your settings (User or Workspace):

```json
"autorun.layout": "split", // or "tabs"
"autorun.terminals": [
  { "name": "Convex Dev", "command": "npx convex dev" },
  { "name": "Frontend", "command": "npm run dev" }
],
"autorun.closeExisting": true // dispose any open terminals first
```

### Workspace config file
Place an `autorun.config.json` in the workspace root (or set `"autorun.configPath"` to another path). If present, it overrides the VS Code settings above.

```json
{
  "layout": "tabs",
  "closeExisting": true,
  "terminals": [
    { "name": "API", "command": "npm run api" },
    { "name": "Web", "command": "npm run dev" }
  ]
}
```

## Development
1. Install dependencies: `npm install`
2. Build: `npm run compile` (or `npm run watch` during development)
3. Press `F5` in VS Code to launch the Extension Development Host.

The extension activates on startup and will open/run your configured terminals immediately.
