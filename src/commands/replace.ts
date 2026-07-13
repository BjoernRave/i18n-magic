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

export const replaceTranslationValue = async ({
  config,
  key,
  value,
  targetNamespaces,
}: {
  config: Configuration
  key: string
  value: string
  targetNamespaces: string[]
}) => {
  const { loadPath, savePath, defaultLocale, locales, context, openai } = config
  const stagedFiles = new Map<string, Record<string, string>>()
  await Promise.all(
    targetNamespaces.flatMap((namespace) =>
      locales.map(async (locale) => {
        const existingKeys = await loadLocalesFile(
          loadPath,
          locale,
          namespace,
        )
        stagedFiles.set(JSON.stringify([locale, namespace]), {
          ...existingKeys,
        })
      }),
    ),
  )

  const translationCache: Record<string, string> = {
    [defaultLocale]: value,
  }
  await Promise.all(
    locales
      .filter((locale) => locale !== defaultLocale)
      .map(async (locale) => {
        const translation = await translateKey({
          context,
          inputLanguage: defaultLocale,
          outputLanguage: locale,
          object: { [key]: value },
          openai,
          model: config.model,
        })
        translationCache[locale] = translation[key]
      }),
  )

  for (const namespace of targetNamespaces) {
    for (const locale of locales) {
      const staged = stagedFiles.get(JSON.stringify([locale, namespace]))
      if (!staged) {
        throw new Error(
          `Internal error: no staged snapshot for ${locale}/${namespace}.`,
        )
      }
      staged[key] = translationCache[locale]
    }
  }

  for (const namespace of targetNamespaces) {
    for (const locale of locales) {
      await writeLocalesFile(
        savePath,
        locale,
        namespace,
        stagedFiles.get(JSON.stringify([locale, namespace]))!,
      )
    }
  }
}

export const replaceTranslation = async (
  config: Configuration,
  key?: string,
) => {
  const {
    loadPath,
    defaultLocale,
    defaultNamespace,
    namespaces,
    locales,
    globPatterns,
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
    })),
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
    }),
  )

  for (const { namespace, value } of currentTranslations) {
    if (value) {
      console.log(
        `Current translation in ${defaultLocale} (${namespace}): "${value}"`,
      )
    }
  }

  const newTranslation = await getTextInput("Enter the new translation: ")
  await replaceTranslationValue({
    config,
    key: keyToReplace,
    value: newTranslation,
    targetNamespaces,
  })

  console.log(
    `Updated "${keyToReplace}" in ${targetNamespaces.length} namespace(s) and ${locales.length} locale(s).`,
  )
}
