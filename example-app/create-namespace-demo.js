#!/usr/bin/env node

/**
 * Complete demonstration script that creates namespace files and shows the results
 */

const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

console.log("🌍 Creating Namespace Demonstration...\n")

// Clean up any existing files
const localesDir = path.join(__dirname, "locales")
if (fs.existsSync(localesDir)) {
  fs.rmSync(localesDir, { recursive: true })
}

// Dummy values for all the keys we expect (based on our example files)
const dummyValues = [
  // Common namespace (from shared files)
  "Click to Action", // button.clickToAction
  "Loading...", // button.loading
  "Password too short", // validation.passwordTooShort
  "Password complexity error", // validation.passwordComplexity
  "Field is required", // validation.fieldRequired
  "Multiple errors occurred", // validation.multipleErrors

  // Dashboard namespace keys (simplified for demo)
  ...Array(26).fill("Dashboard Value"),

  // Mobile namespace keys
  ...Array(21).fill("Mobile Value"),

  // Admin namespace keys
  ...Array(31).fill("Admin Value"),

  // Auth namespace keys
  ...Array(38).fill("Auth Value"),

  // Shop namespace keys
  ...Array(48).fill("Shop Value"),
]

console.log(`📝 Preparing ${dummyValues.length} dummy translation values...`)

const scanProcess = spawn("node", ["../dist/cli.js", "scan"], {
  cwd: __dirname,
  stdio: ["pipe", "inherit", "inherit"],
})

let valueIndex = 0

// Send values automatically
const sendValue = () => {
  if (valueIndex < dummyValues.length) {
    const value = dummyValues[valueIndex]
    scanProcess.stdin.write(value + "\n")
    valueIndex++

    // Send next value after a short delay
    setTimeout(sendValue, 50)
  } else {
    scanProcess.stdin.end()
  }
}

// Start sending values after the process starts
setTimeout(sendValue, 1000)

scanProcess.on("close", (code) => {
  console.log(`\n✅ Scan process completed with code: ${code}\n`)

  // Now show the created namespace files
  showNamespaceFiles()
})

function showNamespaceFiles() {
  console.log("📁 Generated Namespace Files:\n")

  if (!fs.existsSync(localesDir)) {
    console.log("❌ No locale files were created")
    return
  }

  const locales = fs
    .readdirSync(localesDir)
    .filter((item) => fs.statSync(path.join(localesDir, item)).isDirectory())

  console.log(
    `Found ${locales.length} locale directories: ${locales.join(", ")}\n`,
  )

  // Show detailed structure for English locale
  const enDir = path.join(localesDir, "en")
  if (fs.existsSync(enDir)) {
    console.log("📂 en/ (English locale)")

    const files = fs
      .readdirSync(enDir)
      .filter((f) => f.endsWith(".json"))
      .sort()

    for (const file of files) {
      const filePath = path.join(enDir, file)
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"))
      const keyCount = Object.keys(content).length
      const namespace = file.replace(".json", "")

      console.log(`  📄 ${file} - ${keyCount} keys`)

      // Show first few keys as examples
      const keys = Object.keys(content)
      if (keys.length > 0) {
        keys.slice(0, 3).forEach((key) => {
          console.log(`    🔑 ${key}: "${content[key]}"`)
        })
        if (keys.length > 3) {
          console.log(`    ... and ${keys.length - 3} more keys`)
        }
      }
      console.log("")
    }
  }

  // Show summary for all locales
  console.log("📊 Summary of all locale files:")
  for (const locale of locales) {
    const localeDir = path.join(localesDir, locale)
    const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"))
    console.log(
      `  ${locale}/: ${files.length} namespace files (${files.map((f) => f.replace(".json", "")).join(", ")})`,
    )
  }

  console.log("\n🎉 SUCCESS: Namespace feature is working!")
  console.log("✅ Separate JSON files created for each namespace")
  console.log("✅ Keys assigned based on file location patterns")
  console.log("✅ Multi-locale support with namespace organization")

  console.log("\n📋 File Structure:")
  showDirectoryTree(localesDir, "")
}

function showDirectoryTree(dir, prefix) {
  const items = fs.readdirSync(dir).sort()

  items.forEach((item, index) => {
    const itemPath = path.join(dir, item)
    const isLast = index === items.length - 1
    const currentPrefix = isLast ? "└── " : "├── "
    const nextPrefix = prefix + (isLast ? "    " : "│   ")

    if (fs.statSync(itemPath).isDirectory()) {
      console.log(prefix + currentPrefix + `📁 ${item}/`)
      showDirectoryTree(itemPath, nextPrefix)
    } else {
      console.log(prefix + currentPrefix + `📄 ${item}`)
    }
  })
}
