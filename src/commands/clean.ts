import type { Configuration } from "../lib/types"
import {
  getKeysWithNamespaces,
  getPureKey,
  loadLocalesFile,
  writeLocalesFile,
} from "../lib/utils"

export const removeUnusedKeys = async (config: Configuration) => {
  const {
    globPatterns,
    namespaces,
    defaultNamespace,
    locales,
    loadPath,
    savePath,
  } = config

  // Get all keys with their associated namespaces from the codebase
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })

  // Track stats for reporting
  const stats = {
    total: 0,
    removed: 0,
  }

  // Group keys by namespace
  const keysByNamespace: Record<string, Set<string>> = {}

  for (const { key, namespaces: keyNamespaces } of keysWithNamespaces) {
    for (const namespace of keyNamespaces) {
      if (!keysByNamespace[namespace]) {
        keysByNamespace[namespace] = new Set()
      }

      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)
      if (pureKey) {
        keysByNamespace[namespace].add(pureKey)
      }
    }
  }

  // Process each namespace and locale
  for (const namespace of namespaces) {
    const usedKeysSet = keysByNamespace[namespace] || new Set()

    // Process each locale
    for (const locale of locales) {
      // Load existing keys for this locale and namespace
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace)
      const existingKeysCount = Object.keys(existingKeys).length
      stats.total += existingKeysCount

      // Create a new object with only the keys that are used
      const cleanedKeys: Record<string, string> = {}
      let removedCount = 0

      for (const [key, value] of Object.entries(existingKeys)) {
        if (usedKeysSet.has(key)) {
          cleanedKeys[key] = value
        } else {
          removedCount++
        }
      }

      stats.removed += removedCount

      // Only write the file if keys were removed
      if (removedCount > 0) {
        await writeLocalesFile(savePath, locale, namespace, cleanedKeys)
        console.log(
          `✓ Removed ${removedCount} unused keys from ${locale}:${namespace} (${
            Object.keys(cleanedKeys).length
          } keys remaining)`,
        )
      } else {
        console.log(`No unused keys found in ${locale}:${namespace}`)
      }
    }
  }

  if (stats.removed > 0) {
    console.log(
      `✅ Removed ${stats.removed} unused keys (out of ${stats.total} total keys)`,
    )
  } else {
    console.log(
      `✅ No unused keys found in the project (${stats.total} total keys)`,
    )
  }
}
