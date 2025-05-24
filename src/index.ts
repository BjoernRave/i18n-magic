// Export command functions for programmatic usage
export { checkMissing } from "./commands/check-missing"
export { removeUnusedKeys } from "./commands/clean"
export { createPrunedNamespace } from "./commands/create-pruned-namespace"
export { createPrunedNamespaceAutomated } from "./commands/create-pruned-namespace-automated"
export { replaceTranslation } from "./commands/replace"
export { translateMissing } from "./commands/scan"
export { syncLocales } from "./commands/sync-locales"

// Export utility functions
export { loadConfig } from "./lib/utils"

// Export types
export type {
  PruneOptions,
  PruneResponse,
  PruneResult,
} from "./commands/create-pruned-namespace-automated"
export type {
  CommandType,
  Configuration,
  NamespacePruneConfig,
} from "./lib/types"
