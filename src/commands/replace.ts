import type { Configuration } from "../lib/types.js"
import {
  getKeysWithNamespaces,
  getPureKey,
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils.js"

const getKeyToReplace = async (
  allAvailableKeys: Record<string, { namespace: string; value: string }[]>,
): Promise<{ key: string; namespaces: string[] }> => {
  const keyToReplace = await getTextInput(
    "Enter the key to replace the translation for: ",
  )

  if (!allAvailableKeys[keyToReplace]) {
    console.log(`The key "${keyToReplace}" does not exist.`)
    return await getKeyToReplace(allAvailableKeys)
  }

  const namespaces = allAvailableKeys[keyToReplace].map((k) => k.namespace)
  console.log(
    `The key "${keyToReplace}" exists in namespaces: ${namespaces.join(", ")}.`,
  )
  return { key: keyToReplace, namespaces }
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

  // Find all keys with their namespaces from the codebase
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })

  // Build a map of all available keys across all namespaces
  const allAvailableKeys: Record<
    string,
    { namespace: string; value: string }[]
  > = {}

  const namespaceKeysResults = await Promise.all(
    namespaces.map(async (namespace) => ({
      namespace,
      keys: await loadLocalesFile(loadPath, defaultLocale, namespace),
    }))
  )

  for (const { namespace, keys } of namespaceKeysResults) {
    for (const [keyName, value] of Object.entries(keys)) {
      if (!allAvailableKeys[keyName]) {
        allAvailableKeys[keyName] = []
      }
      allAvailableKeys[keyName].push({ namespace, value })
    }
  }

  let keyToReplace: string
  let targetNamespaces: string[] = []

  if (key) {
    if (allAvailableKeys[key]) {
      keyToReplace = key
      // Determine which namespaces this key should be updated in based on usage
      const keyUsage = keysWithNamespaces.filter((k) => {
        const pureKey = getPureKey(k.key, defaultNamespace, true)
        return pureKey === key || k.key === key
      })

      if (keyUsage.length > 0) {
        // Use namespaces from actual usage
        const allNamespaces: string[] = []
        for (const k of keyUsage) {
          allNamespaces.push(...k.namespaces)
        }
        targetNamespaces = [...new Set(allNamespaces)]
      } else {
        // Fallback to all namespaces where the key exists
        targetNamespaces = allAvailableKeys[key].map((k) => k.namespace)
      }

      console.log(
        `The key "${keyToReplace}" exists in namespaces: ${targetNamespaces.join(", ")}.`,
      )
    } else {
      console.log(`The key "${key}" does not exist.`)
      const result = await getKeyToReplace(allAvailableKeys)
      keyToReplace = result.key
      targetNamespaces = result.namespaces
    }
  } else {
    const result = await getKeyToReplace(allAvailableKeys)
    keyToReplace = result.key
    targetNamespaces = result.namespaces
  }

  // Show current translations across namespaces
  const currentTranslations = await Promise.all(
    targetNamespaces.map(async (namespace) => {
      const keys = await loadLocalesFile(loadPath, defaultLocale, namespace)
      return { namespace, value: keys[keyToReplace] }
    })
  )

  for (const { namespace, value } of currentTranslations) {
    if (value) {
      console.log(
        `Current translation in ${defaultLocale} (${namespace}): "${value}"`,
      )
    }
  }

  const newTranslation = await getTextInput("Enter the new translation: ")

  // Batch translate for all non-default locales first
  const translationCache: Record<string, string> = {
    [defaultLocale]: newTranslation,
  }

  const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)
  if (nonDefaultLocales.length > 0) {
    await Promise.all(
      nonDefaultLocales.map(async (locale) => {
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
        translationCache[locale] = translation[keyToReplace]
      })
    )
  }

  // Update the key in all relevant namespaces and locales in parallel
  await Promise.all(
    targetNamespaces.flatMap((namespace) =>
      locales.map(async (locale) => {
        const newValue = translationCache[locale]
        const existingKeys = await loadLocalesFile(loadPath, locale, namespace)
        existingKeys[keyToReplace] = newValue
        await writeLocalesFile(savePath, locale, namespace, existingKeys)

        console.log(
          `Updated "${keyToReplace}" in ${locale} (${namespace}): "${newValue}"`,
        )
      })
    )
  )
}
