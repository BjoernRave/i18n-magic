import { Command } from "commander"
import dotenv from "dotenv"
import OpenAI from "openai"
import { checkMissing } from "./commands/check-missing.js"
import { removeUnusedKeys } from "./commands/clean.js"

import { replaceTranslation } from "./commands/replace.js"
import { translateMissing } from "./commands/scan.js"
import { syncLocales } from "./commands/sync-locales.js"
import type { CommandType, Configuration } from "./lib/types.js"
import { loadConfig } from "./lib/utils.js"

const program = new Command()

program
  .name("i18n-magic")
  .description(
    "CLI to help you manage your locales JSON with translations, replacements, etc. with OpenAI.",
  )
  .version("0.2.0")
  .option("-c, --config <path>", "path to config file")
  .option("-e, --env <path>", "path to .env file")

const commands: CommandType[] = [
  {
    name: "scan",
    description:
      "Scan for missing translations, get prompted for each, translate it to the other locales and save it to the JSON file.",
    action: translateMissing,
  },
  {
    name: "replace",
    description:
      "Replace a translation based on the key, and translate it to the other locales and save it to the JSON file.",
    action: replaceTranslation,
  },
  {
    name: "check-missing",
    description:
      "Check if there are any missing translations. Useful for a CI/CD pipeline or husky hook.",
    action: checkMissing,
  },
  {
    name: "sync",
    description:
      "Sync the translations from the default locale to the other locales. Useful for a CI/CD pipeline or husky hook.",
    action: syncLocales,
  },
  {
    name: "clean",
    description:
      "Remove unused translations from all locales. Useful for a CI/CD pipeline or husky hook.",
    action: removeUnusedKeys,
  },
]

for (const command of commands) {
  const cmd = program.command(command.name).description(command.description)

  // Add key option to replace command
  if (command.name === "replace") {
    cmd
      .option("-k, --key <key>", "translation key to replace")
      .allowExcessArguments(true)
      .argument("[key]", "translation key to replace")
  }

  cmd.action(async (arg, options) => {
    const res = dotenv.config({
      path: program.opts().env || ".env",
    })

    const config: Configuration = await loadConfig({
      configPath: program.opts().config,
    })

    const isGemini = (config.model as string)?.includes("gemini")

    // Get API key from environment or config
    const openaiKey = res.parsed.OPENAI_API_KEY || config.OPENAI_API_KEY
    const geminiKey = res.parsed.GEMINI_API_KEY || config.GEMINI_API_KEY

    // Select appropriate key based on model type
    const key = isGemini ? geminiKey : openaiKey

    if (!key) {
      const keyType = isGemini ? "GEMINI_API_KEY" : "OPENAI_API_KEY"
      console.error(
        `Please provide a${isGemini ? " Gemini" : "n OpenAI"} API key in your .env file or config, called ${keyType}.`,
      )
      process.exit(1)
    }

    const openai = new OpenAI({
      apiKey: key,
      ...(isGemini && {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
    })

    // For replace command, check for key in argument or option
    if (command.name === "replace") {
      // If key is provided as positional argument, use that first
      const keyToUse = typeof arg === "string" ? arg : options.key
      command.action({ ...config, openai }, keyToUse)
    } else {
      command.action({ ...config, openai })
    }
  })
}

program.parse(process.argv)
