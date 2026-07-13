import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { replaceTranslationValue } from "../src/commands/replace.js"
import { translateMissing } from "../src/commands/scan.js"
import { syncLocales } from "../src/commands/sync-locales.js"
import { updateTranslationKeyOperation } from "../src/lib/update-translation-key.js"
import { addTranslationKey } from "../src/lib/utils.js"
import {
  createConfig,
  createMemoryStorage,
  createQueuedProvider,
} from "./helpers.js"

const initialTranslations = () => ({
  "en/common": { greeting: "Hello", preserved: "Source" },
  "de/common": { preserved: "Ziel" },
  "fr/common": { preserved: "Cible" },
})

const sourceGlob = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-stage-"))
  const sourcePath = path.join(directory, "source.ts")
  fs.writeFileSync(sourcePath, 't("greeting")')
  return [sourcePath]
}

const invalidResponses = () => [
  '{"greeting":"Hallo"}',
  '{"unexpected":"invalid"}',
  '{"stillUnexpected":"invalid"}',
]

const validResponses = (key = "greeting") => [
  JSON.stringify({ [key]: "Hallo" }),
  JSON.stringify({ [key]: "Bonjour" }),
]

const makeScenario = (
  responses: Array<string | null | Error>,
  globPatterns: string[] = [],
) => {
  const storage = createMemoryStorage(initialTranslations())
  const fake = createQueuedProvider(responses)
  const config = createConfig({
    storage,
    openai: fake.provider,
    globPatterns,
  })
  return { config, fake, storage }
}

const lateFailureCases: Array<{
  name: string
  run: () => Promise<ReturnType<typeof createMemoryStorage>>
}> = [
  {
    name: "add",
    run: async () => {
      const scenario = makeScenario(invalidResponses())
      await assert.rejects(
        addTranslationKey({
          config: scenario.config,
          key: "greeting",
          value: "Hello again",
          language: "en",
        }),
      )
      return scenario.storage
    },
  },
  {
    name: "update",
    run: async () => {
      const scenario = makeScenario(invalidResponses())
      await assert.rejects(
        updateTranslationKeyOperation({
          config: scenario.config,
          key: "greeting",
          value: "Hello again",
          language: "en",
        }),
      )
      return scenario.storage
    },
  },
  {
    name: "replace",
    run: async () => {
      const scenario = makeScenario(invalidResponses())
      await assert.rejects(
        replaceTranslationValue({
          config: scenario.config,
          key: "greeting",
          value: "Hello again",
          targetNamespaces: ["common"],
        }),
      )
      return scenario.storage
    },
  },
  {
    name: "scan",
    run: async () => {
      const scenario = makeScenario(invalidResponses(), sourceGlob())
      await assert.rejects(translateMissing(scenario.config))
      return scenario.storage
    },
  },
  {
    name: "sync",
    run: async () => {
      const scenario = makeScenario(invalidResponses())
      await assert.rejects(syncLocales(scenario.config))
      return scenario.storage
    },
  },
]

for (const failureCase of lateFailureCases) {
  test(`${failureCase.name} performs no saves after a late invalid provider response`, async () => {
    const storage = await failureCase.run()
    assert.deepEqual(storage.saves, [])
    assert.deepEqual(
      Object.fromEntries(storage.data),
      initialTranslations(),
    )
  })
}

const successfulCases: Array<{
  name: string
  expectedLocales: string[]
  run: () => Promise<ReturnType<typeof createMemoryStorage>>
}> = [
  {
    name: "add",
    expectedLocales: ["en", "de", "fr"],
    run: async () => {
      const scenario = makeScenario(validResponses("newKey"))
      await addTranslationKey({
        config: scenario.config,
        key: "newKey",
        value: "New value",
        language: "en",
      })
      return scenario.storage
    },
  },
  {
    name: "update",
    expectedLocales: ["en", "de", "fr"],
    run: async () => {
      const scenario = makeScenario(validResponses())
      await updateTranslationKeyOperation({
        config: scenario.config,
        key: "greeting",
        value: "Hello again",
      })
      return scenario.storage
    },
  },
  {
    name: "replace",
    expectedLocales: ["en", "de", "fr"],
    run: async () => {
      const scenario = makeScenario(validResponses())
      await replaceTranslationValue({
        config: scenario.config,
        key: "greeting",
        value: "Hello again",
        targetNamespaces: ["common"],
      })
      return scenario.storage
    },
  },
  {
    name: "scan",
    expectedLocales: ["de", "fr"],
    run: async () => {
      const scenario = makeScenario(validResponses(), sourceGlob())
      await translateMissing(scenario.config)
      return scenario.storage
    },
  },
  {
    name: "sync",
    expectedLocales: ["de", "fr"],
    run: async () => {
      const scenario = makeScenario(validResponses())
      await syncLocales(scenario.config)
      return scenario.storage
    },
  },
]

for (const successCase of successfulCases) {
  test(`${successCase.name} commits every successful locale snapshot`, async () => {
    const storage = await successCase.run()
    assert.deepEqual(
      storage.saves.map(({ locale }) => locale).sort(),
      [...successCase.expectedLocales].sort(),
    )
    for (const locale of successCase.expectedLocales) {
      const translations = storage.data.get(`${locale}/common`)
      assert.ok(translations)
      assert.equal(
        translations.preserved,
        initialTranslations()[`${locale}/common`].preserved,
      )
    }
  })
}
