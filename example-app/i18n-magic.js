// Load environment variables from root .env file
require("dotenv").config({ path: "../.env" })

module.exports = {
  // Glob patterns with namespace-specific configurations
  globPatterns: [
    // Common files that apply to all namespaces
    "./src/shared/**/*.{ts,tsx,js,jsx}",

    // Dashboard-specific files
    {
      pattern: "./src/dashboard/**/*.{ts,tsx,js,jsx}",
      namespaces: ["dashboard"],
    },

    // Mobile app-specific files
    {
      pattern: "./src/mobile/**/*.{ts,tsx,js,jsx}",
      namespaces: ["mobile"],
    },

    // Admin panel-specific files
    {
      pattern: "./src/admin/**/*.{ts,tsx,js,jsx}",
      namespaces: ["admin"],
    },

    // Authentication-related files
    {
      pattern: "./src/auth/**/*.{ts,tsx,js,jsx}",
      namespaces: ["auth"],
    },

    // E-commerce specific files
    {
      pattern: "./src/shop/**/*.{ts,tsx,js,jsx}",
      namespaces: ["shop"],
    },
  ],

  // Separate JSON files for each namespace
  loadPath: "locales/{{lng}}/{{ns}}.json",
  savePath: "locales/{{lng}}/{{ns}}.json",

  // Supported locales
  locales: ["en", "de"],
  defaultLocale: "en",

  // All namespaces that should be created
  namespaces: ["common", "dashboard", "mobile", "admin", "auth", "shop"],
  defaultNamespace: "common",

  // Context to improve translation quality
  context:
    "This is a multi-platform application with a web dashboard, mobile app, admin panel, authentication system, and e-commerce shop. Each namespace contains translations specific to that platform or feature.",

  // Optional configurations
  model: "gpt-4o-mini",
  // Read API keys from root .env file
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  disableTranslationDuringScan: false, // Enable translation during scan for testing
  autoClear: true,
}
