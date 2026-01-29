import type { Configuration } from "../lib/types.js"
import {
  checkAllKeysExist,
  findExistingTranslations,
  getMissingKeys,
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils.js"
import { findUnusedKeys, removeUnusedKeys } from "./clean.js"

export const translateMissing = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    namespaces,
    locales,
    context,
    openai,
    disableTranslationDuringScan,
    autoClear,
  } = config

  if (autoClear) {
    console.log("🧹 Checking for unused translations before scanning...")
    const report = await findUnusedKeys(config)

    if (report.unusedCount > 0) {
      await removeUnusedKeys(config)
      console.log("")
    } else {
      console.log("✅ No unused keys found.\n")
    }
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

  // Check for existing translations in parallel
  const keysList = newKeys.map((k) => k.key)
  const existingTranslationResults = await findExistingTranslations(
    keysList,
    namespaces,
    defaultLocale,
    loadPath,
  )

  const reusedKeys: string[] = []
  for (const newKey of newKeys) {
    const existingValue = existingTranslationResults[newKey.key]

    let answer: string
    // Use explicit null check instead of truthy check to handle empty string values
    if (existingValue !== null) {
      reusedKeys.push(newKey.key)
      answer = existingValue
    } else {
      answer = await getTextInput(newKey.key, newKey.namespaces)
    }

    newKeysWithDefaultLocale.push({
      key: newKey.key,
      namespace: newKey.namespace,
      namespaces: newKey.namespaces,
      value: answer,
    })
  }

  // Batch log reused keys
  if (reusedKeys.length > 0) {
    console.log(
      `🔄 Auto-reused ${reusedKeys.length} existing values from other namespaces`,
    )
  }

  const newKeysObject = newKeysWithDefaultLocale.reduce((prev, next) => {
    prev[next.key] = next.value

    return prev
  }, {})

  const allLocales = disableTranslationDuringScan ? [defaultLocale] : locales

  // Batch translate for all non-default locales in parallel
  const translationCache: Record<string, Record<string, string>> = {
    [defaultLocale]: newKeysObject,
  }

  const nonDefaultLocales = allLocales.filter((l) => l !== defaultLocale)
  if (nonDefaultLocales.length > 0) {
    await Promise.all(
      nonDefaultLocales.map(async (locale) => {
        const translatedValues = await translateKey({
          inputLanguage: defaultLocale,
          outputLanguage: locale,
          context,
          object: newKeysObject,
          openai,
          model: config.model,
        })
        translationCache[locale] = translatedValues
      }),
    )
  }

  // Process all locale/namespace combinations in parallel
  const writeResults: Array<{
    locale: string
    namespace: string
    keyCount: number
  }> = []
  await Promise.all(
    allLocales.flatMap((locale) =>
      namespaces.map(async (namespace) => {
        const existingKeys = await loadLocalesFile(loadPath, locale, namespace)

        const relevantKeys = newKeysWithDefaultLocale.filter((key) =>
          key.namespaces?.includes(namespace),
        )

        if (relevantKeys.length === 0) {
          return
        }

        const translatedValues = translationCache[locale]
        for (const key of relevantKeys) {
          existingKeys[key.key] = translatedValues[key.key]
        }

        await writeLocalesFile(savePath, locale, namespace, existingKeys)
        writeResults.push({ locale, namespace, keyCount: relevantKeys.length })
      }),
    ),
  )

  // Log where keys were written
  for (const { locale, namespace, keyCount } of writeResults) {
    console.log(`   📝 Wrote ${keyCount} key(s) to ${locale}/${namespace}.json`)
  }

  await checkAllKeysExist(config)

  console.log(`Successfully translated ${newKeys.length} keys.`)
}
