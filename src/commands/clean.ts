import glob from "fast-glob"
import { Parser } from "i18next-scanner"
import fs from "node:fs"
import type { Configuration } from "../lib/types"
import {
  getPureKey,
  loadLocalesFile,
  removeDuplicatesFromArray,
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

  // Set up the parser
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  })

  // Find all files to scan
  const files = await glob([...globPatterns, "!**/node_modules/**"])

  // Extract all translation keys from the codebase
  const extractedKeys = []
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8")
    parser.parseFuncFromString(content, { list: ["t"] }, (key: string) => {
      extractedKeys.push(key)
    })
  }

  // Remove duplicates
  const uniqueExtractedKeys = removeDuplicatesFromArray(extractedKeys)

  // Track stats for reporting
  const stats = {
    total: 0,
    removed: 0,
  }

  // Process each namespace and locale
  for (const namespace of namespaces) {
    // Build a set of pure keys that are actually used in the codebase for this namespace
    const usedKeysSet = new Set<string>()

    for (const key of uniqueExtractedKeys) {
      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)
      if (pureKey) {
        usedKeysSet.add(pureKey)
      }
    }

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
