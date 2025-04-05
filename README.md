# i18n Magic

Your CLI toolkit to help you with managing your translations in your project.

This currently works for JSON based translation systems

To use:

1. Create a `OPENAI_API_KEY` in your `.env` file
2. Create a config file, called `i18n-magic.js` in your project root.

The content of the file should look something like this:

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
};
```

then just run:

```bash
npx i18n-magic [command]
```

`scan`

Scan for missing translations, get prompted for each, translate it to the other locales and save it to the JSON file.

`replace`

Replace a translation based on the key, and translate it to the other locales and save it to the JSON file.

`check-missing`

Checks if there are any missing translations. Useful for CI/CD or for a husky hook
