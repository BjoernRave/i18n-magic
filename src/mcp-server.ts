import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { addTranslationKey, getMissingKeys, loadConfig } from "./lib/utils.js"
import type { Configuration } from "./lib/types.js"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import OpenAI from "openai"

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
    console.error(`[i18n-magic MCP] Using project root from --project-root: ${projectRoot}`)
    return path.resolve(projectRoot)
  }

  // 2. Check for I18N_MCP_PROJECT_ROOT environment variable
  if (process.env.I18N_MCP_PROJECT_ROOT) {
    const projectRoot = process.env.I18N_MCP_PROJECT_ROOT
    console.error(`[i18n-magic MCP] Using project root from I18N_MCP_PROJECT_ROOT: ${projectRoot}`)
    return path.resolve(projectRoot)
  }

  // 3. Try to auto-detect project root from script location
  // When installed in node_modules, traverse up to find i18n-magic.js
  const autoDetected = findProjectRoot(__dirname)
  if (autoDetected) {
    console.error(`[i18n-magic MCP] Auto-detected project root: ${autoDetected}`)
    return autoDetected
  }

  // 4. Fall back to current working directory
  const cwd = process.cwd()
  console.error(`[i18n-magic MCP] Using current working directory as project root: ${cwd}`)
  return cwd
}

// Zod schema for the add_translation_key tool parameters
const AddTranslationKeySchema = z.object({
  key: z.string().describe("The translation key to add (e.g., \"welcomeMessage\")"),
  value: z.string().describe("The English text value for this translation key"),
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
              baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
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
            description:  "Add a new translation key with an English value.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    "The translation key to add (e.g., \"welcomeMessage\")",
                },
                value: {
                  type: "string",
                  description:
                    "The English text value for this translation key",
                },
              },
              required: ["key", "value"],
            },
          },
          {
            name: "list_untranslated_keys",
            description:
              "List all translation keys that are used in the codebase but are not yet defined in the locale files. This helps identify missing translations that need to be added. The tool scans the codebase for translation keys and compares them against existing locale files.",
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
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')
            logMessages.push(message)
            // Also log to stderr for debugging
            console.error(`[i18n-magic] ${message}`)
          }

          let result
          try {
            // Add the translation key
            result = await addTranslationKey({
              key: params.key,
              value: params.value,
              config,
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
                    message: `Successfully added translation key "${result.key}" to affected namespaces: ${result.namespace} (${result.locale})`,
                    key: result.key,
                    value: result.value,
                    namespace: result.namespace,
                    locale: result.locale,
                    nextStep: result.locale.includes(',')
                      ? "Run 'i18n-magic sync' to translate this key to other locales"
                      : "Key was translated to default locale. Run 'i18n-magic sync' to translate to other locales",
                    diagnostics: logMessages.join('\n'),
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
          const uniqueKeys = Array.from(new Set(filteredKeys.map(item => item.key))).sort()

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

      throw new Error(`Unknown tool: ${request.params.name}`)
    })
  }

  async run() {
    // Resolve and change to the project root directory
    const projectRoot = resolveProjectRoot()
    
    // Change to the project directory to ensure config and files are found
    try {
      process.chdir(projectRoot)
      console.error(`[i18n-magic MCP] Changed working directory to: ${process.cwd()}`)
    } catch (error) {
      console.error(`[i18n-magic MCP] Failed to change to project root: ${error}`)
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



