import type { Configuration } from "../lib/types.js"
import {
  getKeysWithNamespaces,
  getPureKey,
  loadLocalesFile,
  writeLocalesFile,
  findExistingTranslations,
} from "../lib/utils.js"

export const restoreFromNamespaces = async (config: Configuration) => {
  const {
    globPatterns,
    namespaces,
    defaultNamespace,
    locales,
    loadPath,
    savePath,
    defaultLocale,
  } = config

  console.log("🔄 Starting restoration from other namespaces...\n")

  // Get all keys with their associated namespaces from the codebase
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })

  // Group keys by namespace
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

  // Track stats for reporting
  const stats = {
    totalMissing: 0,
    restored: 0,
    notFound: 0,
  }

  // Process each namespace
  for (const namespace of namespaces) {
    const expectedKeys = keysByNamespace[namespace] || new Set()
    
    if (expectedKeys.size === 0) {
      console.log(`⏭️  Skipping ${namespace}: no keys expected in codebase\n`)
      continue
    }

    console.log(`📦 Processing namespace: ${namespace}`)
    console.log(`   Expected keys in codebase: ${expectedKeys.size}`)

    // Load existing keys for default locale in this namespace
    const existingKeys = await loadLocalesFile(loadPath, defaultLocale, namespace)
    const existingKeysSet = new Set(Object.keys(existingKeys))

    // Find missing keys
    const missingKeys = Array.from(expectedKeys).filter(
      (key) => !existingKeysSet.has(key)
    )

    if (missingKeys.length === 0) {
      console.log(`   ✅ No missing keys in ${namespace}\n`)
      continue
    }

    console.log(`   ❌ Missing keys: ${missingKeys.length}`)
    stats.totalMissing += missingKeys.length

    // Search for these keys in other namespaces
    const otherNamespaces = namespaces.filter((ns) => ns !== namespace)
    
    console.log(`   🔍 Searching in: ${otherNamespaces.join(", ")}`)

    // For each locale, find and restore missing keys
    const restoredByLocale: Record<string, number> = {}

    for (const locale of locales) {
      const existingTranslations = await findExistingTranslations(
        missingKeys,
        otherNamespaces,
        locale,
        loadPath,
        { silent: true }
      )

      // Count how many we found
      const foundKeys = Object.entries(existingTranslations).filter(
        ([_, value]) => value !== null
      )

      if (foundKeys.length === 0) {
        continue
      }

      // Load the current namespace file for this locale
      const currentKeys = await loadLocalesFile(loadPath, locale, namespace)

      // Add the found keys
      for (const [key, value] of foundKeys) {
        if (value !== null) {
          currentKeys[key] = value
        }
      }

      // Save the updated file
      await writeLocalesFile(savePath, locale, namespace, currentKeys)
      restoredByLocale[locale] = foundKeys.length

      // Track stats (only count once per key, not per locale)
      if (locale === defaultLocale) {
        stats.restored += foundKeys.length
      }
    }

    // Log results
    const restoredInDefault = restoredByLocale[defaultLocale] || 0
    const stillMissing = missingKeys.length - restoredInDefault
    stats.notFound += stillMissing

    console.log(`   ✅ Restored: ${restoredInDefault} keys across ${Object.keys(restoredByLocale).length} locales`)
    if (stillMissing > 0) {
      console.log(`   ⚠️  Still missing: ${stillMissing} keys (not found in any namespace)`)
    }
    console.log("")
  }

  // Final summary
  console.log("=" .repeat(60))
  console.log("📊 Restoration Summary:")
  console.log(`   Total missing keys found: ${stats.totalMissing}`)
  console.log(`   Successfully restored: ${stats.restored}`)
  console.log(`   Not found in any namespace: ${stats.notFound}`)
  
  if (stats.notFound > 0) {
    console.log(`\n💡 Next steps:`)
    console.log(`   Run 'pnpm trans' to add the ${stats.notFound} missing keys manually`)
  } else {
    console.log("\n✨ All keys successfully restored!")
  }
}
