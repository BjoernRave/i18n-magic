#!/usr/bin/env node

// Debug script to test namespace matching
const { getNamespacesForFile } = require("./dist/lib/utils")

// Your actual glob patterns from the scoutello project
const globPatterns = [
  {
    pattern: "apps/dashboard/components/**/*.{js,ts,tsx}",
    namespaces: ["dashboard"],
  },
  {
    pattern: "apps/dashboard/lib/**/*.{js,ts,tsx}",
    namespaces: ["dashboard"],
  },
  {
    pattern: "apps/dashboard/pages/**/*.{js,ts,tsx}",
    namespaces: ["dashboard"],
  },
  {
    pattern: "apps/landing/components/**/*.{js,ts,tsx}",
    namespaces: ["landing"],
  },
  { pattern: "apps/landing/app/**/*.{js,ts,tsx}", namespaces: ["landing"] },
  { pattern: "apps/mobile/app/**/*.{js,ts,tsx}", namespaces: ["mobile"] },
  { pattern: "apps/mobile/lib/**/*.{js,ts,tsx}", namespaces: ["mobile"] },
  {
    pattern: "apps/mobile/components/**/*.{js,ts,tsx}",
    namespaces: ["mobile"],
  },
  {
    pattern: "packages/ui/**/*.{js,ts,tsx}",
    namespaces: ["mobile", "dashboard", "landing"],
  },
  {
    pattern: "packages/shared/constants.ts",
    namespaces: ["mobile", "dashboard", "landing"],
  },
  {
    pattern: "packages/shared/utils.ts",
    namespaces: ["mobile", "dashboard", "landing"],
  },
  { pattern: "packages/api/**/*.{js,ts,tsx}", namespaces: ["dashboard"] },
  {
    pattern: "packages/shared/tileTypes.ts",
    namespaces: ["dashboard", "mobile", "landing"],
  },
  {
    pattern: "packages/mail/components/**/*.{js,ts,tsx}",
    namespaces: ["dashboard"],
  },
  {
    pattern: "packages/mail/emails/**/*.{js,ts,tsx}",
    namespaces: ["dashboard"],
  },
]

const defaultNamespace = "common"

// Test some example file paths
const testFiles = [
  "apps/dashboard/components/Button.tsx",
  "apps/mobile/app/screen.tsx",
  "packages/ui/Button.tsx",
  "packages/shared/constants.ts",
  "some/other/file.tsx",
]

console.log("Testing namespace matching...\n")

for (const filePath of testFiles) {
  const namespaces = getNamespacesForFile(
    filePath,
    globPatterns,
    defaultNamespace,
  )
  console.log(`File: ${filePath}`)
  console.log(`Namespaces: ${namespaces.join(", ")}`)
  console.log("---")
}
