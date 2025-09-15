#!/usr/bin/env node

/**
 * Interactive demo script showing namespace features
 * Run with: node demo.js
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

function showHeader() {
  console.clear()
  console.log("🌍 i18n-magic Namespace Demo")
  console.log("================================\n")
}

function showMenu() {
  console.log("Choose an action:")
  console.log("1. 🔍 Scan and generate namespace files")
  console.log("2. 🧹 Clean unused translations")
  console.log("3. 🔄 Sync translations to other locales")
  console.log("4. 📊 Check missing translations")
  console.log("5. 🐛 Debug namespace matching")
  console.log("6. 📁 View generated files")
  console.log("7. 🧪 Run full test suite")
  console.log("8. ❓ Show namespace info")
  console.log("0. 🚪 Exit\n")
}

async function runCommand(command, description) {
  console.log(`\n${description}...`)
  console.log(`Running: ${command}\n`)

  try {
    execSync(command, {
      cwd: __dirname,
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    })
    console.log(`\n✅ ${description} completed!`)
  } catch (error) {
    console.error(`\n❌ ${description} failed:`, error.message)
  }

  await question("\nPress Enter to continue...")
}

function showGeneratedFiles() {
  console.log("\n📁 Generated Translation Files:")
  console.log("================================\n")

  const localesDir = path.join(__dirname, "locales")

  if (!fs.existsSync(localesDir)) {
    console.log("❌ No locale files found. Run scan first!\n")
    return
  }

  function showDirectory(dir, prefix = "", maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) return

    const items = fs.readdirSync(dir).sort()

    items.forEach((item, index) => {
      const itemPath = path.join(dir, item)
      const isLast = index === items.length - 1
      const currentPrefix = isLast ? "└── " : "├── "
      const nextPrefix = prefix + (isLast ? "    " : "│   ")

      if (fs.statSync(itemPath).isDirectory()) {
        console.log(prefix + currentPrefix + `📁 ${item}/`)
        showDirectory(itemPath, nextPrefix, maxDepth, currentDepth + 1)
      } else if (item.endsWith(".json")) {
        const content = JSON.parse(fs.readFileSync(itemPath, "utf-8"))
        const keyCount = Object.keys(content).length
        console.log(prefix + currentPrefix + `📄 ${item} (${keyCount} keys)`)

        // Show sample keys
        const sampleKeys = Object.keys(content).slice(0, 2)
        if (sampleKeys.length > 0) {
          sampleKeys.forEach((key, idx) => {
            const isLastKey = idx === sampleKeys.length - 1 && keyCount <= 2
            const keyPrefix =
              prefix +
              (isLast ? "    " : "│   ") +
              (isLastKey ? "└── " : "├── ")
            console.log(keyPrefix + `🔑 ${key}: "${content[key]}"`)
          })
          if (keyCount > 2) {
            const morePrefix = prefix + (isLast ? "    " : "│   ") + "└── "
            console.log(morePrefix + `... and ${keyCount - 2} more keys`)
          }
        }
      }
    })
  }

  showDirectory(localesDir)
  console.log("")
}

function showNamespaceInfo() {
  console.log("\n📚 Namespace Configuration:")
  console.log("============================\n")

  const namespaces = [
    {
      name: "common",
      pattern: "./src/shared/**",
      description: "Shared components and utilities",
    },
    {
      name: "dashboard",
      pattern: "./src/dashboard/**",
      description: "Web dashboard interface",
    },
    {
      name: "mobile",
      pattern: "./src/mobile/**",
      description: "Mobile app screens and components",
    },
    {
      name: "admin",
      pattern: "./src/admin/**",
      description: "Admin panel and system settings",
    },
    {
      name: "auth",
      pattern: "./src/auth/**",
      description: "Authentication and user management",
    },
    {
      name: "shop",
      pattern: "./src/shop/**",
      description: "E-commerce and shopping features",
    },
  ]

  namespaces.forEach((ns, index) => {
    const isLast = index === namespaces.length - 1
    const prefix = isLast ? "└── " : "├── "

    console.log(`${prefix}📦 ${ns.name}`)
    console.log(`${isLast ? "    " : "│   "}├── Pattern: ${ns.pattern}`)
    console.log(`${isLast ? "    " : "│   "}└── ${ns.description}`)

    if (!isLast) console.log("│")
  })

  console.log("\n💡 How it works:")
  console.log(
    "• Files matching each pattern are automatically assigned to that namespace",
  )
  console.log(
    "• Translation keys found in those files go to namespace-specific JSON files",
  )
  console.log(
    "• Each locale gets separate files: en/common.json, en/dashboard.json, etc.",
  )
  console.log(
    "• This enables modular, organized translations for large applications\n",
  )
}

async function main() {
  showHeader()

  console.log("Welcome to the i18n-magic namespace demo!")
  console.log("This example shows how to automatically organize translations")
  console.log("into separate JSON files based on file location patterns.\n")

  while (true) {
    showMenu()

    const choice = await question("Enter your choice (0-8): ")

    switch (choice) {
      case "1":
        await runCommand(
          "node ../dist/cli.js scan",
          "🔍 Scanning for translation keys",
        )
        break

      case "2":
        await runCommand(
          "node ../dist/cli.js clean",
          "🧹 Cleaning unused translations",
        )
        break

      case "3":
        await runCommand(
          "node ../dist/cli.js sync-locales",
          "🔄 Syncing translations",
        )
        break

      case "4":
        await runCommand(
          "node ../dist/cli.js check-missing",
          "📊 Checking missing translations",
        )
        break

      case "5":
        await runCommand(
          "DEBUG_NAMESPACE_MATCHING=true node ../dist/cli.js scan",
          "🐛 Debug namespace matching",
        )
        break

      case "6":
        showGeneratedFiles()
        await question("Press Enter to continue...")
        break

      case "7":
        console.log("\n🧪 Running full test suite...")
        await runCommand("node test-script.js", "🧪 Full test suite")
        break

      case "8":
        showNamespaceInfo()
        await question("Press Enter to continue...")
        break

      case "0":
        console.log("\n👋 Thanks for trying the i18n-magic namespace demo!")
        rl.close()
        return

      default:
        console.log("\n❌ Invalid choice. Please try again.")
        await question("Press Enter to continue...")
    }

    showHeader()
  }
}

// Handle cleanup
process.on("SIGINT", () => {
  console.log("\n\n👋 Goodbye!")
  rl.close()
  process.exit(0)
})

main().catch(console.error)
