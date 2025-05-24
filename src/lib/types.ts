import type OpenAI from "openai"
import type { ChatModel } from "openai/resources/chat/chat"

type Model =
  | ChatModel
  | "gemini-2.5-pro-exp-03-25"
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-lite"

export interface NamespacePruneConfig {
  sourceNamespace: string
  newNamespace: string
  globPatterns: string[]
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface Configuration {
  loadPath:
    | string
    | ((locale: string, namespace: string) => Promise<Record<string, string>>)
  savePath:
    | string
    | ((
        locale: string,
        namespace: string,
        data: Record<string, string>,
      ) => Promise<void>)
  defaultLocale: string
  defaultNamespace: string
  namespaces: string[]
  locales: string[]
  globPatterns: string[]
  context?: string
  disableTranslation?: boolean
  autoClear?: boolean
  OPENAI_API_KEY?: string
  GEMINI_API_KEY?: string
  model?: Model
  openai?: OpenAI
  pruneNamespaces?: NamespacePruneConfig[]
}

export interface CommandType {
  name: string
  description: string
  action: (config: Configuration, ...args: any[]) => Promise<void>
}
