import prompts from 'prompts';
import { Configuration } from '../lib/types';
import { loadLocalesFile, translateKey, writeLocalesFile } from '../lib/utils';

const getKeyToReplace = async (keys: any) => {
  const keyToReplace = await prompts({
    name: 'value',
    type: 'text',
    message: 'Enter the key to replace the translation for: ',
  });

  if (!keys[keyToReplace.value]) {
    console.log(`The key "${keyToReplace}" does not exist.`);
    return await getKeyToReplace(keys);
  } else {
    console.log(`The key "${keyToReplace}" exists.`);
    return keyToReplace;
  }
};

export const replaceTranslation = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    defaultNamespace,
    namespaces,
    locales,
    globPatterns,
    context,
    openai,
  } = config;

  const keys = loadLocalesFile(
    config.loadPath,
    config.defaultLocale,
    config.defaultNamespace
  );

  const keyToReplace = await getKeyToReplace(keys);

  console.log(
    `The current translation in ${defaultLocale} for "${keyToReplace}" is "${keys[keyToReplace]}".`
  );

  const newTranslation = await prompts({
    message: `Enter the new translation: `,
    name: 'value',
    type: 'text',
  });

  for (const locale of locales) {
    let newValue = '';
    if (locale === defaultLocale) {
      newValue = newTranslation.value;
    } else {
      const translation = await translateKey({
        context,
        inputLanguage: defaultLocale,
        outputLanguage: locale,
        object: {
          [keyToReplace]: newTranslation.value,
        },
        openai,
      });

      newValue = translation[keyToReplace];
    }

    const existingKeys = loadLocalesFile(loadPath, locale, defaultNamespace);

    existingKeys[keyToReplace] = newValue;

    writeLocalesFile(savePath, locale, defaultNamespace, existingKeys);

    console.log(
      `The new translation for "${keyToReplace}" in ${locale} is "${newValue}".`
    );
  }
};
