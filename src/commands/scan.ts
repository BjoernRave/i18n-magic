import { Configuration } from '../lib/types';
import {
  getMissingKeys,
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from '../lib/utils';

export const translateMissing = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    namespaces,
    locales,
    context,
    openai,
  } = config;

  const newKeys = await getMissingKeys(config);

  if (newKeys.length === 0) {
    console.log('No new keys found.');
    return;
  }

  console.log(
    `Please provide the values for the following keys in ${defaultLocale}:`
  );

  const newKeysWithDefaultLocale = [];

  for (const newKey of newKeys) {
    const answer = await getTextInput(newKey.key);

    newKeysWithDefaultLocale.push({
      key: newKey.key,
      namespace: newKey.namespace,
      value: answer,
    });
  }

  const newKeysObject = newKeysWithDefaultLocale.reduce((prev, next) => {
    return {
      ...prev,
      [next.key]: next.value,
    };
  }, {});

  for (const locale of locales) {
    let translatedValues = {};

    if (locale === defaultLocale) {
      translatedValues = newKeysObject;
    } else {
      translatedValues = await translateKey({
        inputLanguage: defaultLocale,
        outputLanguage: locale,
        context,
        object: newKeysObject,
        openai,
      });
    }

    for (const namespace of namespaces) {
      const existingKeys = loadLocalesFile(loadPath, locale, namespace);

      const relevantKeys = newKeysWithDefaultLocale.filter(
        (key) => key.namespace === namespace
      );

      if (relevantKeys.length === 0) {
        continue;
      }

      for (const key of relevantKeys) {
        existingKeys[key.key] = translatedValues[key.key];
      }

      writeLocalesFile(savePath, locale, namespace, existingKeys);
    }
  }

  console.log(`Successfully translated ${newKeys.length} keys.`);
};
