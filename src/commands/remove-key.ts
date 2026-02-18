import prompts from "prompts"
import type { Configuration } from "../lib/types.js"
import { loadLocalesFile, writeLocalesFile } from "../lib/utils.js"

export const removeKey = async (config: Configuration, key?: string) => {
  const { namespaces, locales, loadPath, savePath } = config

  if (!key) {
    const response = await prompts({
      type: "text",
      name: "key",
      message: "Enter the translation key to remove:",
      validate: (value) => (value ? true : "Key cannot be empty"),
      onState: (state) => {
        if (state.aborted) {
          process.nextTick(() => {
            process.exit(0)
          })
        }
      },
    })

    key = response.key
  }

  if (!key) {
    console.log("\n❌ Operation cancelled. No key was provided.")
    return
  }

  console.log(
    `\n🔍 Searching for key "${key}" across all namespaces and locales...`,
  )

  const foundIn: Array<{ namespace: string; locale: string }> = []

  for (const namespace of namespaces) {
    for (const locale of locales) {
      try {
        const existingKeys = await loadLocalesFile(
          loadPath,
          locale,
          namespace,
          {
            silent: true,
          },
        )

        if (Object.hasOwn(existingKeys, key)) {
          foundIn.push({ namespace, locale })
        }
      } catch {
        // Skip if file doesn't exist or can't be read
      }
    }
  }

  if (foundIn.length === 0) {
    console.log(`\n❌ Key "${key}" not found in any namespace or locale.`)
    return
  }

  console.log(`\n⚠️  Key "${key}" found in ${foundIn.length} location(s):\n`)

  const maxToShow = 20
  const itemsToShow = foundIn.slice(0, maxToShow)

  for (const { namespace, locale } of itemsToShow) {
    console.log(`   • ${locale}:${namespace}`)
  }

  if (foundIn.length > maxToShow) {
    console.log(`   ... and ${foundIn.length - maxToShow} more`)
  }

  console.log("")

  const { confirmed } = await prompts({
    type: "confirm",
    name: "confirmed",
    message: `Do you want to remove "${key}" from ${foundIn.length} location(s)?`,
    initial: false,
    onState: (state) => {
      if (state.aborted) {
        process.nextTick(() => {
          process.exit(0)
        })
      }
    },
  })

  if (!confirmed) {
    console.log("\n❌ Operation cancelled. No keys were removed.")
    return
  }

  console.log(`\n🗑️  Removing key "${key}"...`)

  let removedCount = 0

  for (const { namespace, locale } of foundIn) {
    try {
      const existingKeys = await loadLocalesFile(loadPath, locale, namespace, {
        silent: true,
      })

      if (Object.hasOwn(existingKeys, key)) {
        delete existingKeys[key]
        await writeLocalesFile(savePath, locale, namespace, existingKeys)
        removedCount++
        console.log(`   ✓ Removed from ${locale}:${namespace}`)
      }
    } catch (error) {
      console.error(
        `   ✗ Failed to remove from ${locale}:${namespace}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  console.log(
    `\n✅ Successfully removed key "${key}" from ${removedCount} location(s)`,
  )
}
