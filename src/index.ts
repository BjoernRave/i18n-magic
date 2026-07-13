// Export command functions for programmatic usage
export {
  checkMissing,
  collectMissingTranslations,
  MissingTranslationsError,
} from "./commands/check-missing.js"
export type { MissingTranslationsReport } from "./commands/check-missing.js"
export { removeUnusedKeys } from "./commands/clean.js"

export { replaceTranslation } from "./commands/replace.js"
export { translateMissing } from "./commands/scan.js"
export { syncLocales } from "./commands/sync-locales.js"

// Export utility functions
export { addTranslationKey, loadConfig } from "./lib/utils.js"

// Export types

export type {
  CommandType,
  Configuration,
  GlobPatternConfig,
} from "./lib/types.js"
