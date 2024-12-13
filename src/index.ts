import { Command } from "commander"
import dotenv from "dotenv"
import OpenAI from "openai"
import { checkMissing } from "./commands/check-missing"
import { replaceTranslation } from "./commands/replace"
import { translateMissing } from "./commands/scan"
import type { CommandType } from "./lib/types"
import { loadConfig } from "./lib/utils"

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
]

for (const command of commands) {
  program
    .command(command.name)
    .description(command.description)
    .action(async () => {
      const res = dotenv.config({
        path: program.opts().env || ".env",
      })

      const key = res.parsed?.OPENAI_API_KEY

      const config = await loadConfig({
        configPath: program.opts().config,
      })

      if (!key) {
        console.error(
          "Please provide an OpenAI API key in your .env file, called OPENAI_API_KEY.",
        )
        process.exit(0)
      }

      const openai = new OpenAI({
        apiKey: key,
      })

      command.action({ ...config, openai })
    })
}

program.parse(process.argv)
