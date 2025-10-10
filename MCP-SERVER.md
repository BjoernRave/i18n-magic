# i18n-magic MCP Server

This document explains how to set up and use the i18n-magic MCP (Model Context Protocol) server with Cursor or other MCP-compatible tools.

## Quick Start

**For local installation (recommended):**

1. Install i18n-magic in your project: `npm install @scoutello/i18n-magic`
2. Add to Cursor MCP settings:

**Simple Configuration (Works Automatically - Recommended):**
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"]
  }
}
```

That's it! The server will automatically detect your project root by traversing up from `node_modules` to find your `i18n-magic.js` config file.

3. Restart Cursor

**Advanced Options (Only if auto-detection doesn't work):**

If you need to manually specify the project root, you can use one of these options:

**Option A: Using `cwd` parameter**
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "cwd": "/absolute/path/to/YOUR/project"
  }
}
```

**Option B: Using `--project-root` argument**
```json
{
  "i18n-magic": {
    "command": "node",
    "args": [
      "./node_modules/@scoutello/i18n-magic/dist/mcp-server.js",
      "--project-root",
      "/absolute/path/to/YOUR/project"
    ]
  }
}
```

**Option C: Using environment variable**
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "env": {
      "I18N_MCP_PROJECT_ROOT": "/absolute/path/to/YOUR/project"
    }
  }
}
```

## Overview

The i18n-magic MCP server allows LLMs to add missing translation keys directly to your translation files. When the LLM identifies a missing translation key while coding, it can use the MCP server to add the key with an English value, which can then be translated to other languages using the existing `sync` command.

## Features

- **Add Translation Keys**: Add new translation keys with English values
- **List Missing Keys**: Scan your codebase to identify all untranslated keys
- **Namespace Support**: Automatically uses the default namespace or specify a custom one
- **Configuration Integration**: Reads from your existing `i18n-magic.js` configuration file
- **Sync Ready**: Added keys are ready to be translated using the `sync` command

## Setup

### Prerequisites

1. You must have an `i18n-magic.js` configuration file in your project root
2. Build the project to compile the MCP server:

```bash
pnpm run build
```

### Connecting to Cursor

1. Open Cursor settings (Cmd/Ctrl + ,)
2. Navigate to "Features" → "Model Context Protocol"
3. Add a new MCP server with one of the following configurations:

#### Option 1: Using `cwd` parameter (Recommended)

This is the most reliable method - Cursor will start the server in the correct directory:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "cwd": "/absolute/path/to/your/project"
  }
}
```

#### Option 2: Using `--project-root` CLI argument

Pass the project root as a command-line argument:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": [
      "./node_modules/@scoutello/i18n-magic/dist/mcp-server.js",
      "--project-root",
      "/absolute/path/to/your/project"
    ]
  }
}
```

#### Option 3: Using environment variable

Set the project root via the `I18N_MCP_PROJECT_ROOT` environment variable:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "env": {
      "I18N_MCP_PROJECT_ROOT": "/absolute/path/to/your/project"
    }
  }
}
```

#### Option 4: Global installation with `cwd`

If you've installed globally:

```json
{
  "i18n-magic": {
    "command": "i18n-magic-mcp",
    "cwd": "/absolute/path/to/your/project"
  }
}
```

**⚠️ CRITICAL**: 
- The `cwd` (current working directory) **must** point to **YOUR PROJECT DIRECTORY** where the `i18n-magic.js` config file exists
- **DO NOT** set `cwd` to the i18n-magic package directory - it needs to point to where you use i18n-magic
- Use absolute paths for the `cwd` parameter
- The MCP server will fail with "Connection closed" if it cannot find your `i18n-magic.js` config file

### Example Configurations

#### Global Installation
If you installed globally with `npm install -g @scoutello/i18n-magic`:

```json
{
  "i18n-magic": {
    "command": "i18n-magic-mcp",
    "cwd": "/Users/username/projects/my-app"
  }
}
```

Note: `my-app` is YOUR project directory (where you use translations), not the i18n-magic package.

#### Local Project Installation
If you have it in your project's `node_modules`:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "cwd": "/Users/username/projects/my-app"
  }
}
```

Note: The `args` path is relative to your project (`my-app`), while `cwd` points to your project directory.

#### Real World Example
If your project is at `/Users/jane/projects/ecommerce-site` and you installed i18n-magic locally:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "cwd": "/Users/jane/projects/ecommerce-site"
  }
}
```

Your project structure should look like:
```
/Users/jane/projects/ecommerce-site/
├── i18n-magic.js                    ← Config file (MCP server looks here)
├── locales/
│   ├── en/
│   └── de/
└── node_modules/
    └── @scoutello/
        └── i18n-magic/
            └── dist/
                └── mcp-server.js    ← MCP server executable
```

## Available Tools

### add_translation_key

Adds a new translation key with an English value to the locale files.

**Parameters:**
- `key` (required): The translation key to add (e.g., "welcomeMessage", "error.notFound")
- `value` (required): The English text value for this translation key
- `namespace` (optional): The namespace to add the key to. If not provided, uses the default namespace from your config

**Example Usage:**

```typescript
// The LLM can call this tool when it detects a missing translation key
{
  "key": "dashboard.welcomeMessage",
  "value": "Welcome to your dashboard!",
  "namespace": "dashboard"
}
```

**Important Notes:**
- The key is **always** added to the `en` (English) locale, regardless of your `defaultLocale` configuration
- This ensures consistency since the MCP tool always provides English values
- After adding keys, run `i18n-magic sync` to translate them to other locales

### list_untranslated_keys

Lists all translation keys that are used in the codebase but are not yet defined in the locale files. This helps identify missing translations that need to be added.

**Parameters:**
- `namespace` (optional): The namespace to check. If not provided, checks all namespaces

**Example Usage:**

```typescript
// Check all namespaces for missing keys
{}

// Or check a specific namespace
{
  "namespace": "dashboard"
}
```

**Response Format:**

```json
{
  "success": true,
  "message": "Found 3 missing translation keys",
  "totalMissingKeys": 3,
  "namespaces": [
    {
      "namespace": "common",
      "missingKeyCount": 2,
      "keys": [
        "welcomeMessage",
        "goodbyeMessage"
      ]
    },
    {
      "namespace": "dashboard",
      "missingKeyCount": 1,
      "keys": [
        "statsTitle"
      ]
    }
  ],
  "nextSteps": [
    "Use add_translation_key to add these keys with English values",
    "Or run 'i18n-magic scan' to add them interactively"
  ]
}
```

**Important Notes:**
- This tool scans your entire codebase for translation keys (t() and t.rich() calls)
- It compares found keys against the default locale to identify missing translations
- Use this to get a complete overview of what needs to be translated before adding keys individually

## Workflow

### Workflow 1: Adding Individual Keys
1. **LLM Detects Missing Key**: While coding, the LLM identifies that a translation key is missing
2. **Add Key via MCP**: The LLM calls `add_translation_key` to add the English version
3. **Sync Translations**: Run `i18n-magic sync` to translate the key to all other configured locales
4. **Use in Code**: The translation key is now available in all languages

### Workflow 2: Batch Checking Missing Keys
1. **Check for Missing Keys**: The LLM calls `list_untranslated_keys` to get a complete list
2. **Review Results**: See all missing keys grouped by namespace
3. **Add Keys**: Use `add_translation_key` for each missing key or run `i18n-magic scan`
4. **Sync Translations**: Run `i18n-magic sync` to translate all new keys

## Testing the Server

You can test the MCP server manually by running:

```bash
cd /path/to/your/project
pnpm run mcp
```

The server will start and wait for MCP protocol messages on stdin/stdout.

## Troubleshooting

### Error: "MCP error -32000: Connection closed"

This is the most common error and usually means the MCP server crashed on startup. The most likely causes:

**1. Configuration file not found**

The MCP server automatically detects your project root by searching for `i18n-magic.js` starting from the script location and traversing upward. This should work automatically when installed in `node_modules`.

If auto-detection fails, the server will try these in order:
1. `--project-root` CLI argument (highest priority)
2. `I18N_MCP_PROJECT_ROOT` environment variable
3. Auto-detection (searches up from script location for `i18n-magic.js`)
4. `cwd` parameter in MCP config (lowest priority)

**Try the simple configuration first** (should work automatically):
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"]
  }
}
```

If auto-detection doesn't work, you can manually specify the project root:

Example using `cwd` parameter:
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "cwd": "/Users/yourname/projects/your-actual-project"
  }
}
```

Example using `--project-root` argument:
```json
{
  "i18n-magic": {
    "command": "node",
    "args": [
      "./node_modules/@scoutello/i18n-magic/dist/mcp-server.js",
      "--project-root",
      "/Users/yourname/projects/your-actual-project"
    ]
  }
}
```

Example using environment variable:
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"],
    "env": {
      "I18N_MCP_PROJECT_ROOT": "/Users/yourname/projects/your-actual-project"
    }
  }
}
```

**2. Verify i18n-magic.js exists**
- Make sure `i18n-magic.js` exists in your project root directory
- Use `ls -la /path/to/your/project/i18n-magic.js` to verify
- Check the MCP server logs to see which directory it's using and whether auto-detection worked

**3. Invalid configuration**
- Verify your `i18n-magic.js` exports a valid configuration object
- Check for syntax errors in the configuration file

### Configuration Not Found
If you see "Failed to load i18n-magic configuration", ensure:
- Your `i18n-magic.js` file exists in the `cwd` specified in your MCP configuration
- The `cwd` path is absolute and points to YOUR project (not the i18n-magic package)
- The configuration file exports a valid configuration object
- Test by running: `cd /your/cwd/path && node -e "console.log(require('./i18n-magic.js'))"`

### Namespace Errors
If you get namespace validation errors:
- Check that the namespace exists in your `i18n-magic.js` config's `namespaces` array
- Use the default namespace by omitting the `namespace` parameter

### Permission Errors
If the MCP server fails to start:
- Ensure the `dist/mcp-server.js` file is executable: `chmod +x dist/mcp-server.js`
- Check that Node.js is available in your PATH

### Testing Your Configuration
To verify your MCP configuration is correct:

```bash
# Navigate to your project directory (the one with i18n-magic.js)
cd /path/to/your/project

# Test that the config loads
node -e "console.log(require('./i18n-magic.js'))"

# Test running the MCP server manually
node ./node_modules/@scoutello/i18n-magic/dist/mcp-server.js
# You should see: "[i18n-magic MCP] Server started and ready to accept connections"
```

## Example Sessions

### Example 1: Adding a Single Key

Here's what happens when the LLM uses the MCP server to add a key:

```
1. LLM identifies missing key: "user.profileUpdated"
2. LLM calls add_translation_key:
   {
     "key": "user.profileUpdated",
     "value": "Your profile has been updated successfully",
     "namespace": "common"
   }
3. Server responds:
   {
     "success": true,
     "message": "Successfully added translation key 'user.profileUpdated' to en/common",
     "key": "user.profileUpdated",
     "value": "Your profile has been updated successfully",
     "namespace": "common",
     "locale": "en",
     "nextStep": "Run 'i18n-magic sync' to translate this key to other locales"
   }
4. You run: i18n-magic sync
5. Key is now available in all configured locales
```

### Example 2: Checking for Missing Keys

Here's what happens when checking for all missing translations:

```
1. LLM calls list_untranslated_keys: {}
2. Server responds:
   {
     "success": true,
     "message": "Found 5 missing translation keys",
     "totalMissingKeys": 5,
     "namespaces": [
       {
         "namespace": "common",
         "missingKeyCount": 3,
         "keys": [
           "cancelButton",
           "confirmButton",
           "welcomeMessage"
         ]
       },
       {
         "namespace": "dashboard",
         "missingKeyCount": 2,
         "keys": [
           "statsTitle",
           "userCount"
         ]
       }
     ],
     "nextSteps": [
       "Use add_translation_key to add these keys with English values",
       "Or run 'i18n-magic scan' to add them interactively"
     ]
   }
3. LLM can then add each key individually using add_translation_key
4. You run: i18n-magic sync
5. All keys are now available in all configured locales
```

## Notes

- The MCP server only adds keys; it does not translate them
- Translation happens when you run the `sync` command
- Keys are always added to the English (`en`) locale first
- The server uses your existing i18n-magic configuration for namespaces, load paths, and save paths

