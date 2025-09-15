import type { Configuration } from "../lib/types.js"
import {
  checkAllKeysExist,
  getMissingKeys,
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils.js"
import { removeUnusedKeys } from "./clean.js"

export const translateMissing = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    namespaces,
    locales,
    context,
    openai,
    disableTranslation,
    autoClear,
  } = config

  // Run clean command first if autoClear is enabled
  if (autoClear) {
    console.log("🧹 Auto-clearing unused translations before scanning...")
    await removeUnusedKeys(config)
    console.log(
      "✅ Auto-clear completed. Now scanning for missing translations...\n",
    )
  }

  const newKeys = await getMissingKeys(config)

  if (newKeys.length === 0) {
    console.log("No new keys found.")

    await checkAllKeysExist(config)

    return
  }

  console.log(
    `${newKeys.length} keys are missing. Please provide the values for the following keys in ${defaultLocale}:`,
  )

  const newKeysWithDefaultLocale = []

  for (const newKey of newKeys) {
    const answer = await getTextInput(newKey.key)

    newKeysWithDefaultLocale.push({
      key: newKey.key,
      namespace: newKey.namespace,
      value: answer,
    })
  }

  const newKeysObject = newKeysWithDefaultLocale.reduce((prev, next) => {
    prev[next.key] = next.value

    return prev
  }, {})

  const allLocales = disableTranslation ? [defaultLocale] : locales

  for (const locale of allLocales) {
    let translatedValues = {}

    if (locale === defaultLocale) {
      translatedValues = newKeysObject
    } else {
      translatedValues = await translateKey({
        inputLanguage: defaultLocale,
        outputLanguage: locale,
        context,
        object: newKeysObject,
        openai,
        model: config.model,
      })
    }

    for (const namespace of namespaces) {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace)

      const relevantKeys = newKeysWithDefaultLocale.filter(
        (key) => key.namespace === namespace,
      )

      if (relevantKeys.length === 0) {
        continue
      }

      for (const key of relevantKeys) {
        existingKeys[key.key] = translatedValues[key.key]
      }

      writeLocalesFile(savePath, locale, namespace, existingKeys)
    }
  }

  await checkAllKeysExist(config)

  console.log(`Successfully translated ${newKeys.length} keys.`)
}
