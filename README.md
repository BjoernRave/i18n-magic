# i18n Magic ✨

**The intelligent CLI toolkit that automates your internationalization workflow with AI-powered translations.**

i18n Magic streamlines the entire translation management process for your JavaScript/TypeScript projects. Say goodbye to manually maintaining translation files and hello to automated, context-aware translations that keep your international users happy.

## 🚀 What it does

- **🔍 Smart Detection**: Automatically scans your codebase to find translation keys
- **🤖 AI Translation**: Generates high-quality translations using OpenAI or Gemini models
- **🔄 Sync & Maintain**: Keeps all your locales in perfect sync
- **🧹 Clean & Optimize**: Removes unused translations and creates optimized bundles
- **⚡ CI/CD Ready**: Perfect for automated workflows and deployment pipelines

## 📋 Requirements

- JSON-based i18n libraries (react-i18next, next-i18next, vue-i18n, etc.)
- Node.js 16+
- An OpenAI or Google Gemini API key

## 🛠️ Quick Setup

### 1. Install the package

```bash
npm install -g @scoutello/i18n-magic
# or use directly with npx
npx @scoutello/i18n-magic
```

### 2. Set up your API key

Create a `.env` file in your project root:

```bash
# Choose one:
OPENAI_API_KEY=your_openai_api_key_here
# OR
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Create your configuration

Create an `i18n-magic.js` file in your project root with your project-specific settings:

```js
module.exports = {
  globPatterns: ['./components/**/*.tsx', './pages/**/*.tsx', './lib/**/*.ts'],
  loadPath: 'locales/{{lng}}/{{ns}}.json',
  savePath: 'locales/{{lng}}/{{ns}}.json',
  locales: ['en', 'de'],
  defaultLocale: 'de',
  defaultNamespace: 'common',
  namespaces: ['common', 'forms'],
  context:
    'This is a context which increases the quality of the translations by giving context to the LLM',
  // Optional configurations
  model: 'gemini-2.0-flash-lite', // or any OpenAI/Gemini model like 'gpt-4.1-mini'
  OPENAI_API_KEY: '.', // Alternative to using .env file
  GEMINI_API_KEY: '', // Alternative to using .env file
  disableTranslation: false, // Set to true to skip automatic translations during the scan step. Useful if you want to sync the other languages during CI/CD using sync.
  autoClear: true, // When using the scan command, always run the clean before

  // Optional: Namespace-specific configurations for pruned translations
  pruneNamespaces: [
    {
      sourceNamespace: 'common',
      newNamespace: 'dashboard',
      globPatterns: ['./apps/dashboard/**/*.tsx', './apps/dashboard/**/*.ts'],
    },
    {
      sourceNamespace: 'common',
      newNamespace: 'mobile',
      globPatterns: ['./apps/mobile/**/*.tsx', './apps/mobile/**/*.ts'],
    },
  ],
};
```

### 4. Start using i18n Magic

```bash
# Scan for missing translations and add them
npx @scoutello/i18n-magic scan

# Check what's missing without making changes
npx @scoutello/i18n-magic check-missing

# Sync all locales from your default language
npx @scoutello/i18n-magic sync
```

## 🔧 Advanced Configuration

### Custom Storage Solutions

You can provide custom functions for `loadPath` and `savePath` to store translations in other systems like S3, databases, or CDNs:

```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
})

module.exports = {
  ...
  // Custom load function
  loadPath: async (locale, namespace) => {
    // Example: Load from S3
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: 'my-translations-bucket',
        Key: `locales/${locale}/${namespace}.json`,
      })
    );
    const data = await response.Body.transformToString();
    return JSON.parse(data);
  },

  // Custom save function
  savePath: async (locale, namespace, data) => {
    // Example: Save to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: 'my-translations-bucket',
        Key: `locales/${locale}/${namespace}.json`,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      })
    );
  },
};
```

## 📚 Available Commands

All commands can be run with:

```bash
npx @scoutello/i18n-magic [command]
```

### `scan`

Scan your codebase for missing translations and automatically generate them. This command analyzes your code to find translation keys that don't exist in your translation files yet.

The command will:

1. Scan all files matching your glob patterns for translation usage
2. Identify missing translation keys in your default locale
3. Prompt you to provide translations for each missing key
4. Automatically translate to all other configured locales using AI
5. Save the new translations to your JSON files

This is useful for:

- Adding new translations during development
- Ensuring all translation keys have corresponding values
- Maintaining translation consistency across locales

### `replace`

Update an existing translation key with a new value and automatically translate it to all other locales. This command allows you to modify existing translations while maintaining consistency across all languages.

The command will:

1. Prompt you to select or specify the translation key to replace
2. Ask for the new translation value in your default locale
3. Automatically translate the new value to all other configured locales using AI
4. Update all translation files with the new values

You can specify the key in two ways:

- As a positional argument: `npx @scoutello/i18n-magic replace your.translation.key`
- Using the option flag: `npx @scoutello/i18n-magic replace --key your.translation.key`

If no key is provided, you will be prompted to enter one.

This is useful for:

- Updating existing translations that need changes
- Fixing translation errors across all locales
- Maintaining consistency when modifying content

### `check-missing`

Check if there are any missing translations without making any changes. This command performs a dry-run analysis to identify translation gaps in your project.

The command will:

1. Scan all files matching your glob patterns for translation usage
2. Check if all found translation keys exist in your translation files
3. Report any missing translations without prompting for input
4. Exit with an error code if missing translations are found

This is useful for:

- CI/CD pipelines to ensure translation completeness
- Pre-commit hooks to catch missing translations early
- Quality assurance checks before deployment
- Automated testing of translation coverage

### `sync`

Synchronize translations from your default locale to all other configured locales using AI translation. This command takes existing translations in your default language and generates corresponding translations for all other locales.

The command will:

1. Load all translation keys from your default locale
2. Identify keys that are missing in other locales
3. Automatically translate missing keys using AI
4. Update translation files for all non-default locales
5. Preserve existing translations (only adds missing ones)

This is useful for:

- CI/CD pipelines to ensure all locales are up-to-date
- Batch translation of new content
- Maintaining translation parity across languages
- Automated deployment workflows

**Note**: This command works best when used with `disableTranslation: true` in your config to separate the scanning and translation phases.

### `prune`

Create a pruned namespace from an existing namespace, containing only the translation keys that are actually used in specific files. This is useful for creating optimized translation bundles for different parts of your application (e.g., dashboard, mobile app, etc.).

The command will:

1. Prompt you to select a source namespace to prune from
2. Ask for a name for the new namespace
3. Ask for glob patterns to scan for translation usage
4. Extract all translation keys used in the matched files
5. Create new translation files for all locales containing only the used keys

This is particularly useful for:

- Creating namespace-specific translation bundles
- Reducing bundle size by including only necessary translations
- Optimizing performance in micro-frontends or modular applications

You can also automate this process using the `pruneNamespaces` configuration in your `i18n-magic.js` file (see configuration example above).

### `clean`

Remove unused translation keys from all locales. This command scans your codebase to find which translation keys are actually being used and removes any keys that are no longer referenced in your code.

The command will:

1. Scan all files matching your glob patterns for translation usage
2. Compare found keys with existing translation files
3. Remove unused keys from all locale files
4. Report how many keys were removed

This is useful for:

- Keeping translation files clean and maintainable
- Reducing bundle size by removing dead translations
- Regular maintenance in CI/CD pipelines
