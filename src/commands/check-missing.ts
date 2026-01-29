import type { Configuration } from "../lib/types.js"
import {
  getMissingKeys,
  findExistingTranslations,
  loadLocalesFile,
  writeLocalesFile,
  translateKey,
} from "../lib/utils.js"

export const checkMissing = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    namespaces,
    locales,
    context,
    openai,
    model,
    disableTranslationDuringScan,
  } = config

  const newKeys = await getMissingKeys(config)

  if (newKeys.length === 0) {
    console.log("✅ No missing translations found.")
    return
  }

  console.log(`\n🔍 Found ${newKeys.length} missing key(s) in default locale (${defaultLocale}):`)
  
  // Group keys by namespace for clearer output
  const keysByNamespace: Record<string, string[]> = {}
  for (const key of newKeys) {
    for (const ns of key.namespaces) {
      if (!keysByNamespace[ns]) {
        keysByNamespace[ns] = []
      }
      keysByNamespace[ns].push(key.key)
    }
  }
  
  for (const [namespace, keys] of Object.entries(keysByNamespace)) {
    console.log(`\n   📦 ${namespace}: ${keys.length} missing key(s)`)
    for (const key of keys) {
      console.log(`      - ${key}`)
    }
  }

  // Try to auto-fill from other namespaces (like scan does)
  const keysList = newKeys.map((k) => k.key)
  const existingTranslationResults = await findExistingTranslations(
    keysList,
    namespaces,
    defaultLocale,
    loadPath,
  )

  const keysWithValues: Array<{
    key: string
    namespaces: string[]
    value: string | null
  }> = []

  const reusedKeys: string[] = []
  const stillMissingKeys: string[] = []

  for (const newKey of newKeys) {
    const existingValue = existingTranslationResults[newKey.key]
    
    if (existingValue !== null) {
      reusedKeys.push(newKey.key)
      keysWithValues.push({
        key: newKey.key,
        namespaces: newKey.namespaces,
        value: existingValue,
      })
    } else {
      stillMissingKeys.push(newKey.key)
      keysWithValues.push({
        key: newKey.key,
        namespaces: newKey.namespaces,
        value: null,
      })
    }
  }

  // If we can auto-fill some keys, do it
  if (reusedKeys.length > 0) {
    console.log(`\n🔄 Auto-reusing ${reusedKeys.length} existing value(s) from other namespaces...`)
    
    const keysToWrite = keysWithValues.filter((k) => k.value !== null)
    const newKeysObject = keysToWrite.reduce((prev, next) => {
      prev[next.key] = next.value as string
      return prev
    }, {} as Record<string, string>)

    const allLocales = disableTranslationDuringScan ? [defaultLocale] : locales

    // Batch translate for all non-default locales in parallel
    const translationCache: Record<string, Record<string, string>> = {
      [defaultLocale]: newKeysObject,
    }

    const nonDefaultLocales = allLocales.filter((l) => l !== defaultLocale)
    if (nonDefaultLocales.length > 0 && !disableTranslationDuringScan) {
      console.log(`   📝 Translating to ${nonDefaultLocales.length} other locale(s)...`)
      await Promise.all(
        nonDefaultLocales.map(async (locale) => {
          const translatedValues = await translateKey({
            inputLanguage: defaultLocale,
            outputLanguage: locale,
            context,
            object: newKeysObject,
            openai,
            model,
          })
          translationCache[locale] = translatedValues
        })
      )
    }

    // Process all locale/namespace combinations in parallel
    await Promise.all(
      allLocales.flatMap((locale) =>
        namespaces.map(async (namespace) => {
          const existingKeys = await loadLocalesFile(loadPath, locale, namespace)

          const relevantKeys = keysToWrite.filter((key) =>
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
          console.log(`   ✅ Updated ${locale}/${namespace}.json with ${relevantKeys.length} key(s)`)
        })
      )
    )

    console.log(`\n✅ Successfully auto-filled ${reusedKeys.length} key(s) from existing translations.`)
  }

  // Now check if there are still missing keys that couldn't be auto-filled
  if (stillMissingKeys.length > 0) {
    console.error(`\n❌ Error: ${stillMissingKeys.length} translation(s) could not be auto-filled:`)
    for (const key of stillMissingKeys) {
      console.error(`   - ${key}`)
    }
    console.error(`\nPlease run 'i18n-magic scan' to provide values for these keys.`)
    process.exit(1)
  }

  console.log("\n✅ All translations are complete.")
}
