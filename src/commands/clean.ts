import prompts from "prompts"
import type { Configuration } from "../lib/types.js"
import {
  getKeysWithNamespaces,
  getPureKey,
  loadLocalesFile,
  writeLocalesFile,
} from "../lib/utils.js"

export interface UnusedKeysReport {
  totalKeys: number
  unusedCount: number
  unusedKeys: Array<{ key: string; namespace: string; locales: string[] }>
}

export const findUnusedKeys = async (
  config: Configuration,
): Promise<UnusedKeysReport> => {
  const { globPatterns, namespaces, defaultNamespace, locales, loadPath } =
    config

  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })

  const keysByNamespace: Record<string, Set<string>> = {}

  for (const { key, namespaces: keyNamespaces } of keysWithNamespaces) {
    for (const namespace of keyNamespaces) {
      if (!keysByNamespace[namespace]) {
        keysByNamespace[namespace] = new Set()
      }

      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)
      const finalKey = pureKey || (!key.includes(":") ? key : null)
      if (finalKey) {
        keysByNamespace[namespace].add(finalKey)
      }
    }
  }

  const unusedKeys: Array<{
    key: string
    namespace: string
    locales: string[]
  }> = []
  let totalKeys = 0

  for (const namespace of namespaces) {
    const usedKeysSet = keysByNamespace[namespace] || new Set()
    const unusedInNamespace: Map<string, string[]> = new Map()

    for (const locale of locales) {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace)

      for (const key of Object.keys(existingKeys)) {
        totalKeys++
        if (!usedKeysSet.has(key)) {
          if (!unusedInNamespace.has(key)) {
            unusedInNamespace.set(key, [])
          }
          unusedInNamespace.get(key)!.push(locale)
        }
      }
    }

    for (const [key, keyLocales] of unusedInNamespace) {
      unusedKeys.push({ key, namespace, locales: keyLocales })
    }
  }

  const uniqueUnusedKeys = new Map<
    string,
    { key: string; namespace: string; locales: string[] }
  >()
  for (const item of unusedKeys) {
    const uniqueKey = `${item.namespace}:${item.key}`
    if (!uniqueUnusedKeys.has(uniqueKey)) {
      uniqueUnusedKeys.set(uniqueKey, item)
    }
  }

  return {
    totalKeys,
    unusedCount: uniqueUnusedKeys.size,
    unusedKeys: Array.from(uniqueUnusedKeys.values()),
  }
}

export const removeUnusedKeys = async (
  config: Configuration,
  options?: { skipConfirmation?: boolean },
) => {
  const {
    globPatterns,
    namespaces,
    defaultNamespace,
    locales,
    loadPath,
    savePath,
  } = config

  console.log("🔍 Scanning for unused translation keys...\n")

  const report = await findUnusedKeys(config)

  if (report.unusedCount === 0) {
    console.log(
      `✅ No unused keys found in the project (${report.totalKeys} total key instances across all locales)`,
    )
    return
  }

  console.log(`\n⚠️  Found ${report.unusedCount} unused translation key(s):\n`)

  const maxKeysToShow = 20
  const keysToShow = report.unusedKeys.slice(0, maxKeysToShow)

  for (const { key, namespace } of keysToShow) {
    console.log(`   • ${namespace}:${key}`)
  }

  if (report.unusedKeys.length > maxKeysToShow) {
    console.log(`   ... and ${report.unusedKeys.length - maxKeysToShow} more`)
  }

  console.log("")

  if (!options?.skipConfirmation) {
    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Do you want to remove these ${report.unusedCount} unused key(s)?`,
      initial: false,
    })

    if (!confirmed) {
      console.log("\n❌ Operation cancelled. No keys were removed.")
      return
    }
  }

  console.log("\n🗑️  Removing unused keys...")

  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })

  const keysByNamespace: Record<string, Set<string>> = {}

  for (const { key, namespaces: keyNamespaces } of keysWithNamespaces) {
    for (const namespace of keyNamespaces) {
      if (!keysByNamespace[namespace]) {
        keysByNamespace[namespace] = new Set()
      }

      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)
      const finalKey = pureKey || (!key.includes(":") ? key : null)
      if (finalKey) {
        keysByNamespace[namespace].add(finalKey)
      }
    }
  }

  const stats = {
    total: 0,
    removed: 0,
  }

  const results = await Promise.all(
    namespaces.flatMap((namespace) => {
      const usedKeysSet = keysByNamespace[namespace] || new Set()

      return locales.map(async (locale) => {
        const existingKeys = await loadLocalesFile(loadPath, locale, namespace)
        const existingKeysCount = Object.keys(existingKeys).length

        const cleanedKeys: Record<string, string> = {}
        let removedCount = 0

        for (const [key, value] of Object.entries(existingKeys)) {
          if (usedKeysSet.has(key)) {
            cleanedKeys[key] = value
          } else {
            removedCount++
          }
        }

        if (removedCount > 0) {
          await writeLocalesFile(savePath, locale, namespace, cleanedKeys)
          console.log(
            `   ✓ Removed ${removedCount} unused keys from ${locale}:${namespace} (${
              Object.keys(cleanedKeys).length
            } keys remaining)`,
          )
        }

        return { total: existingKeysCount, removed: removedCount }
      })
    }),
  )

  for (const result of results) {
    stats.total += result.total
    stats.removed += result.removed
  }

  console.log(
    `\n✅ Removed ${stats.removed} unused keys (out of ${stats.total} total keys)`,
  )
}
