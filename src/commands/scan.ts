import { input } from '@inquirer/prompts';
import glob from 'fast-glob';
import fs from 'fs';
import { Parser } from 'i18next-scanner';

import { Configuration } from '../lib/types';
import {
  getPureKey,
  loadLocalesFile,
  removeDuplicatesFromArray,
  translateKey,
  writeLocalesFile,
} from '../lib/utils';

export const translateMissing = async ({
  loadPath,
  savePath,
  defaultLocale,
  defaultNamespace,
  namespaces,
  locales,
  globPatterns,
  context,
  openai,
}: Configuration) => {
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  });

  const files = await glob(globPatterns);

  const keys = [];
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    parser.parseFuncFromString(
      content,
      { list: ['t'] },
      function (key, options) {
        keys.push(key);
      }
    );
  });

  const uniqueKeys = removeDuplicatesFromArray(keys);

  const newKeys = [];

  for (const namespace of namespaces) {
    const existingKeys = loadLocalesFile(loadPath, defaultLocale, namespace);

    for (const key of uniqueKeys) {
      const pureKey = getPureKey(
        key,
        namespace,
        namespace === defaultNamespace
      );

      if (!pureKey) {
        continue;
      }

      if (!existingKeys[pureKey]) {
        newKeys.push({ key: pureKey, namespace });
      }
    }
  }

  if (newKeys.length === 0) {
    console.log('No new keys found.');
    return;
  }

  console.log(
    `Please provide the values for the following keys in ${defaultLocale}:`
  );

  const newKeysWithDefaultLocale = [];

  for (const newKey of newKeys) {
    const answer = await input({ message: newKey.key });

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
