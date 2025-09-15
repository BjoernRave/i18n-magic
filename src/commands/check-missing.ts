import type { Configuration } from "../lib/types.js"
import { getMissingKeys } from "../lib/utils.js"

export const checkMissing = async (config: Configuration) => {
  const newKeys = await getMissingKeys(config)

  if (newKeys.length > 0) {
    console.error("Error: Missing translations found!")
    process.exit(1)
  }
}
