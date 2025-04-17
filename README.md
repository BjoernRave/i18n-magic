# i18n Magic

Your CLI toolkit to help you with managing your translations in your project.

This currently works for JSON based translation systems

To use:

1. Create an API key in your `.env` file (either `OPENAI_API_KEY` or `GEMINI_API_KEY`)
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
  // Optional configurations
  model: 'gemini-2.0-flash-lite', // or any OpenAI/Gemini model like 'gpt-4.1-mini'
  OPENAI_API_KEY: '.', // Alternative to using .env file
  GEMINI_API_KEY: '', // Alternative to using .env file
  disableTranslation: false, // Set to true to skip automatic translations during the scan step. Useful if you want to sync the other languages during CI/CD using sync.
};
```

You can also provide custom functions for `loadPath` and `savePath` to store translations in other systems like S3:

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

then just run:

```bash
npx i18n-magic [command]
```

`scan`

Scan for missing translations, get prompted for each, translate it to the other locales and save it to the JSON file.

`replace`

Replace a translation based on the key, and translate it to the other locales and save it to the JSON file.

`check-missing`

Checks if there are any missing translations. Useful for CI/CD or for a husky hook.

`sync`

Sync the translations from the default locale to the other locales. Useful for a CI/CD pipeline or husky hook. Should be used together with `disableTranslation: true`
