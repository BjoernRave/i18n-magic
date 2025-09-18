import glob from "fast-glob"
import { Parser } from "i18next-scanner"
import { minimatch } from "minimatch"
import fs from "node:fs"
import path from "node:path"
import type OpenAI from "openai"
import prompts from "prompts"
import { languages } from "./languges.js"
import type { Configuration, GlobPatternConfig } from "./types.js"

export const loadConfig = async ({
  configPath = "i18n-magic.js",
}: { configPath?: string } = {}) => {
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
    console.error("Error while loading config:", error)
    process.exit(1)
  }
}

export function removeDuplicatesFromArray<T>(arr: T[]): T[] {
  return arr.filter((item, index) => arr.indexOf(item) === index)
}

export const translateKey = async ({
  inputLanguage,
  context,
  object,
  openai,
  outputLanguage,
  model,
}: {
  object: Record<string, string>
  context: string
  inputLanguage: string
  outputLanguage: string
  model: string
  openai: OpenAI
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
  for (const chunk of chunks) {
    const chunkObject = Object.fromEntries(chunk)
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          content: `You are a bot that translates the values of a locales JSON. ${
            context
              ? `The user provided some additional context or guidelines about what to fill in the blanks: \"${context}\". `
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
) => {
  if (typeof loadPath === "string") {
    const resolvedPath = loadPath
      .replace("{{lng}}", locale)
      .replace("{{ns}}", namespace)

    // Check if file exists, return empty object if it doesn't
    if (!fs.existsSync(resolvedPath)) {
      console.log(`📄 Creating new namespace file: ${resolvedPath}`)
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

    parser.parseFuncFromString(
      content,
      { list: ["t", "t.rich"] },
      (key: string) => {
        fileKeys.push(key)
      },
    )

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

    for (const key of keysForNamespace) {
      if (!existingKeys[key]) {
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
      if (existingKeys[key]) {
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
): Promise<Record<string, string | null>> => {
  // Load all namespace files in parallel first
  const namespaceKeys: Record<string, Record<string, string>> = {}
  const loadPromises = namespaces.map(async (namespace) => {
    try {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace)
      namespaceKeys[namespace] = existingKeys
    } catch (error) {
      namespaceKeys[namespace] = {}
    }
  })

  await Promise.all(loadPromises)

  // Now find translations for all keys
  const results: Record<string, string | null> = {}

  for (const key of keys) {
    let found = false
    for (const namespace of namespaces) {
      if (namespaceKeys[namespace]?.[key]) {
        results[key] = namespaceKeys[namespace][key]
        found = true
        break
      }
    }
    if (!found) {
      results[key] = null
    }
  }

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
