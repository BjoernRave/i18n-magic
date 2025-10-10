# Quick Setup Guide for Cursor

This guide will help you set up the i18n-magic MCP server with Cursor for this specific project.

## Step 1: Build the MCP Server

From this directory, run:

```bash
pnpm run build
```

## Step 2: Configure Cursor

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Navigate to **Features** → **Model Context Protocol**
3. Click **Edit Config** or **Add Server**
4. Add this configuration:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["/Users/bjoernrave/projects/i18n-magic/dist/mcp-server.js"],
    "cwd": "/Users/bjoernrave/projects/i18n-magic"
  }
}
```

**Note**: These paths are specific to this project. If you're setting this up elsewhere, update both paths accordingly.

## Step 3: Test the Setup

1. Restart Cursor to load the new MCP server
2. Open the example-app directory
3. Try asking Cursor to add a translation key
4. The AI should now be able to use the `add_translation_key` tool

## Step 4: Verify Translation Was Added

After the AI adds a translation key, check:

```bash
cd example-app
cat locales/en/common.json  # or the appropriate namespace file
```

## Step 5: Sync to Other Languages

Once keys are added, sync them to other languages:

```bash
cd example-app
npx @scoutello/i18n-magic sync
```

## Troubleshooting

### MCP Server Not Showing Up

- Make sure you've built the project (`pnpm run build`)
- Verify the paths in your MCP configuration are absolute paths
- Restart Cursor completely

### Configuration Not Found Error

- Ensure the `cwd` path points to a directory containing `i18n-magic.js`
- For the example app, the `cwd` should be `/Users/bjoernrave/projects/i18n-magic/example-app`

### Permission Errors

```bash
chmod +x /Users/bjoernrave/projects/i18n-magic/dist/mcp-server.js
```

## Example Usage

Once set up, you can ask Cursor things like:

- "Add a translation key for the welcome message"
- "I need a translation key called 'error.notFound' with value 'Page not found'"
- "Add a translation for the user profile page to the dashboard namespace"

The AI will use the MCP server to add these keys automatically!




