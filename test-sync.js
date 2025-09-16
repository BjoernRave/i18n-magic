#!/usr/bin/env node

// Simple test script to debug the sync functionality
const { syncLocales } = require("./dist/commands/sync-locales.js")
const OpenAI = require("openai")
require("dotenv").config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const config = {
  loadPath: "example-app/locales/{{lng}}/{{ns}}.json",
  savePath: "example-app/locales/{{lng}}/{{ns}}.json",
  locales: ["en", "de", "fr", "es"],
  defaultLocale: "en",
  namespaces: ["common", "dashboard", "mobile", "admin", "auth", "shop"],
  defaultNamespace: "common",
  disableTranslationDuringScan: false, // Enable translation during scan with real API key
  context:
    "This is a multi-platform application with a web dashboard, mobile app, admin panel, authentication system, and e-commerce shop. Each namespace contains translations specific to that platform or feature.",
  model: "gpt-4o-mini",
  openai: openai,
}

console.log("🧪 Testing sync functionality...")
syncLocales(config)
  .then(() => {
    console.log("✅ Sync completed successfully")
  })
  .catch((error) => {
    console.error("❌ Sync failed:", error.message)
    if (error.cause) {
      console.error("Cause:", error.cause.message)
    }
  })
