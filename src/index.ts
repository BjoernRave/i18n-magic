// Export command functions for programmatic usage
export { checkMissing } from "./commands/check-missing"
export { removeUnusedKeys } from "./commands/clean"

export { replaceTranslation } from "./commands/replace"
export { translateMissing } from "./commands/scan"
export { syncLocales } from "./commands/sync-locales"

// Export utility functions
export { loadConfig } from "./lib/utils"

// Export types

export type {
  CommandType,
  Configuration,
  GlobPatternConfig,
} from "./lib/types"
