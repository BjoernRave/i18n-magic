#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { createPrunedNamespaceAutomated } from "../src/commands/create-pruned-namespace-automated"
import type { Configuration } from "../src/lib/types"
import { loadConfig } from "../src/lib/utils"

interface BuildMetadata {
  namespace: string
  sourceNamespace: string
  keysCount: number
  locales: Array<{
    locale: string
    keyCount: number
    success: boolean
    error?: string
  }>
  buildTime: string
  globPatterns: string[]
}

/**
 * Extracts namespace-specific configurations from the new globPatterns structure
 */
function extractNamespaceConfigs(config: Configuration) {
  const namespaceConfigs: Array<{
    sourceNamespace: string
    newNamespace: string
    globPatterns: string[]
  }> = []

  for (const pattern of config.globPatterns) {
    if (typeof pattern === "object" && pattern.namespaces) {
      for (const namespace of pattern.namespaces) {
        // Find existing config for this namespace or create new one
        let existingConfig = namespaceConfigs.find(
          (c) => c.newNamespace === namespace,
        )
        if (!existingConfig) {
          existingConfig = {
            sourceNamespace: config.defaultNamespace,
            newNamespace: namespace,
            globPatterns: [],
          }
          namespaceConfigs.push(existingConfig)
        }
        existingConfig.globPatterns.push(pattern.pattern)
      }
    }
  }

  return namespaceConfigs
}

async function buildNamespaceTranslations(
  namespaceName: string,
): Promise<void> {
  try {
    console.log(`🚀 Building translations for ${namespaceName} namespace...`)

    // Load the base i18n configuration
    const config: Configuration = await loadConfig({
      configPath: "i18n-magic.js",
    })

    // Extract namespace configurations from globPatterns
    const namespaceConfigs = extractNamespaceConfigs(config)

    if (namespaceConfigs.length === 0) {
      throw new Error(
        "No namespace-specific glob patterns found in i18n-magic.js. Please add object patterns with namespaces to your globPatterns array.",
      )
    }

    // Get namespace-specific configuration
    const namespaceConfig = namespaceConfigs.find(
      (ns) => ns.newNamespace === namespaceName,
    )
    if (!namespaceConfig) {
      const availableNamespaces = namespaceConfigs.map((ns) => ns.newNamespace)
      throw new Error(
        `Unknown namespace: ${namespaceName}. Available namespaces: ${availableNamespaces.join(", ")}`,
      )
    }

    // Create pruned namespace
    const result = await createPrunedNamespaceAutomated(config, namespaceConfig)

    if (result.success && result.results) {
      console.log(`✅ Successfully created ${namespaceName} translations:`)
      console.log(`   - Namespace: ${namespaceConfig.newNamespace}`)
      console.log(`   - Keys: ${result.keysCount}`)
      console.log(
        `   - Locales: ${result.results.map((r) => r.locale).join(", ")}`,
      )

      // Write metadata file for the namespace
      const metadata: BuildMetadata = {
        namespace: namespaceConfig.newNamespace,
        sourceNamespace: namespaceConfig.sourceNamespace,
        keysCount: result.keysCount,
        locales: result.results,
        buildTime: new Date().toISOString(),
        globPatterns: namespaceConfig.globPatterns,
      }

      // Ensure build directory exists
      const buildDir = "./build/translations"
      if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true })
      }

      // Write metadata
      fs.writeFileSync(
        path.join(buildDir, `${namespaceName}-metadata.json`),
        JSON.stringify(metadata, null, 2),
      )

      console.log(
        `📄 Metadata written to build/translations/${namespaceName}-metadata.json`,
      )
    } else {
      console.error(
        `❌ Failed to create ${namespaceName} translations: ${result.message}`,
      )
      process.exit(1)
    }
  } catch (error) {
    console.error(
      `❌ Error building ${namespaceName} translations:`,
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

async function buildAllNamespaces(): Promise<void> {
  console.log("🚀 Building translations for all namespaces...")

  // Load the base i18n configuration to get namespace configurations
  const config: Configuration = await loadConfig({
    configPath: "i18n-magic.js",
  })

  const namespaceConfigs = extractNamespaceConfigs(config)

  if (namespaceConfigs.length === 0) {
    throw new Error(
      "No namespace-specific glob patterns found in i18n-magic.js. Please add object patterns with namespaces to your globPatterns array.",
    )
  }

  for (const namespaceConfig of namespaceConfigs) {
    await buildNamespaceTranslations(namespaceConfig.newNamespace)
    console.log("") // Add spacing between namespaces
  }

  console.log("✅ All namespace translations built successfully!")
}

async function main(): Promise<void> {
  const command = process.argv[2]

  if (!command) {
    console.error("Usage:")
    console.error(
      "  tsx build-scripts/build-namespace-translations.ts <namespace>  # Build specific namespace",
    )
    console.error(
      "  tsx build-scripts/build-namespace-translations.ts all          # Build all namespaces",
    )
    console.error("")

    try {
      const config: Configuration = await loadConfig({
        configPath: "i18n-magic.js",
      })
      const namespaceConfigs = extractNamespaceConfigs(config)
      if (namespaceConfigs.length > 0) {
        const availableNamespaces = namespaceConfigs.map(
          (ns) => ns.newNamespace,
        )
        console.error("Available namespaces:", availableNamespaces.join(", "))
      }
    } catch {
      console.error("Could not load configuration to show available namespaces")
    }

    process.exit(1)
  }

  if (command === "all") {
    await buildAllNamespaces()
  } else {
    // Try to build the specific namespace - error handling is done in buildNamespaceTranslations
    await buildNamespaceTranslations(command)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { buildAllNamespaces, buildNamespaceTranslations, type BuildMetadata }
