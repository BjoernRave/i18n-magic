import glob from "fast-glob"
import { Parser } from "i18next-scanner"
import fs from "node:fs"
import prompts from "prompts"
import type { Configuration } from "../lib/types"
import {
  getPureKey,
  loadLocalesFile,
  removeDuplicatesFromArray,
  writeLocalesFile,
} from "../lib/utils"

export const createPrunedNamespace = async (config: Configuration) => {
  const { namespaces, loadPath, savePath, locales, defaultNamespace } = config

  // Step 1: Ask for source namespace
  const sourceNamespaceResponse = await prompts({
    type: "select",
    name: "value",
    message: "Select source namespace to create pruned version from:",
    choices: namespaces.map((namespace) => ({
      title: namespace,
      value: namespace,
    })),
    onState: (state) => {
      if (state.aborted) {
        process.nextTick(() => {
          process.exit(0)
        })
      }
    },
  })

  const sourceNamespace = sourceNamespaceResponse.value

  // Step 2: Ask for new namespace name
  const newNamespaceResponse = await prompts({
    type: "text",
    name: "value",
    message: "Enter the name for the new namespace:",
    validate: (value) => {
      if (!value) return "Namespace name cannot be empty"
      if (namespaces.includes(value)) return "Namespace already exists"
      return true
    },
    onState: (state) => {
      if (state.aborted) {
        process.nextTick(() => {
          process.exit(0)
        })
      }
    },
  })

  const newNamespace = newNamespaceResponse.value

  // Step 3: Ask for glob patterns to find relevant keys
  const globPatternsResponse = await prompts({
    type: "list",
    name: "value",
    message: "Enter glob patterns to find relevant keys (comma separated):",
    initial: config.globPatterns.join(","),
    separator: ",",
    onState: (state) => {
      if (state.aborted) {
        process.nextTick(() => {
          process.exit(0)
        })
      }
    },
  })

  const selectedGlobPatterns = globPatternsResponse.value

  console.log(
    `Finding keys used in files matching: ${selectedGlobPatterns.join(", ")}`,
  )

  // Extract keys from files matching the glob patterns
  const parser = new Parser({
    nsSeparator: false,
    keySeparator: false,
  })

  const files = await glob([...selectedGlobPatterns, "!**/node_modules/**"])
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
    return
  }

  // Get translations from source namespace and create new namespace files
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

      console.log(
        `Created pruned namespace '${newNamespace}' for locale '${locale}' with ${
          Object.keys(newNamespaceTranslations).length
        } keys`,
      )
    } catch (error) {
      console.error(
        `Error creating pruned namespace for locale '${locale}':`,
        error,
      )
    }
  }

  console.log(`✅ Successfully created pruned namespace '${newNamespace}'`)
}
