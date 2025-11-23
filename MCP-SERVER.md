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
- **Update Translation Keys**: Update existing translation keys with new values (auto-translates to all languages)
- **Search Translations**: Fuzzy search across both keys and values to find existing translations
- **Get Translation Value**: Retrieve the English value for any translation key
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

### get_translation_key

Retrieves the English value for a specific translation key.

**Parameters:**
- `key` (required): The translation key to retrieve (e.g., "welcomeMessage")
- `namespace` (optional): Namespace to search in. If not provided, searches default namespace first, then all namespaces

**Example Usage:**

```typescript
// Get a key from any namespace
{
  "key": "welcomeMessage"
}

// Or specify the namespace
{
  "key": "welcomeMessage",
  "namespace": "common"
}
```

**Response Format:**

```json
{
  "success": true,
  "key": "welcomeMessage",
  "value": "Welcome to our application!",
  "namespace": "common",
  "locale": "en"
}
```

**Important Notes:**
- Always returns the English translation
- Use this to check if a key exists before adding or updating it
- Great for verifying current translations

### update_translation_key

Updates an existing translation key with a new English value and automatically translates it to all configured locales.

**Parameters:**
- `key` (required): The translation key to update (e.g., "welcomeMessage")
- `value` (required): The new English text value
- `namespace` (optional): Namespace to update. If not provided, updates the key in all namespaces where it exists

**Example Usage:**

```typescript
// Update a key across all namespaces where it exists
{
  "key": "welcomeMessage",
  "value": "Welcome to our awesome application!"
}

// Or update in a specific namespace only
{
  "key": "welcomeMessage",
  "value": "Welcome to our awesome application!",
  "namespace": "common"
}
```

**Response Format:**

```json
{
  "success": true,
  "message": "Successfully updated translation key 'welcomeMessage' in 2 namespace(s) and 4 locale(s)",
  "key": "welcomeMessage",
  "newValue": "Welcome to our awesome application!",
  "namespaces": ["common", "mobile"],
  "locales": ["en", "de", "es", "fr"]
}
```

**Important Notes:**
- **Automatically translates** the new value to all configured locales using AI
- Updates the key in all namespaces where it exists (unless you specify a namespace)
- Use this to fix typos, improve wording, or change existing translations
- If you're not sure if a key exists, use `get_translation_key` or `search_translations` first
- No need to run `sync` afterwards - translation happens immediately

**When to use:**
- Fix typos in existing translations
- Improve wording or clarity
- Update outdated text
- Change tone or style of existing translations

### search_translations

Search for translations by keyword or phrase using fuzzy matching. Searches both translation keys AND their English values across ALL namespaces.

**Parameters:**
- `query` (required): Search term to find in keys or values (e.g., "password", "welcome", "click")

**Example Usage:**

```typescript
// Search across all namespaces
{
  "query": "password"
}

// Search for button text
{
  "query": "click"
}
```

**Response Format:**

```json
{
  "success": true,
  "message": "Found 3 translations matching 'password' (showing first 50)",
  "query": "password",
  "totalResults": 3,
  "results": [
    {
      "key": "passwordTooShort",
      "value": "Password is too short",
      "namespace": "common",
      "matchType": "both"
    },
    {
      "key": "passwordComplexity",
      "value": "Password must contain uppercase, lowercase, and numbers",
      "namespace": "auth",
      "matchType": "both"
    },
    {
      "key": "resetPassword",
      "value": "Reset your password",
      "namespace": "auth",
      "matchType": "key"
    }
  ],
  "hasMore": false,
  "tip": "Each result shows the translation key, English value, namespace, and what matched (key, value, or both). Use these keys directly in your code or use get_translation_key for more details."
}
```

**Match Types:**
- `"both"`: Query found in both the key name and the value
- `"key"`: Query found only in the key name
- `"value"`: Query found only in the English text value

**Important Notes:**
- **Fuzzy search**: Doesn't need exact matches, finds partial matches
- Searches both key names and English values
- Results are sorted: exact matches first, then by match type, then alphabetically
- Limited to 50 results to prevent overwhelming output
- Case-insensitive search

**When to use:**
- **Before adding new translations**: Check if similar text already exists to avoid duplicates
- Find the key name when you only remember part of the text
- Discover related translations (e.g., all password-related keys)
- Verify consistency across translations
- Find keys to update or reuse

**Example workflow:**
```typescript
// 1. User wants to add "Please enter your password"
// 2. First search to check for existing similar translations
{
  "query": "password"
}

// 3. Results show: "passwordPlaceholder": "Enter your password"
// 4. Decide to either:
//    - Reuse the existing key
//    - Update the existing key with update_translation_key
//    - Add a new, more specific key with add_translation_key
```

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

### Workflow 1: Adding New Keys (With Duplicate Prevention)
1. **LLM Detects Need**: While coding, the LLM identifies that a translation is needed
2. **Search First**: The LLM calls `search_translations` to check if similar text already exists
3. **Decision Point**:
   - **If similar key exists**: Reuse the existing key or update it with `update_translation_key`
   - **If no match found**: Add new key with `add_translation_key`
4. **Sync (if needed)**: If you used `add_translation_key`, run `i18n-magic sync` to translate to other locales
5. **Use in Code**: The translation key is now available in all languages

### Workflow 2: Updating Existing Keys
1. **Find the Key**: Use `search_translations` or `get_translation_key` to find the key to update
2. **Update via MCP**: The LLM calls `update_translation_key` with the new English value
3. **Automatic Translation**: The tool automatically translates to all configured locales (no sync needed!)
4. **Use in Code**: Updated translation is immediately available in all languages

### Workflow 3: Batch Checking Missing Keys
1. **Check for Missing Keys**: The LLM calls `list_untranslated_keys` to get a complete list
2. **Review Results**: See all missing keys grouped by namespace
3. **Add Keys**: Use `add_translation_key` for each missing key or run `i18n-magic scan`
4. **Sync Translations**: Run `i18n-magic sync` to translate all new keys

### Workflow 4: Exploring Existing Translations
1. **Search**: Use `search_translations` with a keyword to see what translations exist
2. **Review**: Browse through results to find relevant keys
3. **Get Details**: Use `get_translation_key` for more details on specific keys
4. **Use or Update**: Either use the existing key or update it if needed

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

### Example 2: Searching Before Adding (Best Practice)

Here's what happens when the LLM searches first to avoid duplicates:

```
1. User asks: "Add translation for 'Please enter your password'"
2. LLM calls search_translations first:
   {
     "query": "enter password"
   }
3. Server responds:
   {
     "success": true,
     "message": "Found 2 translations matching 'enter password'",
     "results": [
       {
         "key": "passwordPlaceholder",
         "value": "Enter your password",
         "namespace": "auth",
         "matchType": "both"
       },
       {
         "key": "passwordFieldLabel",
         "value": "Password",
         "namespace": "auth",
         "matchType": "value"
       }
     ]
   }
4. LLM sees "passwordPlaceholder" exists with similar text
5. LLM suggests: "I found an existing key 'passwordPlaceholder' with value 'Enter your password'. 
   Would you like to use this key or create a new one?"
6. Avoids duplicate translations!
```

### Example 3: Updating a Translation

Here's what happens when fixing a typo or improving wording:

```
1. User says: "Fix the welcome message, it should say 'Welcome back!' instead"
2. LLM calls search_translations:
   {
     "query": "welcome"
   }
3. Finds key: "welcomeMessage": "Welcome to our app"
4. LLM calls update_translation_key:
   {
     "key": "welcomeMessage",
     "value": "Welcome back!"
   }
5. Server responds:
   {
     "success": true,
     "message": "Successfully updated translation key 'welcomeMessage' in 1 namespace(s) and 4 locale(s)",
     "key": "welcomeMessage",
     "newValue": "Welcome back!",
     "namespaces": ["common"],
     "locales": ["en", "de", "es", "fr"]
   }
6. Key is immediately updated in ALL languages (no sync needed!)
7. English: "Welcome back!"
   German: "Willkommen zurück!"
   Spanish: "¡Bienvenido de nuevo!"
   French: "Bienvenue de retour!"
```

### Example 4: Checking for Missing Keys

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

- `add_translation_key` only adds keys to English; run `sync` to translate to other languages
- `update_translation_key` automatically translates to all configured languages (no sync needed!)
- `search_translations` performs fuzzy search on both keys and values to help find existing translations
- `get_translation_key` retrieves the English value for any key
- All keys are always stored in the English (`en`) locale as the source
- The server uses your existing i18n-magic configuration for namespaces, load paths, and save paths

## Best Practices

1. **Always search before adding**: Use `search_translations` to check if similar text already exists
2. **Use update for changes**: When modifying existing text, use `update_translation_key` instead of manually editing files
3. **Let AI handle translation**: Both `add_translation_key` + `sync` and `update_translation_key` use AI to maintain consistency across languages
4. **Namespace awareness**: Let the tool auto-detect namespaces, or specify when you need precise control

