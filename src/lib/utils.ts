import glob from "fast-glob"
import { Parser } from "i18next-scanner"
import fs from "node:fs"
import path from "node:path"
import type OpenAI from "openai"
import prompts from "prompts"
import { languages } from "./languges"
import type { Configuration } from "./types"

export const loadConfig = ({
  configPath = "i18n-magic.js",
}: { configPath: string }) => {
  const filePath = path.join(process.cwd(), configPath)

  if (!fs.existsSync(filePath)) {
    console.error("Config file does not exist:", filePath)
    process.exit(1)
  }

  try {
    const config = require(filePath)
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
    const completion = await openai.beta.chat.completions.parse({
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

export const getMissingKeys = async ({
  globPatterns,
  namespaces,
  defaultNamespace,
  defaultLocale,
  loadPath,
}: Configuration) => {
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  })

  const files = await glob([...globPatterns, "!**/node_modules/**"])

  const keys = []

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8")
    parser.parseFuncFromString(content, { list: ["t"] }, (key: string) => {
      keys.push(key)
    })
  }

  const uniqueKeys = removeDuplicatesFromArray(keys)

  const newKeys = []

  for (const namespace of namespaces) {
    const existingKeys = await loadLocalesFile(
      loadPath,
      defaultLocale,
      namespace,
    )

    console.log(Object.keys(existingKeys).length, "existing keys")

    for (const key of uniqueKeys) {
      const pureKey = getPureKey(key, namespace, namespace === defaultNamespace)

      if (!pureKey) {
        continue
      }

      if (!existingKeys[pureKey]) {
        newKeys.push({ key: pureKey, namespace })
      }
    }
  }

  return newKeys
}

export const getTextInput = async (prompt: string) => {
  const input = await prompts({
    name: "value",
    type: "text",
    message: prompt,
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
  disableTranslation,
  model,
}: Configuration) => {
  if (disableTranslation) {
    return
  }

  for (const namespace of namespaces) {
    const defaultLocaleKeys = await loadLocalesFile(
      loadPath,
      defaultLocale,
      namespace,
    )

    for (const locale of locales) {
      if (locale === defaultLocale) continue

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
    }
  }
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
