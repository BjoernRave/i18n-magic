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

export interface PruneOptions {
  sourceNamespace: string
  newNamespace: string
  globPatterns: string[]
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface PruneResult {
  locale: string
  keyCount: number
  success: boolean
  error?: string
}

export interface PruneResponse {
  success: boolean
  message: string
  keysCount: number
  results?: PruneResult[]
}

export const createPrunedNamespaceAutomated = async (
  config: Configuration,
  options: PruneOptions,
): Promise<PruneResponse> => {
  const { namespaces, loadPath, savePath, locales, defaultNamespace } = config
  const {
    sourceNamespace,
    newNamespace,
    globPatterns,
    includePatterns = [],
    excludePatterns = [],
  } = options

  // Validate inputs
  if (!namespaces.includes(sourceNamespace)) {
    throw new Error(
      `Source namespace '${sourceNamespace}' not found in configuration`,
    )
  }

  if (namespaces.includes(newNamespace)) {
    throw new Error(`Namespace '${newNamespace}' already exists`)
  }

  console.log(
    `Creating pruned namespace '${newNamespace}' from '${sourceNamespace}'`,
  )
  console.log(`Using glob patterns: ${globPatterns.join(", ")}`)
  if (includePatterns.length > 0) {
    console.log(`Additional include patterns: ${includePatterns.join(", ")}`)
  }
  if (excludePatterns.length > 0) {
    console.log(`Exclude patterns: ${excludePatterns.join(", ")}`)
  }

  // Extract keys from files matching the glob patterns
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  })

  // Combine main patterns with include patterns, and add exclude patterns
  const allIncludePatterns = [...globPatterns, ...includePatterns]
  const allExcludePatterns = [
    "!**/node_modules/**",
    ...excludePatterns.map((pattern) => `!${pattern}`),
  ]
  const finalPatterns = [...allIncludePatterns, ...allExcludePatterns]

  const files = await glob(finalPatterns)
  console.log(`Found ${files.length} files to scan`)

  const extractedKeys = []

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8")
    parser.parseFuncFromString(content, { list: ["t"] }, (key: string) => {
      extractedKeys.push(key)
    })
  }

  const uniqueExtractedKeys = removeDuplicatesFromArray(extractedKeys)
  console.log(`Found ${uniqueExtractedKeys.length} unique translation keys`)

  // Filter keys that belong to the source namespace
  const relevantKeys = []

  for (const key of uniqueExtractedKeys) {
    const pureKey = getPureKey(
      key,
      sourceNamespace,
      sourceNamespace === defaultNamespace,
    )

    if (pureKey) {
      relevantKeys.push(pureKey)
    }
  }

  console.log(
    `Found ${relevantKeys.length} keys from namespace '${sourceNamespace}'`,
  )

  if (relevantKeys.length === 0) {
    console.log("No relevant keys found. Exiting...")
    return {
      success: false,
      message: "No relevant keys found",
      keysCount: 0,
    }
  }

  // Get translations from source namespace and create new namespace files
  const results: PruneResult[] = []

  for (const locale of locales) {
    try {
      // Load source namespace translations
      const sourceTranslations = await loadLocalesFile(
        loadPath,
        locale,
        sourceNamespace,
      )

      // Create new namespace with only the keys used in the glob pattern files
      const newNamespaceTranslations: Record<string, string> = {}

      for (const key of relevantKeys) {
        if (sourceTranslations[key]) {
          newNamespaceTranslations[key] = sourceTranslations[key]
        }
      }

      // Write the new namespace file
      await writeLocalesFile(
        savePath,
        locale,
        newNamespace,
        newNamespaceTranslations,
      )

      const keyCount = Object.keys(newNamespaceTranslations).length
      console.log(
        `Created pruned namespace '${newNamespace}' for locale '${locale}' with ${keyCount} keys`,
      )

      results.push({
        locale,
        keyCount,
        success: true,
      })
    } catch (error) {
      console.error(
        `Error creating pruned namespace for locale '${locale}':`,
        error,
      )
      results.push({
        locale,
        keyCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log(`✅ Successfully created pruned namespace '${newNamespace}'`)

  return {
    success: true,
    message: `Created pruned namespace '${newNamespace}' with ${relevantKeys.length} keys`,
    keysCount: relevantKeys.length,
    results,
  }
}
