import type OpenAI from "openai"
import type { Configuration } from "../src/lib/types.js"

export const createQueuedProvider = (
  responses: Array<string | null | Error>,
) => {
  const calls: Array<{ messages: unknown }> = []
  const queue = [...responses]
  const provider = {
    chat: {
      completions: {
        create: async ({ messages }: { messages: unknown }) => {
          calls.push({ messages })
          const response = queue.shift()
          if (response instanceof Error) throw response
          if (response === undefined) {
            throw new Error("Fake provider response queue exhausted")
          }
          return {
            choices: [{ message: { content: response } }],
          }
        },
      },
    },
  } as unknown as OpenAI

  return { calls, provider }
}

export const createMemoryStorage = (
  initial: Record<string, Record<string, string>>,
) => {
  const data = new Map(
    Object.entries(initial).map(([key, value]) => [key, { ...value }]),
  )
  const loads: string[] = []
  const saves: Array<{
    locale: string
    namespace: string
    data: Record<string, string>
  }> = []

  return {
    data,
    loads,
    saves,
    loadPath: async (locale: string, namespace: string) => {
      const key = `${locale}/${namespace}`
      loads.push(key)
      return { ...(data.get(key) || {}) }
    },
    savePath: async (
      locale: string,
      namespace: string,
      translations: Record<string, string>,
    ) => {
      const snapshot = { ...translations }
      data.set(`${locale}/${namespace}`, snapshot)
      saves.push({ locale, namespace, data: snapshot })
    },
  }
}

export const createConfig = ({
  storage,
  openai,
  globPatterns = [],
  locales = ["en", "de", "fr"],
  defaultLocale = "en",
}: {
  storage: ReturnType<typeof createMemoryStorage>
  openai?: OpenAI
  globPatterns?: Configuration["globPatterns"]
  locales?: string[]
  defaultLocale?: string
}): Configuration => ({
  loadPath: storage.loadPath,
  savePath: storage.savePath,
  defaultLocale,
  defaultNamespace: "common",
  namespaces: ["common"],
  locales,
  globPatterns,
  context: "Test application",
  model: "gpt-4o-mini",
  openai,
})
