import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import fs from "fs"
import OpenAI from "openai"
import path from "path"
import { fileURLToPath } from "url"
import { z } from "zod"
import type { Configuration } from "./lib/types.js"
import {
  addTranslationKey,
  addTranslationKeys,
  getMissingKeys,
  loadConfig,
  loadLocalesFile,
} from "./lib/utils.js"

// Simple mutex for preventing concurrent write operations
class AsyncMutex {
  private locked = false
  private queue: Array<() => void> = []

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }

    return new Promise((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      next?.()
    } else {
      this.locked = false
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

// Global mutex for all translation file operations
const translationMutex = new AsyncMutex()

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper function to find project root by looking for i18n-magic.js
function findProjectRoot(startDir: string): string | null {
  let currentDir = startDir
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    const configPath = path.join(currentDir, "i18n-magic.js")
    if (fs.existsSync(configPath)) {
      return currentDir
    }
    currentDir = path.dirname(currentDir)
  }

  return null
}

// Helper function to resolve project root
function resolveProjectRoot(): string {
  // 1. Check for --project-root CLI argument
  const args = process.argv.slice(2)
  const projectRootIndex = args.indexOf("--project-root")
  if (projectRootIndex !== -1 && args[projectRootIndex + 1]) {
    const projectRoot = args[projectRootIndex + 1]
    console.error(
      `[i18n-magic MCP] Using project root from --project-root: ${projectRoot}`,
    )
    return path.resolve(projectRoot)
  }

  // 2. Check for I18N_MCP_PROJECT_ROOT environment variable
  if (process.env.I18N_MCP_PROJECT_ROOT) {
    const projectRoot = process.env.I18N_MCP_PROJECT_ROOT
    console.error(
      `[i18n-magic MCP] Using project root from I18N_MCP_PROJECT_ROOT: ${projectRoot}`,
    )
    return path.resolve(projectRoot)
  }

  // 3. Try to auto-detect project root from script location
  // When installed in node_modules, traverse up to find i18n-magic.js
  const autoDetected = findProjectRoot(__dirname)
  if (autoDetected) {
    console.error(
      `[i18n-magic MCP] Auto-detected project root: ${autoDetected}`,
    )
    return autoDetected
  }

  // 4. Fall back to current working directory
  const cwd = process.cwd()
  console.error(
    `[i18n-magic MCP] Using current working directory as project root: ${cwd}`,
  )
  return cwd
}

// Zod schema for the add_translation_key tool parameters
const AddTranslationKeySchema = z.object({
  key: z
    .string()
    .describe('The translation key to add (e.g., "welcomeMessage")'),
  value: z.string().describe("The text value for this translation key"),
  language: z
    .string()
    .optional()
    .describe(
      'The language code of the provided value (e.g., "en", "de", "fr"). Defaults to "en" (English) if not specified.',
    ),
})

// Zod schema for the add_translation_keys (batch) tool parameters
const AddTranslationKeysSchema = z.object({
  keys: z
    .array(
      z.object({
        key: z
          .string()
          .describe('The translation key to add (e.g., "welcomeMessage")'),
        value: z.string().describe("The text value for this translation key"),
        language: z
          .string()
          .optional()
          .describe(
            'The language code of the provided value (e.g., "en", "de", "fr"). Defaults to "en" (English) if not specified.',
          ),
      }),
    )
    .describe(
      "Array of translation keys to add in batch. Use this for adding multiple keys at once for better performance.",
    ),
})

// Zod schema for the list_untranslated_keys tool parameters
const ListUntranslatedKeysSchema = z.object({
  namespace: z
    .string()
    .optional()
    .describe(
      "Optional namespace to check. If not provided, checks all namespaces.",
    ),
})

// Zod schema for the get_translation_key tool parameters
const GetTranslationKeySchema = z.object({
  key: z
    .string()
    .describe('The translation key to retrieve (e.g., "welcomeMessage")'),
  namespace: z
    .string()
    .optional()
    .describe(
      "Optional namespace to search in. If not provided, searches in default namespace first, then all namespaces.",
    ),
})

// Zod schema for the update_translation_key tool parameters
const UpdateTranslationKeySchema = z.object({
  key: z
    .string()
    .describe('The translation key to update (e.g., "welcomeMessage")'),
  value: z.string().describe("The new text value for this translation key"),
  language: z
    .string()
    .optional()
    .describe(
      'The language code of the provided value (e.g., "en", "de", "fr"). Defaults to "en" (English) if not specified.',
    ),
  namespace: z
    .string()
    .optional()
    .describe(
      "Optional namespace to update. If not provided, updates the key in all namespaces where it exists.",
    ),
})

// Zod schema for the search_translations tool parameters
const SearchTranslationsSchema = z.object({
  query: z
    .string()
    .describe(
      "Search term to find in translation keys or values (fuzzy search)",
    ),
})

class I18nMagicServer {
  private server: Server
  private config: Configuration | null = null

  constructor() {
    this.server = new Server(
      {
        name: "i18n-magic-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.setupToolHandlers()

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error)
    process.on("SIGINT", async () => {
      await this.server.close()
      process.exit(0)
    })
  }

  private async ensureConfig(): Promise<Configuration> {
    if (!this.config) {
      try {
        this.config = await loadConfig()

        // Initialize OpenAI client if API key is available in config
        const isGemini = (this.config.model as string)?.includes("gemini")
        const openaiKey = this.config.OPENAI_API_KEY
        const geminiKey = this.config.GEMINI_API_KEY
        const key = isGemini ? geminiKey : openaiKey

        if (key) {
          this.config.openai = new OpenAI({
            apiKey: key,
            ...(isGemini && {
              baseURL:
                "https://generativelanguage.googleapis.com/v1beta/openai/",
            }),
          })
          console.error(
            `[i18n-magic MCP] Initialized ${isGemini ? "Gemini" : "OpenAI"} client`,
          )
        } else {
          console.error(
            "[i18n-magic MCP] No API key found in config. Automatic translation will be disabled.",
          )
        }

        console.error(
          `[i18n-magic MCP] Loaded configuration with ${this.config.namespaces.length} namespaces and ${this.config.locales.length} locales`,
        )
      } catch (error) {
        console.error("[i18n-magic MCP] Failed to load configuration:", error)
        throw new Error(
          "Failed to load i18n-magic configuration. Make sure i18n-magic.js exists in the current directory.",
        )
      }
    }
    return this.config
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "add_translation_key",
            description:
              "Add a new translation key with a text value. You can optionally specify the language of the value you're providing (defaults to English). For adding multiple keys at once, use add_translation_keys instead for better performance. NOTE: This tool can only ADD keys, it will NEVER remove any existing keys.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    'The translation key to add (e.g., "welcomeMessage")',
                },
                value: {
                  type: "string",
                  description: "The text value for this translation key",
                },
                language: {
                  type: "string",
                  description:
                    'The language code of the provided value (e.g., "en" for English, "de" for German, "fr" for French). Defaults to "en" if not specified.',
                },
              },
              required: ["key", "value"],
            },
          },
          {
            name: "add_translation_keys",
            description:
              "Add multiple translation keys in batch. This is optimized for performance - when adding 2 or more keys, prefer this over multiple add_translation_key calls. It performs a single codebase scan, batches file I/O operations, and batches translations for much better performance. NOTE: This tool can only ADD keys, it will NEVER remove any existing keys.",
            inputSchema: {
              type: "object",
              properties: {
                keys: {
                  type: "array",
                  description: "Array of translation keys to add in batch",
                  items: {
                    type: "object",
                    properties: {
                      key: {
                        type: "string",
                        description:
                          'The translation key to add (e.g., "welcomeMessage")',
                      },
                      value: {
                        type: "string",
                        description: "The text value for this translation key",
                      },
                      language: {
                        type: "string",
                        description:
                          'The language code of the provided value (e.g., "en" for English, "de" for German, "fr" for French). Defaults to "en" if not specified.',
                      },
                    },
                    required: ["key", "value"],
                  },
                },
              },
              required: ["keys"],
            },
          },
          {
            name: "list_untranslated_keys",
            description:
              "List all translation keys that are used in the codebase but are not yet defined in the locale files. This helps identify missing translations that need to be added. The tool scans the codebase for translation keys and compares them against existing locale files. NOTE: This is a read-only tool that does not modify any files.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: {
                  type: "string",
                  description:
                    "Optional namespace to check. If not provided, checks all namespaces.",
                },
              },
              required: [],
            },
          },
          {
            name: "get_translation_key",
            description:
              "Retrieve the English value for a specific translation key. This tool searches for the key in the locale files and always returns the English translation if it exists. NOTE: This is a read-only tool that does not modify any files.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    'The translation key to retrieve (e.g., "welcomeMessage")',
                },
                namespace: {
                  type: "string",
                  description:
                    "Optional namespace to search in. If not provided, searches in default namespace first, then all namespaces.",
                },
              },
              required: ["key"],
            },
          },
          {
            name: "update_translation_key",
            description:
              "Update an existing translation key with a new text value. You can optionally specify the language of the value you're providing (defaults to English). This will update the key across all locales (translating automatically to other languages) and all namespaces where the key exists. Use this when you need to fix typos, improve wording, or change the text of an existing translation. If you're not sure if a key exists, use get_translation_key or search_translations first. NOTE: This tool can only UPDATE existing keys, it will NEVER remove any keys.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    'The translation key to update (e.g., "welcomeMessage")',
                },
                value: {
                  type: "string",
                  description: "The new text value for this translation key",
                },
                language: {
                  type: "string",
                  description:
                    'The language code of the provided value (e.g., "en" for English, "de" for German, "fr" for French). Defaults to "en" if not specified.',
                },
                namespace: {
                  type: "string",
                  description:
                    "Optional namespace to update. If not provided, updates the key in all namespaces where it exists.",
                },
              },
              required: ["key", "value"],
            },
          },
          {
            name: "search_translations",
            description:
              "Search for translations by keyword or phrase across ALL namespaces. This tool performs fuzzy search across both translation keys AND their English values, making it perfect for finding existing translations before adding new ones. Use this to: 1) Check if similar text already exists to avoid duplicates, 2) Find the key name when you only remember part of the text, 3) Discover related translations. Always returns the key name AND English value for each result. NOTE: This is a read-only tool that does not modify any files.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description:
                    "Search term to find in translation keys or values (e.g., 'password', 'welcome', 'click'). Fuzzy search - doesn't need to be exact. Searches across all namespaces.",
                },
              },
              required: ["query"],
            },
          },
        ],
      }
    })

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "add_translation_key") {
        try {
          // Validate parameters
          const params = AddTranslationKeySchema.parse(request.params.arguments)

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Capture console.log output for diagnostics
          const originalConsoleLog = console.log
          const logMessages: string[] = []
          console.log = (...args: any[]) => {
            const message = args
              .map((arg) =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg),
              )
              .join(" ")
            logMessages.push(message)
            // Also log to stderr for debugging
            console.error(`[i18n-magic] ${message}`)
          }

          let result
          try {
            // Add the translation key - use mutex to prevent concurrent writes
            result = await translationMutex.withLock(async () => {
              return await addTranslationKey({
                key: params.key,
                value: params.value,
                language: params.language || "en",
                config,
              })
            })
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Successfully added translation key "${result.key}" to affected namespaces: ${result.namespace} (locales: ${result.locale})`,
                    key: result.key,
                    value: result.value,
                    providedLanguage: params.language || "en",
                    namespace: result.namespace,
                    locales: result.locale,
                    nextStep: result.locale.includes(",")
                      ? "Key was automatically translated to multiple locales"
                      : "Run 'i18n-magic sync' to translate this key to other locales",
                    diagnostics: logMessages.join("\n"),
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          // Get more detailed error information
          let errorDetails = errorMessage
          if (error instanceof Error) {
            // Check if there's a cause
            const cause = (error as any).cause
            if (cause instanceof Error) {
              errorDetails = `${errorMessage}\nCause: ${cause.message}\nStack: ${cause.stack}`
            } else if (cause) {
              errorDetails = `${errorMessage}\nCause: ${JSON.stringify(cause)}`
            }
            // Include stack trace
            if (error.stack) {
              errorDetails = `${errorDetails}\nStack: ${error.stack}`
            }
          }

          // Log detailed error to stderr for debugging
          console.error(`[i18n-magic MCP] Error adding translation key:`)
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      if (request.params.name === "add_translation_keys") {
        try {
          // Validate parameters
          const params = AddTranslationKeysSchema.parse(
            request.params.arguments,
          )

          if (!params.keys || params.keys.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error:
                        "No keys provided. The 'keys' array must contain at least one key-value pair.",
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            }
          }

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Capture console.log output for diagnostics
          const originalConsoleLog = console.log
          const logMessages: string[] = []
          console.log = (...args: any[]) => {
            const message = args
              .map((arg) =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg),
              )
              .join(" ")
            logMessages.push(message)
            // Also log to stderr for debugging
            console.error(`[i18n-magic] ${message}`)
          }

          let result
          try {
            // Add the translation keys in batch - use mutex to prevent concurrent writes
            result = await translationMutex.withLock(async () => {
              return await addTranslationKeys({
                keys: params.keys.map((k) => ({
                  key: k.key,
                  value: k.value,
                  language: k.language || "en",
                })),
                config,
              })
            })
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Successfully added ${result.results.length} translation key(s) in batch`,
                    results: result.results,
                    performance: result.performance,
                    summary: {
                      totalKeys: result.results.length,
                      totalTime: `${result.performance.totalTime.toFixed(2)}ms`,
                      averageTimePerKey: `${(result.performance.totalTime / result.results.length).toFixed(2)}ms`,
                      scanTime: `${result.performance.scanTime.toFixed(2)}ms`,
                      translationTime: `${result.performance.translationTime.toFixed(2)}ms`,
                      fileIOTime: `${result.performance.fileIOTime.toFixed(2)}ms`,
                    },
                    diagnostics: logMessages.join("\n"),
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          // Get more detailed error information
          let errorDetails = errorMessage
          if (error instanceof Error) {
            // Check if there's a cause
            const cause = (error as any).cause
            if (cause instanceof Error) {
              errorDetails = `${errorMessage}\nCause: ${cause.message}\nStack: ${cause.stack}`
            } else if (cause) {
              errorDetails = `${errorMessage}\nCause: ${JSON.stringify(cause)}`
            }
            // Include stack trace
            if (error.stack) {
              errorDetails = `${errorDetails}\nStack: ${error.stack}`
            }
          }

          // Log detailed error to stderr for debugging
          console.error(
            `[i18n-magic MCP] Error adding translation keys in batch:`,
          )
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      if (request.params.name === "list_untranslated_keys") {
        try {
          // Validate parameters
          const params = ListUntranslatedKeysSchema.parse(
            request.params.arguments,
          )

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Suppress console.log to prevent interference with MCP JSON protocol
          const originalConsoleLog = console.log
          console.log = () => {}

          let missingKeys
          try {
            // Get missing keys from the codebase
            missingKeys = await getMissingKeys(config)
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }

          // Filter by namespace if specified
          let filteredKeys = missingKeys
          if (params.namespace) {
            filteredKeys = missingKeys.filter((item) =>
              item.namespaces.includes(params.namespace!),
            )
          }

          // Extract just the keys (sorted and unique)
          const uniqueKeys = Array.from(
            new Set(filteredKeys.map((item) => item.key)),
          ).sort()

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message:
                      filteredKeys.length === 0
                        ? "No missing translation keys found! All keys used in the codebase are defined."
                        : `Found ${filteredKeys.length} missing translation key${filteredKeys.length === 1 ? "" : "s"}`,
                    missingKeys: uniqueKeys,
                    nextSteps:
                      filteredKeys.length > 0
                        ? [
                            "Use add_translation_key to add these keys with English values",
                            "Or run 'i18n-magic scan' to add them interactively",
                          ]
                        : [],
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          // Get more detailed error information
          let errorDetails = errorMessage
          if (error instanceof Error) {
            const cause = (error as any).cause
            if (cause instanceof Error) {
              errorDetails = `${errorMessage}\nCause: ${cause.message}\nStack: ${cause.stack}`
            } else if (cause) {
              errorDetails = `${errorMessage}\nCause: ${JSON.stringify(cause)}`
            }
            if (error.stack) {
              errorDetails = `${errorDetails}\nStack: ${error.stack}`
            }
          }

          // Log detailed error to stderr for debugging
          console.error(`[i18n-magic MCP] Error listing untranslated keys:`)
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      if (request.params.name === "get_translation_key") {
        try {
          // Validate parameters
          const params = GetTranslationKeySchema.parse(request.params.arguments)

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Suppress console.log to prevent interference with MCP JSON protocol
          const originalConsoleLog = console.log
          console.log = () => {}

          let foundValue: string | null = null
          let foundNamespace: string | null = null

          try {
            // If namespace is specified, only check that namespace
            if (params.namespace) {
              const keys = await loadLocalesFile(
                config.loadPath,
                "en",
                params.namespace,
              )
              if (keys[params.key]) {
                foundValue = keys[params.key]
                foundNamespace = params.namespace
              }
            } else {
              // Try default namespace first
              try {
                const keys = await loadLocalesFile(
                  config.loadPath,
                  "en",
                  config.defaultNamespace,
                )
                if (keys[params.key]) {
                  foundValue = keys[params.key]
                  foundNamespace = config.defaultNamespace
                }
              } catch (error) {
                // Default namespace file doesn't exist or has issues, continue to search other namespaces
              }

              // If not found in default namespace, search all other namespaces
              if (!foundValue) {
                for (const namespace of config.namespaces) {
                  if (namespace === config.defaultNamespace) continue // Already checked

                  try {
                    const keys = await loadLocalesFile(
                      config.loadPath,
                      "en",
                      namespace,
                    )
                    if (keys[params.key]) {
                      foundValue = keys[params.key]
                      foundNamespace = namespace
                      break
                    }
                  } catch (error) {
                    // Namespace file doesn't exist or has issues, continue
                  }
                }
              }
            }
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }

          if (foundValue) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      key: params.key,
                      value: foundValue,
                      namespace: foundNamespace,
                      locale: "en",
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: `Translation key "${params.key}" not found in English locale${params.namespace ? ` (namespace: ${params.namespace})` : ""}`,
                      key: params.key,
                      searchedNamespace: params.namespace || "all namespaces",
                      suggestion:
                        "Use list_untranslated_keys to see all missing keys or add_translation_key to add this key",
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: false,
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          // Get more detailed error information
          let errorDetails = errorMessage
          if (error instanceof Error) {
            const cause = (error as any).cause
            if (cause instanceof Error) {
              errorDetails = `${errorMessage}\nCause: ${cause.message}\nStack: ${cause.stack}`
            } else if (cause) {
              errorDetails = `${errorMessage}\nCause: ${JSON.stringify(cause)}`
            }
            if (error.stack) {
              errorDetails = `${errorDetails}\nStack: ${error.stack}`
            }
          }

          // Log detailed error to stderr for debugging
          console.error(`[i18n-magic MCP] Error getting translation key:`)
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      if (request.params.name === "update_translation_key") {
        try {
          // Validate parameters
          const params = UpdateTranslationKeySchema.parse(
            request.params.arguments,
          )

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Suppress console.log to prevent interference with MCP JSON protocol
          const originalConsoleLog = console.log
          const logMessages: string[] = []
          console.log = (...args: any[]) => {
            const message = args
              .map((arg) =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg),
              )
              .join(" ")
            logMessages.push(message)
            console.error(`[i18n-magic] ${message}`)
          }

          try {
            // Use mutex to prevent concurrent writes
            const result = await translationMutex.withLock(async () => {
              // Find which namespaces contain this key
              const targetNamespaces: string[] = []

              if (params.namespace) {
                // Check if key exists in specified namespace
                const keys = await loadLocalesFile(
                  config.loadPath,
                  "en",
                  params.namespace,
                )
                if (keys[params.key]) {
                  targetNamespaces.push(params.namespace)
                } else {
                  throw new Error(
                    `Key "${params.key}" does not exist in namespace "${params.namespace}"`,
                  )
                }
              } else {
                // Find all namespaces where this key exists
                for (const namespace of config.namespaces) {
                  try {
                    const keys = await loadLocalesFile(
                      config.loadPath,
                      "en",
                      namespace,
                    )
                    if (keys[params.key]) {
                      targetNamespaces.push(namespace)
                    }
                  } catch (error) {
                    // Namespace file doesn't exist, continue
                  }
                }

                if (targetNamespaces.length === 0) {
                  throw new Error(
                    `Key "${params.key}" does not exist in any namespace. Use add_translation_key to create it.`,
                  )
                }
              }

              // Build translation cache with new value
              const inputLanguage = params.language || "en"
              const translationCache: Record<string, string> = {
                [inputLanguage]: params.value,
              }

              // Translate to all other locales
              const otherLocales = config.locales.filter(
                (l) => l !== inputLanguage,
              )
              if (otherLocales.length > 0 && config.openai) {
                const { translateKey } = await import("./lib/utils.js")

                await Promise.all(
                  otherLocales.map(async (locale) => {
                    const translation = await translateKey({
                      context: config.context || "",
                      inputLanguage: inputLanguage,
                      outputLanguage: locale,
                      object: {
                        [params.key]: params.value,
                      },
                      openai: config.openai!,
                      model: config.model,
                    })
                    translationCache[locale] = translation[params.key]
                  }),
                )
              }

              // Update the key in all relevant namespaces and locales
              // Process sequentially to avoid race conditions
              const { writeLocalesFile } = await import("./lib/utils.js")

              for (const namespace of targetNamespaces) {
                for (const locale of config.locales) {
                  const newValue = translationCache[locale] || params.value

                  // Load existing keys
                  const existingKeys = await loadLocalesFile(
                    config.loadPath,
                    locale,
                    namespace,
                  )

                  const originalKeyCount = Object.keys(existingKeys).length

                  // Update the specific key
                  existingKeys[params.key] = newValue

                  const newKeyCount = Object.keys(existingKeys).length

                  // Safety check: we should only be updating, not removing
                  // Key count should stay same (update) or increase by 1 (add)
                  if (newKeyCount < originalKeyCount) {
                    throw new Error(
                      `Safety check failed: Updating ${locale}:${namespace} would reduce keys from ${originalKeyCount} to ${newKeyCount}. Aborting.`,
                    )
                  }

                  await writeLocalesFile(
                    config.savePath,
                    locale,
                    namespace,
                    existingKeys,
                  )
                }
              }

              return { targetNamespaces }
            })

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Successfully updated translation key "${params.key}" in ${result.targetNamespaces.length} namespace(s) and ${config.locales.length} locale(s)`,
                      key: params.key,
                      newValue: params.value,
                      providedLanguage: params.language || "en",
                      namespaces: result.targetNamespaces,
                      locales: config.locales,
                      diagnostics: logMessages.join("\n"),
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          let errorDetails = errorMessage
          if (error instanceof Error && error.stack) {
            errorDetails = `${errorDetails}\nStack: ${error.stack}`
          }

          console.error(`[i18n-magic MCP] Error updating translation key:`)
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      if (request.params.name === "search_translations") {
        try {
          // Validate parameters
          const params = SearchTranslationsSchema.parse(
            request.params.arguments,
          )

          // Ensure config is loaded
          const config = await this.ensureConfig()

          // Suppress console.log
          const originalConsoleLog = console.log
          console.log = () => {}

          try {
            const searchQuery = params.query.toLowerCase()
            const results: Array<{
              key: string
              value: string
              namespace: string
              matchType: "key" | "value" | "both"
            }> = []

            // Search through all namespaces
            for (const namespace of config.namespaces) {
              try {
                const keys = await loadLocalesFile(
                  config.loadPath,
                  "en",
                  namespace,
                )

                for (const [key, value] of Object.entries(keys)) {
                  const keyLower = key.toLowerCase()
                  const valueLower = value.toLowerCase()

                  // Fuzzy matching: check if search query is contained in key or value
                  const keyMatch = keyLower.includes(searchQuery)
                  const valueMatch = valueLower.includes(searchQuery)

                  if (keyMatch || valueMatch) {
                    results.push({
                      key,
                      value,
                      namespace,
                      matchType:
                        keyMatch && valueMatch
                          ? "both"
                          : keyMatch
                            ? "key"
                            : "value",
                    })
                  }
                }
              } catch (error) {
                // Namespace file doesn't exist or has issues, continue
              }
            }

            // Sort results: exact matches first, then by match type, then alphabetically
            results.sort((a, b) => {
              // Prioritize exact key matches
              const aExactKey = a.key.toLowerCase() === searchQuery
              const bExactKey = b.key.toLowerCase() === searchQuery
              if (aExactKey && !bExactKey) return -1
              if (!aExactKey && bExactKey) return 1

              // Prioritize exact value matches
              const aExactValue = a.value.toLowerCase() === searchQuery
              const bExactValue = b.value.toLowerCase() === searchQuery
              if (aExactValue && !bExactValue) return -1
              if (!aExactValue && bExactValue) return 1

              // Then by match type (both > key > value)
              const matchOrder = { both: 0, key: 1, value: 2 }
              const matchCompare =
                matchOrder[a.matchType] - matchOrder[b.matchType]
              if (matchCompare !== 0) return matchCompare

              // Finally alphabetically by key
              return a.key.localeCompare(b.key)
            })

            // Limit results to prevent overwhelming output
            const maxResults = 50
            const limitedResults = results.slice(0, maxResults)
            const hasMore = results.length > maxResults

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message:
                        results.length === 0
                          ? `No translations found matching "${params.query}"`
                          : `Found ${results.length} translation${results.length === 1 ? "" : "s"} matching "${params.query}"${hasMore ? ` (showing first ${maxResults})` : ""}`,
                      query: params.query,
                      totalResults: results.length,
                      results: limitedResults,
                      hasMore,
                      tip: "Each result shows the translation key, English value, namespace, and what matched (key, value, or both). Use these keys directly in your code or use get_translation_key for more details.",
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          } finally {
            // Restore console.log
            console.log = originalConsoleLog
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred"

          let errorDetails = errorMessage
          if (error instanceof Error && error.stack) {
            errorDetails = `${errorDetails}\nStack: ${error.stack}`
          }

          console.error(`[i18n-magic MCP] Error searching translations:`)
          console.error(errorDetails)

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`)
    })
  }

  async run() {
    // Resolve and change to the project root directory
    const projectRoot = resolveProjectRoot()

    // Change to the project directory to ensure config and files are found
    try {
      process.chdir(projectRoot)
      console.error(
        `[i18n-magic MCP] Changed working directory to: ${process.cwd()}`,
      )
    } catch (error) {
      console.error(
        `[i18n-magic MCP] Failed to change to project root: ${error}`,
      )
      throw new Error(`Cannot access project directory: ${projectRoot}`)
    }

    // Load config immediately at startup
    await this.ensureConfig()

    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error(
      "[i18n-magic MCP] Server started and ready to accept connections",
    )
  }
}

// Start the server
const server = new I18nMagicServer()
server.run().catch((error) => {
  console.error("[i18n-magic MCP] Fatal error:", error)
  process.exit(1)
})
