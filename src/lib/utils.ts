import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import glob from "fast-glob"
import { Parser } from "i18next-scanner"
import { minimatch } from "minimatch"
import type OpenAI from "openai"
import prompts from "prompts"
import { languages } from "./languges.js"
import type { Configuration, GlobPatternConfig } from "./types.js"

export const loadConfig = async ({
  configPath = "i18n-magic.js",
}: {
  configPath?: string
} = {}) => {
  const filePath = path.join(process.cwd(), configPath)

  if (!fs.existsSync(filePath)) {
    console.error("Config file does not exist:", filePath)
    process.exit(1)
  }

  try {
    // Use dynamic import for ESM compatibility
    const configModule = await import(`file://${filePath}`)
    const config = configModule.default || configModule
    // Validate config if needed
    return config
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isModuleNotFound =
      errorMessage.includes("MODULE_NOT_FOUND") ||
      errorMessage.includes("Cannot find module")

    console.error("Error while loading config:", error)

    if (isModuleNotFound) {
      console.error("\n💡 Tip: This error usually occurs when:")
      console.error(
        "   1. Your config file imports dependencies that aren't installed",
      )
      console.error(
        "   2. Dependencies are installed but have missing peer dependencies",
      )
      console.error(
        "   3. You're using a custom storage solution (e.g., AWS S3) without proper dependencies",
      )
      console.error("\n   To fix:")
      console.error(
        "   - Check if your config file imports any external packages",
      )
      console.error(
        "   - Ensure all dependencies are properly installed: pnpm install",
      )
      console.error(
        "   - If using AWS SDK, ensure all @smithy/* peer dependencies are installed",
      )
    }

    process.exit(1)
  }
}

export function removeDuplicatesFromArray<T>(arr: T[]): T[] {
  return arr.filter((item, index) => arr.indexOf(item) === index)
}

/**
 * Extracts translation keys using regex fallback when parser fails (e.g., with JSX)
 * Handles both t("key") and t.rich("key") patterns
 */
const extractKeysWithRegex = (content: string): string[] => {
  const keys: string[] = []

  // Regex patterns for t() and t.rich() calls
  // This matches: t("key"), t('key'), t.rich("key"), t.rich('key'), t(`key`)
  const patterns = [
    /\bt\s*\(\s*["'`]([^"'`]+)["'`]/g, // t("key") or t('key') or t(`key`)
    /\bt\.rich\s*\(\s*["'`]([^"'`]+)["'`]/g, // t.rich("key") or t.rich('key') or t.rich(`key`)
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      keys.push(match[1])
    }
  }

  return keys
}

export const translateKey = async ({
  inputLanguage,
  context,
  object,
  openai,
  outputLanguage,
  model,
  onProgress,
}: {
  object: Record<string, string>
  context: string
  inputLanguage: string
  outputLanguage: string
  model: string
  openai: OpenAI
  onProgress?: (completed: number, total: number) => void
}) => {
  // Split object into chunks of 100 keys
  const entries = Object.entries(object)
  const chunks: Array<[string, string][]> = []

  for (let i = 0; i < entries.length; i += 100) {
    chunks.push(entries.slice(i, i + 100))
  }

  let result: Record<string, string> = {}

  const existingInput = languages.find((l) => l.value === inputLanguage)
  const existingOutput = languages.find((l) => l.value === outputLanguage)

  const input = existingInput?.label || inputLanguage
  const output = existingOutput?.label || outputLanguage

  // Translate each chunk
  let completedKeys = 0
  const totalKeys = entries.length

  for (const chunk of chunks) {
    const chunkObject = Object.fromEntries(chunk)
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          content: `You are a bot that translates the values of a locales JSON. ${
            context
              ? `The user provided some additional context or guidelines about what to fill in the blanks: "${context}". `
              : ""
          }The user provides you a JSON with a field named "inputLanguage", which defines the language the values of the JSON are defined in. It also has a field named "outputLanguage", which defines the language you should translate the values to. The last field is named "data", which includes the object with the values to translate. The keys of the values should never be changed. You output only a JSON, which has the same keys as the input, but with translated values. I give you an example input: {"inputLanguage": "English", outputLanguage: "German", "keys": {"hello": "Hello", "world": "World"}}. The output should be {"hello": "Hallo", "world": "Welt"}.`,
          role: "system",
        },
        {
          content: JSON.stringify({
            inputLanguage: input,
            outputLanguage: output,
            data: chunkObject,
          }),
          role: "user",
        },
      ],
      response_format: {
        type: "json_object",
      },
    })

    const translatedChunk = JSON.parse(
      completion.choices[0].message.content,
    ) as Record<string, string>

    // Merge translated chunk with result
    result = { ...result, ...translatedChunk }

    // Report progress
    completedKeys += chunk.length
    if (onProgress) {
      onProgress(completedKeys, totalKeys)
    }

    // Optional: Add a small delay between chunks to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return result
}

export const loadLocalesFile = async (
  loadPath:
    | string
    | ((locale: string, namespace: string) => Promise<Record<string, string>>),
  locale: string,
  namespace: string,
  options?: { silent?: boolean },
) => {
  const silent = options?.silent ?? false

  if (typeof loadPath === "string") {
    const resolvedPath = loadPath
      .replace("{{lng}}", locale)
      .replace("{{ns}}", namespace)

    // Check if file exists, return empty object if it doesn't
    if (!fs.existsSync(resolvedPath)) {
      if (!silent) {
        console.log(`📄 Creating new namespace file: ${resolvedPath}`)
      }
      return {}
    }

    const content = fs.readFileSync(resolvedPath, "utf-8")
    try {
      const json = JSON.parse(content)
      return json as Record<string, string>
    } catch (error) {
      throw new TranslationError(
        `Invalid JSON in locale file for ${locale}:${namespace}. Path: ${resolvedPath}`,
        locale,
        namespace,
        error instanceof Error ? error : undefined,
      )
    }
  }

  return loadPath(locale, namespace)
}

export const writeLocalesFile = async (
  savePath:
    | string
    | ((
        locale: string,
        namespace: string,
        data: Record<string, string>,
      ) => Promise<void>),
  locale: string,
  namespace: string,
  data: Record<string, string>,
) => {
  if (typeof savePath === "string") {
    const resolvedSavePath = savePath
      .replace("{{lng}}", locale)
      .replace("{{ns}}", namespace)

    // Ensure directory exists
    const dir = path.dirname(resolvedSavePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(resolvedSavePath, JSON.stringify(data, null, 2))

    return
  }

  await savePath(locale, namespace, data)
}

export const getPureKey = (
  key: string,
  namespace?: string,
  isDefault?: boolean,
) => {
  const splitted = key.split(":")

  if (splitted.length === 1) {
    if (isDefault) {
      return key
    }

    return null
  }

  if (splitted[0] === namespace) {
    return splitted[1]
  }

  return null
}

/**
 * Extracts all glob patterns from the configuration, handling both string and object formats
 */
export const extractGlobPatterns = (
  globPatterns: (string | GlobPatternConfig)[],
): string[] => {
  return globPatterns.map((pattern) =>
    typeof pattern === "string" ? pattern : pattern.pattern,
  )
}

/**
 * Gets the namespaces associated with a specific file path based on glob pattern configuration
 */
export const getNamespacesForFile = (
  filePath: string,
  globPatterns: (string | { pattern: string; namespaces: string[] })[],
  defaultNamespace: string,
): string[] => {
  const matchingNamespaces: string[] = []

  // Normalize the file path - remove leading ./ if present
  const normalizedFilePath = filePath.replace(/^\.\//, "")

  for (const pattern of globPatterns) {
    if (typeof pattern === "object") {
      // Normalize the pattern - remove leading ./ if present
      const normalizedPattern = pattern.pattern.replace(/^\.\//, "")

      // Try matching with both the original and normalized paths/patterns
      const isMatch =
        minimatch(filePath, pattern.pattern) ||
        minimatch(normalizedFilePath, pattern.pattern) ||
        minimatch(filePath, normalizedPattern) ||
        minimatch(normalizedFilePath, normalizedPattern)

      // Debug logging to help identify the issue
      if (process.env.DEBUG_NAMESPACE_MATCHING) {
        console.log(
          `Checking file: ${filePath} (normalized: ${normalizedFilePath})`,
        )
        console.log(
          `Against pattern: ${pattern.pattern} (normalized: ${normalizedPattern})`,
        )
        console.log(`Match result: ${isMatch}`)
        console.log(`Namespaces: ${pattern.namespaces.join(", ")}`)
        console.log("---")
      }

      if (isMatch) {
        matchingNamespaces.push(...pattern.namespaces)
      }
    }
  }

  // If no specific namespaces found, use default namespace
  return matchingNamespaces.length > 0
    ? [...new Set(matchingNamespaces)]
    : [defaultNamespace]
}

/**
 * Gets all glob patterns that should be used for a specific namespace
 */
export const getGlobPatternsForNamespace = (
  namespace: string,
  globPatterns: (string | { pattern: string; namespaces: string[] })[],
): string[] => {
  const patterns: string[] = []

  for (const pattern of globPatterns) {
    if (typeof pattern === "string") {
      // String patterns apply to all namespaces
      patterns.push(pattern)
    } else if (pattern.namespaces.includes(namespace)) {
      // Object patterns only apply to specified namespaces
      patterns.push(pattern.pattern)
    }
  }

  return patterns
}

/**
 * Extracts keys with their associated namespaces based on the files they're found in
 */
export const getKeysWithNamespaces = async ({
  globPatterns,
  defaultNamespace,
}: Pick<Configuration, "globPatterns" | "defaultNamespace">) => {
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  })

  const allPatterns = extractGlobPatterns(globPatterns)
  const files = await glob([...allPatterns, "!**/node_modules/**"])

  // Debug logging
  if (process.env.DEBUG_NAMESPACE_MATCHING) {
    console.log(`Found ${files.length} files matching patterns:`)
    for (const file of files.slice(0, 10)) {
      console.log(`  ${file}`)
    }
    if (files.length > 10) console.log(`  ... and ${files.length - 10} more`)
    console.log("---")
  }

  const keysWithNamespaces: Array<{
    key: string
    namespaces: string[]
    file: string
  }> = []

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8")
    const fileKeys: string[] = []

    // Temporarily suppress console.error to avoid i18next-scanner JSX errors
    const originalConsoleError = console.error
    console.error = () => {}

    try {
      parser.parseFuncFromString(
        content,
        { list: ["t", "t.rich"] },
        (key: string) => {
          fileKeys.push(key)
        },
      )
    } catch (error) {
      // If parsing fails (e.g., due to JSX), try to extract keys using regex fallback
      if (process.env.DEBUG_NAMESPACE_MATCHING) {
        console.warn(`Parser failed for ${file}, using regex fallback`)
      }
      const regexKeys = extractKeysWithRegex(content)
      fileKeys.push(...regexKeys)
    } finally {
      // Always restore console.error
      console.error = originalConsoleError
    }

    // Get namespaces for this file
    const fileNamespaces = getNamespacesForFile(
      file,
      globPatterns,
      defaultNamespace,
    )

    // Debug logging
    if (process.env.DEBUG_NAMESPACE_MATCHING && fileKeys.length > 0) {
      console.log(`File: ${file}`)
      console.log(`Keys found: ${fileKeys.length}`)
      console.log(`Assigned namespaces: ${fileNamespaces.join(", ")}`)
      console.log("---")
    }

    // Add each key with its associated namespaces
    for (const key of fileKeys) {
      keysWithNamespaces.push({
        key,
        namespaces: fileNamespaces,
        file,
      })
    }
  }

  return keysWithNamespaces
}

export const getMissingKeys = async ({
  globPatterns,
  namespaces,
  defaultNamespace,
  defaultLocale,
  loadPath,
}: Configuration) => {
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns,
    defaultNamespace,
  })
  const newKeys = []

  console.log(`🔍 Found ${keysWithNamespaces.length} total key instances`)

  // Group keys by namespace
  const keysByNamespace: Record<string, Set<string>> = {}
  // Track which namespaces each key belongs to
  const keyToNamespaces: Record<string, Set<string>> = {}

  for (const { key, namespaces: keyNamespaces } of keysWithNamespaces) {
    for (const namespace of keyNamespaces) {
      if (!keysByNamespace[namespace]) {
        keysByNamespace[namespace] = new Set()
      }

      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)
      const finalKey = pureKey || (!key.includes(":") ? key : null)

      if (finalKey) {
        keysByNamespace[namespace].add(finalKey)

        // Track which namespaces this key belongs to
        if (!keyToNamespaces[finalKey]) {
          keyToNamespaces[finalKey] = new Set()
        }
        keyToNamespaces[finalKey].add(namespace)
      }
    }
  }

  // Show summary of keys by namespace
  for (const [namespace, keys] of Object.entries(keysByNamespace)) {
    console.log(`📦 ${namespace}: ${keys.size} unique keys`)
  }

  // Load all existing keys for all namespaces in parallel
  const existingKeysByNamespace: Record<string, Record<string, string>> = {}
  const loadPromises = namespaces.map(async (namespace) => {
    try {
      const keys = await loadLocalesFile(loadPath, defaultLocale, namespace)
      existingKeysByNamespace[namespace] = keys
      return { namespace, keyCount: Object.keys(keys).length }
    } catch (error) {
      existingKeysByNamespace[namespace] = {}
      return { namespace, keyCount: 0 }
    }
  })

  const loadResults = await Promise.all(loadPromises)

  // Batch log existing key counts
  for (const { namespace, keyCount } of loadResults) {
    console.log(`📦 ${namespace}: ${keyCount} existing keys`)
  }

  // Track unique missing keys to avoid duplicates
  const uniqueMissingKeys = new Map<
    string,
    {
      key: string
      namespaces: string[]
      primaryNamespace: string
    }
  >()

  // Check for missing keys in each namespace
  for (const namespace of namespaces) {
    const existingKeys = existingKeysByNamespace[namespace]
    const keysForNamespace = keysByNamespace[namespace] || new Set()
    console.log(
      `🔍 Checking ${keysForNamespace.size} keys for namespace ${namespace}`,
    )

    const missingInNamespace: string[] = []
    for (const key of keysForNamespace) {
      if (!existingKeys[key]) {
        missingInNamespace.push(key)
        if (uniqueMissingKeys.has(key)) {
          // Add this namespace to the existing entry
          const existing = uniqueMissingKeys.get(key)
          if (existing && !existing.namespaces.includes(namespace)) {
            existing.namespaces.push(namespace)
          }
        } else {
          // Create new entry with all namespaces this key belongs to (that are missing)
          const allNamespaces = Array.from(
            keyToNamespaces[key] || [namespace],
          ).filter((ns) => !existingKeysByNamespace[ns]?.[key])

          uniqueMissingKeys.set(key, {
            key,
            namespaces: allNamespaces,
            primaryNamespace: namespace,
          })
        }
      }
    }

    // Log missing keys for this namespace if any
    if (missingInNamespace.length > 0) {
      console.log(
        `   ❌ Missing in ${namespace}: ${missingInNamespace.slice(0, 10).join(", ")}${missingInNamespace.length > 10 ? `... and ${missingInNamespace.length - 10} more` : ""}`,
      )
    }
  }

  // Convert to the expected format
  for (const {
    key,
    namespaces: keyNamespaces,
    primaryNamespace,
  } of uniqueMissingKeys.values()) {
    newKeys.push({
      key,
      namespace: primaryNamespace,
      namespaces: keyNamespaces,
    })
  }

  // Final summary of all missing keys
  if (newKeys.length > 0) {
    console.log(`\n📋 Summary: ${newKeys.length} unique missing key(s):`)
    for (const { key, namespaces: ns } of newKeys.slice(0, 20)) {
      console.log(`   - "${key}" in [${ns.join(", ")}]`)
    }
    if (newKeys.length > 20) {
      console.log(`   ... and ${newKeys.length - 20} more`)
    }
  }

  return newKeys
}

/**
 * Find existing translation for a key across all namespaces
 */
export const findExistingTranslation = async (
  key: string,
  namespaces: string[],
  locale: string,
  loadPath:
    | string
    | ((locale: string, namespace: string) => Promise<Record<string, string>>),
): Promise<string | null> => {
  for (const namespace of namespaces) {
    try {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace)
      // Use explicit existence check instead of truthy check
      // to handle empty string values correctly
      if (Object.hasOwn(existingKeys, key)) {
        return existingKeys[key]
      }
    } catch (error) {
      // Continue checking other namespaces if one fails to load
    }
  }
  return null
}

/**
 * Find existing translations for multiple keys in parallel
 */
export const findExistingTranslations = async (
  keys: string[],
  namespaces: string[],
  locale: string,
  loadPath:
    | string
    | ((locale: string, namespace: string) => Promise<Record<string, string>>),
  options?: { silent?: boolean },
): Promise<Record<string, string | null>> => {
  const silent = options?.silent ?? false
  const log = silent ? () => {} : console.log

  // Load all namespace files in parallel first
  const namespaceKeys: Record<string, Record<string, string>> = {}
  const loadPromises = namespaces.map(async (namespace) => {
    try {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace, {
        silent,
      })
      namespaceKeys[namespace] = existingKeys
    } catch (error) {
      namespaceKeys[namespace] = {}
    }
  })

  await Promise.all(loadPromises)

  // Log how many keys were found in each namespace for the default locale
  log(`\n🔎 Searching for existing translations in ${locale}:`)
  for (const namespace of namespaces) {
    const nsKeys = Object.keys(namespaceKeys[namespace] || {})
    log(`   📁 ${namespace}.json: ${nsKeys.length} keys available`)
    // Show sample keys from the namespace (first 3)
    if (nsKeys.length > 0) {
      const sampleKeys = nsKeys.slice(0, 3)
      log(
        `      Sample keys: ${sampleKeys.join(", ")}${nsKeys.length > 3 ? "..." : ""}`,
      )
    }
  }

  // Show sample of keys we're searching for
  if (keys.length > 0) {
    const sampleSearchKeys = keys.slice(0, 3)
    log(
      `\n   🔍 Looking for keys like: ${sampleSearchKeys.join(", ")}${keys.length > 3 ? "..." : ""}`,
    )
  }

  // Now find translations for all keys
  const results: Record<string, string | null> = {}
  const foundInNamespace: Record<string, number> = {}

  for (const key of keys) {
    let found = false
    for (const namespace of namespaces) {
      // Use explicit existence check instead of truthy check
      // to handle empty string values correctly
      if (
        namespaceKeys[namespace] &&
        Object.hasOwn(namespaceKeys[namespace], key)
      ) {
        results[key] = namespaceKeys[namespace][key]
        foundInNamespace[namespace] = (foundInNamespace[namespace] || 0) + 1
        found = true
        break
      }
    }
    if (!found) {
      results[key] = null
    }
  }

  // Log how many keys were found in each namespace
  const totalFound = Object.values(foundInNamespace).reduce(
    (sum, count) => sum + count,
    0,
  )
  const notFound = keys.length - totalFound
  log(`\n📊 Search results for ${keys.length} missing keys:`)
  for (const [namespace, count] of Object.entries(foundInNamespace)) {
    log(`   ✅ Found ${count} keys in ${namespace}.json`)
  }
  if (notFound > 0) {
    log(`   ❌ ${notFound} keys not found in any namespace`)
  }
  log("")

  return results
}

export const getTextInput = async (key: string, namespaces?: string[]) => {
  const namespaceInfo =
    namespaces && namespaces.length > 0
      ? ` (will be added to: ${namespaces.join(", ")})`
      : ""

  const input = await prompts({
    name: "value",
    type: "text",
    message: `${key}${namespaceInfo}`,
    onState: (state) => {
      if (state.aborted) {
        process.nextTick(() => {
          process.exit(0)
        })
      }
    },
  })

  return input.value as string
}

export const checkAllKeysExist = async ({
  namespaces,
  defaultLocale,
  loadPath,
  locales,
  context,
  openai,
  savePath,
  disableTranslationDuringScan,
  model,
}: Configuration) => {
  if (disableTranslationDuringScan) {
    return
  }

  // Parallelize namespace processing
  const namespacePromises = namespaces.map(async (namespace) => {
    const defaultLocaleKeys = await loadLocalesFile(
      loadPath,
      defaultLocale,
      namespace,
    )

    // Parallelize locale processing within each namespace
    const localePromises = locales
      .filter((locale) => locale !== defaultLocale)
      .map(async (locale) => {
        const localeKeys = await loadLocalesFile(loadPath, locale, namespace)
        const missingKeys: Record<string, string> = {}

        // Check which keys from default locale are missing in current locale
        for (const [key, value] of Object.entries(defaultLocaleKeys)) {
          if (!localeKeys[key]) {
            missingKeys[key] = value
          }
        }

        // If there are missing keys, translate them
        if (Object.keys(missingKeys).length > 0) {
          console.log(
            `Found ${Object.keys(missingKeys).length} missing keys in ${locale} (namespace: ${namespace})`,
          )

          const translatedValues = await translateKey({
            inputLanguage: defaultLocale,
            outputLanguage: locale,
            context,
            object: missingKeys,
            openai,
            model,
          })

          // Merge translated values with existing ones
          const updatedLocaleKeys = {
            ...localeKeys,
            ...translatedValues,
          }

          // Save the updated translations
          writeLocalesFile(savePath, locale, namespace, updatedLocaleKeys)
          console.log(
            `✓ Translated and saved missing keys for ${locale} (namespace: ${namespace})`,
          )
        }
      })

    await Promise.all(localePromises)
  })

  await Promise.all(namespacePromises)
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public locale?: string,
    public namespace?: string,
    public cause?: Error,
  ) {
    super(message)
    this.name = "TranslationError"
  }
}

/**
 * Add a translation key with a value in a specific language to the locale files.
 * This function adds to the specified language locale, and will also translate
 * and save to other locales if OpenAI is configured.
 */
/**
 * Add multiple translation keys in batch. This is optimized for performance:
 * - Single codebase scan for all keys
 * - Batched file I/O operations
 * - Batched translations per locale
 */
export const addTranslationKeys = async ({
  keys,
  config,
}: {
  keys: Array<{ key: string; value: string; language?: string }>
  config: Configuration
}) => {
  const startTime = performance.now()
  const {
    loadPath,
    savePath,
    defaultNamespace,
    namespaces,
    globPatterns,
    defaultLocale,
    openai,
    context,
    model,
  } = config

  if (keys.length === 0) {
    return {
      results: [],
      performance: {
        totalTime: 0,
        scanTime: 0,
        translationTime: 0,
        fileIOTime: 0,
      },
    }
  }

  const log = console.log
  log(`🚀 Batch adding ${keys.length} translation key(s)...`)

  // Step 1: Single codebase scan for all keys (most expensive operation)
  const scanStartTime = performance.now()
  let keysWithNamespaces: Array<{
    key: string
    namespaces: string[]
    file: string
  }> = []
  try {
    keysWithNamespaces = await getKeysWithNamespaces({
      globPatterns,
      defaultNamespace,
    })
  } catch (error) {
    console.error(`Warning: Failed to scan codebase for key usage: ${error}`)
  }
  const scanTime = performance.now() - scanStartTime
  log(`⏱️  Codebase scan completed in ${scanTime.toFixed(2)}ms`)

  // Step 2: Determine namespaces for each key
  // Resolution order:
  // 1) Explicit namespace prefix (e.g. "dashboard:welcome")
  // 2) Code usage scan matches
  // 3) Existing key in default locale namespace files
  // 4) Key prefix matching a namespace (e.g. "dashboard.title")
  // 5) Default namespace fallback
  const defaultLocaleKeysByNamespace = new Map<string, Record<string, string>>()
  await Promise.all(
    namespaces.map(async (namespace) => {
      try {
        const nsKeys = await loadLocalesFile(loadPath, defaultLocale, namespace, {
          silent: true,
        })
        defaultLocaleKeysByNamespace.set(namespace, nsKeys)
      } catch {
        defaultLocaleKeysByNamespace.set(namespace, {})
      }
    }),
  )

  const preparedKeys = keys.map(({ key, value, language = "en" }) => {
    const splitKey = key.split(":")
    const hasExplicitNamespace =
      splitKey.length > 1 && namespaces.includes(splitKey[0])
    const normalizedKey = hasExplicitNamespace ? splitKey.slice(1).join(":") : key
    const explicitNamespace = hasExplicitNamespace ? splitKey[0] : null
    const foundNamespaces = new Set<string>()

    if (explicitNamespace) {
      foundNamespaces.add(explicitNamespace)
    } else {
      for (const entry of keysWithNamespaces) {
        for (const namespace of entry.namespaces) {
          const pureKey = getPureKey(
            entry.key,
            namespace,
            namespace === defaultNamespace,
          )
          if (entry.key === normalizedKey || pureKey === normalizedKey) {
            foundNamespaces.add(namespace)
          }
        }
      }

      if (foundNamespaces.size === 0) {
        for (const namespace of namespaces) {
          const namespaceKeys = defaultLocaleKeysByNamespace.get(namespace) || {}
          if (Object.hasOwn(namespaceKeys, normalizedKey)) {
            foundNamespaces.add(namespace)
          }
        }
      }

      if (foundNamespaces.size === 0) {
        const keyPrefix = normalizedKey.split(".")[0]
        if (namespaces.includes(keyPrefix)) {
          foundNamespaces.add(keyPrefix)
        }
      }
    }

    if (foundNamespaces.size === 0) {
      foundNamespaces.add(defaultNamespace)
    }

    return {
      key: normalizedKey,
      value,
      language,
      namespaces: foundNamespaces,
    }
  })

  // Step 3: Group keys by namespace and locale
  const namespaceLocaleToKeys = new Map<
    string,
    Array<{ key: string; value: string; language: string }>
  >()

  for (const keyEntry of preparedKeys) {
    for (const namespace of keyEntry.namespaces) {
      const mapKey = `${namespace}:${keyEntry.language}`
      if (!namespaceLocaleToKeys.has(mapKey)) {
        namespaceLocaleToKeys.set(mapKey, [])
      }
      namespaceLocaleToKeys.get(mapKey)!.push({
        key: keyEntry.key,
        value: keyEntry.value,
        language: keyEntry.language,
      })
    }
  }

  // Step 4: Collect all unique namespaces that will be affected
  const affectedNamespaces = new Set<string>()
  for (const keyEntry of preparedKeys) {
    for (const ns of keyEntry.namespaces) {
      affectedNamespaces.add(ns)
    }
  }

  // Step 5: Batch load ALL locale files for affected namespaces (not just input language)
  // This ensures we preserve existing keys in all locales
  const fileIOStartTime = performance.now()
  const localeFiles = new Map<string, Record<string, string>>()
  const originalKeyCounts = new Map<string, number>()
  const loadErrors: Array<{ fileKey: string; error: string }> = []

  // Load files for all locales × all affected namespaces in parallel (read-only)
  const localeLoadPromises: Promise<void>[] = []
  for (const namespace of affectedNamespaces) {
    for (const locale of config.locales) {
      const fileKey = `${locale}:${namespace}`
      localeLoadPromises.push(
        loadLocalesFile(loadPath, locale, namespace, { silent: true })
          .then((existingKeys) => {
            localeFiles.set(fileKey, existingKeys)
            originalKeyCounts.set(fileKey, Object.keys(existingKeys).length)
          })
          .catch((error) => {
            // Don't silently ignore - track the error and DO NOT set empty object
            const errorMsg =
              error instanceof Error ? error.message : String(error)
            loadErrors.push({ fileKey, error: errorMsg })
            log(`⚠️  Failed to load ${fileKey}: ${errorMsg}`)
          }),
      )
    }
  }
  await Promise.all(localeLoadPromises)

  // If any files failed to load, abort to prevent data loss
  if (loadErrors.length > 0) {
    throw new Error(
      `Failed to load ${loadErrors.length} locale file(s). Aborting to prevent data loss.\n` +
        `Failed files: ${loadErrors.map((e) => e.fileKey).join(", ")}\n` +
        `First error: ${loadErrors[0].error}`,
    )
  }
  const fileIOTime = performance.now() - fileIOStartTime
  log(`⏱️  File I/O (load) completed in ${fileIOTime.toFixed(2)}ms`)

  // Step 6: Add new keys to the input language locale files
  for (const [namespaceLocale, keyValues] of namespaceLocaleToKeys) {
    const [namespace, locale] = namespaceLocale.split(":")
    const fileKey = `${locale}:${namespace}`
    const existingKeys = localeFiles.get(fileKey) || {}

    for (const { key, value } of keyValues) {
      existingKeys[key] = value
    }

    localeFiles.set(fileKey, existingKeys)
  }

  // Step 7: Batch translate if OpenAI is configured
  const translationStartTime = performance.now()
  const translationCache = new Map<string, Record<string, string>>()

  if (openai) {
    // Group keys by input language
    const keysByLanguage = new Map<
      string,
      Array<{ key: string; value: string; namespaces: Set<string> }>
    >()

    for (const keyEntry of preparedKeys) {
      if (!keysByLanguage.has(keyEntry.language)) {
        keysByLanguage.set(keyEntry.language, [])
      }
      keysByLanguage.get(keyEntry.language)!.push({
        key: keyEntry.key,
        value: keyEntry.value,
        namespaces: keyEntry.namespaces,
      })
    }

    // Translate each language group to all other locales
    const translationPromises: Promise<void>[] = []

    for (const [inputLanguage, keyValues] of keysByLanguage) {
      const otherLocales = config.locales.filter((l) => l !== inputLanguage)

      for (const targetLocale of otherLocales) {
        const keysToTranslate = Object.fromEntries(
          keyValues.map(({ key, value }) => [key, value]),
        )

        translationPromises.push(
          translateKey({
            inputLanguage,
            outputLanguage: targetLocale,
            context: context || "",
            object: keysToTranslate,
            openai,
            model,
          })
            .then((translated) => {
              translationCache.set(
                `${inputLanguage}:${targetLocale}`,
                translated,
              )
            })
            .catch((error) => {
              log(
                `⚠️  Failed to translate ${keyValues.length} key(s) from ${inputLanguage} to ${targetLocale}: ${error instanceof Error ? error.message : "Unknown error"}`,
              )
            }),
        )
      }
    }

    await Promise.all(translationPromises)

    // Add translated keys to locale files (merge with existing keys)
    for (const [inputLanguage, keyValues] of keysByLanguage) {
      const otherLocales = config.locales.filter((l) => l !== inputLanguage)

      for (const targetLocale of otherLocales) {
        const translated = translationCache.get(
          `${inputLanguage}:${targetLocale}`,
        )
        if (!translated) continue

        for (const { key, namespaces } of keyValues) {
          if (translated[key]) {
            for (const namespace of namespaces) {
              const fileKey = `${targetLocale}:${namespace}`
              // File MUST already be loaded from step 5 - if not, something went wrong
              if (!localeFiles.has(fileKey)) {
                throw new Error(
                  `Internal error: Locale file ${fileKey} was not loaded in step 5. ` +
                    `This should never happen. Aborting to prevent data loss.`,
                )
              }
              // Merge translated key with existing keys (don't overwrite the whole file)
              localeFiles.get(fileKey)![key] = translated[key]
            }
          }
        }
      }
    }
  }

  const translationTime = performance.now() - translationStartTime
  if (openai && translationTime > 0) {
    log(`⏱️  Translation completed in ${translationTime.toFixed(2)}ms`)
  }

  // Step 8: Validate and write all files
  // Safety check: ensure we're not accidentally removing keys (only adding)
  const writeStartTime = performance.now()

  // Validate: new file should have at least as many keys as original
  for (const [fileKey, newKeys] of localeFiles) {
    const originalCount = originalKeyCounts.get(fileKey) || 0
    const newCount = Object.keys(newKeys).length

    if (newCount < originalCount) {
      throw new Error(
        `Safety check failed: Writing ${fileKey} would reduce keys from ${originalCount} to ${newCount}. ` +
          `This operation only adds keys, never removes. Aborting to prevent data loss.`,
      )
    }
  }

  // All validations passed, now write files sequentially to avoid race conditions
  for (const [fileKey, keys] of localeFiles) {
    const [locale, namespace] = fileKey.split(":")
    await writeLocalesFile(savePath, locale, namespace, keys)
  }

  const writeTime = performance.now() - writeStartTime
  log(`⏱️  File I/O (write) completed in ${writeTime.toFixed(2)}ms`)

  const totalTime = performance.now() - startTime
  log(
    `✅ Batch operation completed in ${totalTime.toFixed(2)}ms (${(totalTime / keys.length).toFixed(2)}ms per key)`,
  )

  // Build results
  const results = preparedKeys.map(({ key, value, language, namespaces }) => {
    const resolvedNamespaces = Array.from(namespaces)
    const savedLocales = new Set<string>([language])

    if (openai) {
      config.locales.forEach((locale) => {
        if (locale !== language) {
          const translated = translationCache.get(`${language}:${locale}`)
          if (translated?.[key]) {
            savedLocales.add(locale)
          }
        }
      })
    }

    return {
      key,
      value,
      namespace: resolvedNamespaces.join(", "),
      locale: Array.from(savedLocales).sort().join(", "),
    }
  })

  return {
    results,
    performance: {
      totalTime,
      scanTime,
      translationTime,
      fileIOTime: fileIOTime + writeTime,
    },
  }
}

export const addTranslationKey = async ({
  key,
  value,
  language = "en",
  config,
}: {
  key: string
  value: string
  language?: string
  config: Configuration
}) => {
  const startTime = performance.now()
  const result = await addTranslationKeys({
    keys: [{ key, value, language }],
    config,
  })
  const totalTime = performance.now() - startTime

  const log = console.log
  log(`⏱️  Single key operation completed in ${totalTime.toFixed(2)}ms`)

  return result.results[0]
}
