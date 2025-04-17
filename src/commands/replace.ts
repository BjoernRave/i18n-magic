import type { Configuration } from "../lib/types"
import {
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils"

const getKeyToReplace = async (keys: Record<string, string>) => {
  const keyToReplace = await getTextInput(
    "Enter the key to replace the translation for: ",
  )

  if (!keys[keyToReplace]) {
    console.log(`The key "${keyToReplace}" does not exist.`)
    return await getKeyToReplace(keys)
  }

  console.log(`The key "${keyToReplace}" exists.`)
  return keyToReplace
}

export const replaceTranslation = async (
  config: Configuration,
  key?: string,
) => {
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
  } = config

  const keys = await loadLocalesFile(
    config.loadPath,
    config.defaultLocale,
    config.defaultNamespace,
  )

  let keyToReplace: string

  if (key) {
    if (keys[key]) {
      keyToReplace = key
      console.log(`The key "${keyToReplace}" exists.`)
    } else {
      console.log(`The key "${key}" does not exist.`)
      keyToReplace = await getKeyToReplace(keys)
    }
  } else {
    keyToReplace = await getKeyToReplace(keys)
  }

  console.log(
    `The current translation in ${defaultLocale} for "${keyToReplace}" is "${keys[keyToReplace]}".`,
  )

  const newTranslation = await getTextInput("Enter the new translation: ")

  for (const locale of locales) {
    let newValue = ""
    if (locale === defaultLocale) {
      newValue = newTranslation
    } else {
      const translation = await translateKey({
        context,
        inputLanguage: defaultLocale,
        outputLanguage: locale,
        object: {
          [keyToReplace]: newTranslation,
        },
        openai,
        model: config.model,
      })

      newValue = translation[keyToReplace]
    }

    const existingKeys = await loadLocalesFile(
      loadPath,
      locale,
      defaultNamespace,
    )

    existingKeys[keyToReplace] = newValue

    writeLocalesFile(savePath, locale, defaultNamespace, existingKeys)

    console.log(
      `The new translation for "${keyToReplace}" in ${locale} is "${newValue}".`,
    )
  }
}
