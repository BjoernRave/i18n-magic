# i18n Magic ✨

**The intelligent CLI toolkit that automates your internationalization workflow with AI-powered translations.**

Stop context switching. Let AI handle your translations while you stay in your code editor.

## 🚀 What it does

- **🔍 Smart Detection**: Automatically scans your codebase to find translation keys
- **🤖 AI Translation**: Generates high-quality translations using OpenAI or Gemini models
- **🔄 Sync & Maintain**: Keeps all your locales in perfect sync
- **🧹 Clean & Optimize**: Removes unused translations and creates optimized bundles
- **⚡ CI/CD Ready**: Perfect for automated workflows and deployment pipelines
- **🔌 MCP Integration**: Connect with Cursor and other LLMs to add translation keys on the fly

## 📋 Requirements

- JSON-based i18n libraries (react-i18next, next-i18next, vue-i18n, etc.)
- Node.js 16+
- An OpenAI or Google Gemini API key

## Why This Matters

**Traditional workflow**: 40+ minutes and 13 context switches to add 10 keys across 4 languages.

**With i18n-magic + AI agents**: 2.5 minutes, zero context switches. Stay in flow.

---

## CLI Commands

```bash
npx @scoutello/i18n-magic scan          # Find & add missing translations
npx @scoutello/i18n-magic sync          # Translate to all languages
npx @scoutello/i18n-magic replace [key] # Update existing translation
npx @scoutello/i18n-magic clean         # Remove unused keys
npx @scoutello/i18n-magic check-missing # CI/CD validation
```

**`scan`** - Scans your codebase for missing keys, prompts you for values, auto-translates to all locales.

**`sync`** - Takes your default locale translations and translates missing keys to other locales. Perfect for CI/CD.

**`replace`** - Update an existing translation key across all locales. Detects which namespaces use the key automatically.

**`clean`** - Removes unused translation keys from all locales. Great for keeping files lean.

**`check-missing`** - Dry-run check. Exits with error code if translations are missing. Perfect for CI pipelines.

### Namespace Organization (for large apps)

```javascript
// i18n-magic.js
globPatterns: [
  './src/shared/**/*.tsx',              // → common.json
  { pattern: './src/dashboard/**/*.tsx', namespaces: ['dashboard'] },
  { pattern: './src/mobile/**/*.tsx', namespaces: ['mobile'] }
]
```

Result: Separate files per feature (`common.json`, `dashboard.json`, `mobile.json`) across all locales.

---

## The MCP Server: AI Superpowers

**MCP (Model Context Protocol)** = API for AI agents.

Install the i18n-magic MCP server in Cursor, and your AI gets 5 new tools:

### 1. `search_translations` - Prevent Duplicates
Fuzzy search across all translations. AI searches before adding anything.

### 2. `add_translation_key` - Add New Keys  
Adds key to English (`en`) locale. Run `sync` afterward to translate to other languages.

### 3. `get_translation_key` - Check What Exists
Retrieve current value for any key.

### 4. `update_translation_key` - Fix & Auto-Translate
Update a key and **instantly translate to all languages**. No sync needed!

### 5. `list_untranslated_keys` - Batch Check
Show all missing keys across your codebase.

---

## Quick Setup (5 Minutes)

### 1. Install

```bash
npm install @scoutello/i18n-magic
```

### 2. Create `i18n-magic.js` in project root

```javascript
module.exports = {
  globPatterns: ['./src/**/*.{ts,tsx,js,jsx}'],
  loadPath: 'locales/{{lng}}/{{ns}}.json',
  savePath: 'locales/{{lng}}/{{ns}}.json',
  locales: ['en', 'de', 'es', 'fr'],
  defaultLocale: 'en',
  namespaces: ['common'],
  defaultNamespace: 'common',
  context: 'Your app description here',
  model: 'gpt-4o-mini', // or 'gemini-2.0-flash-lite'
  
  // Optional: Auto-clean before scanning
  autoClear: true,
  
  // Optional: Skip translation during scan (translate later with sync)
  disableTranslationDuringScan: false,
}
```

**Key options**:
- `context`: Describe your app/domain. Better context = better translations.
- `autoClear`: Auto-remove unused keys before scanning.
- `disableTranslationDuringScan`: Set `true` to only add English during scan, then use `sync` command for translations.

### 3. Add API key to `.env`

```bash
OPENAI_API_KEY=sk-your-key-here
```

### 4. Configure MCP in Cursor

Settings → Features → Model Context Protocol:

```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"]
  }
}
```

### 5. Restart Cursor

Done! Test by asking: *"Search for translations with 'password'"*

---

## How to Use It

### Pattern 1: Adding Translations (Search First!)

**You**: "Add a submit button"

**AI**:
1. Searches existing translations for "submit"
2. Finds `submitButton: "Submit"` already exists
3. Suggests reusing it
4. Generates: `<Button>{t('submitButton')}</Button>`

**Result**: No duplicate keys, instant code.

If nothing exists:
- AI adds key to English: `add_translation_key`
- You run: `npx @scoutello/i18n-magic sync`
- Translated to all languages!

### Pattern 2: Updating Translations

**You**: "Change welcome message to 'Welcome back!'"

**AI**:
1. Finds the key via search
2. Calls `update_translation_key`
3. **Auto-translates to ALL languages instantly**

No sync needed!

### Pattern 3: Batch Check

**You**: "What translations are missing?"

**AI**: Calls `list_untranslated_keys`, shows you the list.

Add them now or during development. Your choice.

---

## Real Example

Building a UserProfile component:

**You**: "Replace 'User Profile' with translation"

**AI**:
- Searches for "user profile"
- Nothing found
- Adds: `profile.title: "User Profile"` to en/dashboard.json
- Updates code: `<h1>{t('profile.title')}</h1>`

**You**: "Add translations for labels"

**AI**:
- Searches "email" → finds `emailLabel` in common
- Reuses existing key (no duplicate!)
- Searches "full name" → nothing found
- Adds new: `profile.fullNameLabel: "Full Name"`

**You run**:
```bash
npx @scoutello/i18n-magic sync
```

**Result**: All keys now in EN, DE, ES, FR. Took 2 minutes.

Later: **"Change title to 'Your Profile'"**

**AI**: Calls `update_translation_key` → instantly updated in all 4 languages. No sync needed!

---

## Pro Tips

### Better Translations with Context

```javascript
// Generic → Okay
context: 'Web application'

// Specific → Much better!
context: 'E-commerce for outdoor gear. Friendly tone. Target: adventurers.'
```

More context = better AI translations.

### CI/CD: Auto-translate on PR

```yaml
# .github/workflows/auto-translate.yml
on:
  pull_request:
    paths: ['locales/en/**/*.json']

jobs:
  translate:
    steps:
      - run: npx @scoutello/i18n-magic sync
      - run: git commit -am "chore: auto-translate"
```

English changes → auto-translated → committed. Zero manual work.

### Namespace Strategy

- **<100 keys**: Single `common.json`
- **100-500 keys**: Split by feature (`auth`, `dashboard`)  
- **500+ keys**: Feature-based with auto-assignment (see setup section)

### Custom Storage Solutions

Store translations anywhere (S3, databases, CDNs):

```javascript
// Example: S3 storage
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  }
})

module.exports = {
  loadPath: async (locale, namespace) => {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: 'my-translations-bucket',
        Key: `locales/${locale}/${namespace}.json`,
      })
    )
    const data = await response.Body.transformToString()
    return JSON.parse(data)
  },
  
  savePath: async (locale, namespace, data) => {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: 'my-translations-bucket',
        Key: `locales/${locale}/${namespace}.json`,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      })
    )
  },
  // ... other config
}
```

---

## Troubleshooting

### MCP Connection Error

**Error**: `MCP error -32000: Connection closed`

**Fix**: Use auto-detection (no `cwd` needed):
```json
{
  "i18n-magic": {
    "command": "node",
    "args": ["./node_modules/@scoutello/i18n-magic/dist/mcp-server.js"]
  }
}
```

**Still broken?** Check `i18n-magic.js` exists in project root:
```bash
ls -la i18n-magic.js
```

### Translations Not Working

**Problem**: Keys added but not translated.

**Fix**: Run sync!
```bash
npx @scoutello/i18n-magic sync
```

`add_translation_key` only adds English. `sync` translates to other languages.

### MCP Tools Not Appearing

1. Restart Cursor after adding MCP config
2. Check Settings → Features → MCP shows "i18n-magic" as Connected
3. Test: Ask AI to *"search translations for 'password'"*

---

## Get Started Now

1. `npm install @scoutello/i18n-magic`
2. Create `i18n-magic.js` config (see setup section)
3. Add `OPENAI_API_KEY` to `.env`
4. Configure MCP in Cursor
5. Start coding. AI handles translations.

**5 minutes to set up. Hours saved every week.**

### Links

- **MCP Details**: [MCP-SERVER.md](./MCP-SERVER.md)
- **Example App**: [example-app/](./example-app/)
- **GitHub**: [github.com/BjoernRave/i18n-magic](https://github.com/BjoernRave/i18n-magic)
- **NPM**: [@scoutello/i18n-magic](https://www.npmjs.com/package/@scoutello/i18n-magic)

---

*Never context switch for translations again. 🌍*
