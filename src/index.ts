// Export command functions for programmatic usage
export { checkMissing } from "./commands/check-missing.js"
export { removeUnusedKeys } from "./commands/clean.js"

export { replaceTranslation } from "./commands/replace.js"
export { translateMissing } from "./commands/scan.js"
export { syncLocales } from "./commands/sync-locales.js"

// Export utility functions
export { loadConfig } from "./lib/utils.js"

// Export types

export type {
  CommandType,
  Configuration,
  GlobPatternConfig,
} from "./lib/types.js"
