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

async function buildNamespaceTranslations(
  namespaceName: string,
): Promise<void> {
  try {
    console.log(`🚀 Building translations for ${namespaceName} namespace...`)

    // Load the base i18n configuration
    const config: Configuration = await loadConfig({
      configPath: "i18n-magic.js",
    })

    // Check if pruneNamespaces configuration exists
    if (!config.pruneNamespaces || config.pruneNamespaces.length === 0) {
      throw new Error(
        "No pruneNamespaces configuration found in i18n-magic.js. Please add a 'pruneNamespaces' array to your config.",
      )
    }

    // Get namespace-specific configuration
    const namespaceConfig = config.pruneNamespaces.find(
      (ns) => ns.newNamespace === namespaceName,
    )
    if (!namespaceConfig) {
      const availableNamespaces = config.pruneNamespaces.map(
        (ns) => ns.newNamespace,
      )
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

  if (!config.pruneNamespaces || config.pruneNamespaces.length === 0) {
    throw new Error(
      "No pruneNamespaces configuration found in i18n-magic.js. Please add a 'pruneNamespaces' array to your config.",
    )
  }

  for (const namespaceConfig of config.pruneNamespaces) {
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
      if (config.pruneNamespaces && config.pruneNamespaces.length > 0) {
        const availableNamespaces = config.pruneNamespaces.map(
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
