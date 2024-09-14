import type { Configuration } from "../lib/types"
import { getMissingKeys } from "../lib/utils"

export const checkMissing = async (config: Configuration) => {
  const newKeys = await getMissingKeys(config)

  if (newKeys.length > 0) {
    console.error("Error: Missing translations found!")
    process.exit(1)
  }
}
