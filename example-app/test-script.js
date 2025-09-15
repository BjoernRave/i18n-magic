#!/usr/bin/env node

/**
 * Test script to demonstrate the namespace feature
 * Run with: node test-script.js
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

console.log("🧪 Testing i18n-magic namespace feature...\n")

// Step 1: Build the main project
console.log("📦 Building i18n-magic...")
try {
  execSync("npm run build", { cwd: "..", stdio: "inherit" })
  console.log("✅ Build completed\n")
} catch (error) {
  console.error("❌ Build failed:", error.message)
  process.exit(1)
}

// Step 2: Clean existing locale files
console.log("🧹 Cleaning existing locale files...")
const localesDir = path.join(__dirname, "locales")
if (fs.existsSync(localesDir)) {
  fs.rmSync(localesDir, { recursive: true })
}
console.log("✅ Locale files cleaned\n")

// Step 3: Run scan command with debug output
console.log("🔍 Scanning for translation keys with debug output...")
try {
  execSync("DEBUG_NAMESPACE_MATCHING=true node ../dist/cli.js scan", {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, DEBUG_NAMESPACE_MATCHING: "true" },
  })
  console.log("✅ Scan completed\n")
} catch (error) {
  console.error("❌ Scan failed:", error.message)
  process.exit(1)
}

// Step 4: Check generated files
console.log("📁 Checking generated namespace files...")
const expectedNamespaces = [
  "common",
  "dashboard",
  "mobile",
  "admin",
  "auth",
  "shop",
]
const expectedLocales = ["en"]

let allFilesExist = true

for (const locale of expectedLocales) {
  const localeDir = path.join(localesDir, locale)

  if (!fs.existsSync(localeDir)) {
    console.log(`❌ Missing locale directory: ${locale}`)
    allFilesExist = false
    continue
  }

  for (const namespace of expectedNamespaces) {
    const filePath = path.join(localeDir, `${namespace}.json`)

    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"))
      const keyCount = Object.keys(content).length
      console.log(`✅ ${locale}/${namespace}.json - ${keyCount} keys`)

      // Show first few keys as examples
      const keys = Object.keys(content).slice(0, 3)
      if (keys.length > 0) {
        console.log(
          `   Sample keys: ${keys.join(", ")}${keyCount > 3 ? "..." : ""}`,
        )
      }
    } else {
      console.log(`❌ Missing file: ${locale}/${namespace}.json`)
      allFilesExist = false
    }
  }
}

console.log("\n📊 Summary:")
if (allFilesExist) {
  console.log("✅ All expected namespace files were generated successfully!")
  console.log("🎉 Namespace feature is working correctly!")
} else {
  console.log("❌ Some expected files are missing. Check the configuration.")
  process.exit(1)
}

// Step 5: Show file structure
console.log("\n📂 Generated file structure:")
function showDirectory(dir, prefix = "") {
  if (!fs.existsSync(dir)) return

  const items = fs.readdirSync(dir).sort()

  items.forEach((item, index) => {
    const itemPath = path.join(dir, item)
    const isLast = index === items.length - 1
    const currentPrefix = isLast ? "└── " : "├── "
    const nextPrefix = prefix + (isLast ? "    " : "│   ")

    console.log(prefix + currentPrefix + item)

    if (fs.statSync(itemPath).isDirectory()) {
      showDirectory(itemPath, nextPrefix)
    }
  })
}

showDirectory(localesDir)

console.log("\n🎯 Next steps:")
console.log("1. Add your OpenAI API key to root .env file (../.env)")
console.log(
  '2. Run "npm run i18n:sync" to generate translations for other locales',
)
console.log(
  '3. Run "npm run i18n:check" to verify all translations are complete',
)
console.log("4. Explore the generated JSON files in the locales/ directory")
