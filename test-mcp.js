#!/usr/bin/env node

/**
 * Test script to verify the addTranslationKey function works correctly
 */

import { addTranslationKey, loadConfig } from "./dist/index.js"
import OpenAI from "openai"
import dotenv from "dotenv"

async function test() {
  console.log("Testing addTranslationKey function...")

  try {
    // Load config from example-app
    process.chdir("./example-app")
    
    // Load environment variables
    dotenv.config({ path: "../.env" })
    
    const config = await loadConfig()

    console.log("\n✓ Configuration loaded successfully")
    console.log(`  Namespaces: ${config.namespaces.join(", ")}`)
    console.log(`  Locales: ${config.locales.join(", ")}`)
    console.log(`  Default locale: ${config.defaultLocale}`)
    
    // Initialize OpenAI client
    const isGemini = (config.model)?.includes("gemini")
    const openaiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY
    const key = isGemini ? geminiKey : openaiKey
    
    if (key) {
      config.openai = new OpenAI({
        apiKey: key,
        ...(isGemini && {
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        }),
      })
      console.log(`  OpenAI/Gemini client: Initialized (${isGemini ? "Gemini" : "OpenAI"})`)
    } else {
      console.log("  OpenAI/Gemini client: Not initialized (no API key)")
    }

    // Test adding a translation key
    console.log("\n--- Testing add translation key ---")
    const result = await addTranslationKey({
      key: "test.mcpServerKey",
      value: "This is a test key added via MCP server",
      namespace: "common",
      config,
    })

    console.log("\n✓ Translation key added successfully!")
    console.log(`  Key: ${result.key}`)
    console.log(`  Value: ${result.value}`)
    console.log(`  Namespace: ${result.namespace}`)
    console.log(`  Locale: ${result.locale}`)

    console.log("\n✅ All tests passed!")
    console.log("\nNote: The key was added to the 'en' locale.")
    console.log(
      "You can now run 'cd example-app && i18n-magic sync' to translate it to other locales.",
    )
  } catch (error) {
    console.error("\n❌ Test failed:", error.message)
    process.exit(1)
  }
}

test()



