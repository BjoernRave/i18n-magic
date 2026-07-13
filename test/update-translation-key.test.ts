import assert from "node:assert/strict"
import test from "node:test"
import { LocaleConfigurationError } from "../src/lib/locale-storage.js"
import { updateTranslationKeyOperation } from "../src/lib/update-translation-key.js"
import { createConfig, createMemoryStorage } from "./helpers.js"

test("providerless update changes only the default source locale", async () => {
  const storage = createMemoryStorage({
    "de/common": { greeting: "Hallo", untouched: "Bleibt" },
    "en/common": { greeting: "Hello", untouched: "Stays" },
    "fr/common": { greeting: "Bonjour", untouched: "Reste" },
  })
  const config = createConfig({
    storage,
    defaultLocale: "de",
    locales: ["de", "en", "fr"],
  })
  const beforeEnglish = { ...storage.data.get("en/common") }
  const beforeFrench = { ...storage.data.get("fr/common") }

  const result = await updateTranslationKeyOperation({
    config,
    key: "greeting",
    value: "Guten Tag",
  })

  assert.deepEqual(result.updatedLocales, ["de"])
  assert.deepEqual(result.pendingLocales, ["en", "fr"])
  assert.equal(result.sourceLocale, "de")
  assert.deepEqual(storage.data.get("de/common"), {
    greeting: "Guten Tag",
    untouched: "Bleibt",
  })
  assert.deepEqual(storage.data.get("en/common"), beforeEnglish)
  assert.deepEqual(storage.data.get("fr/common"), beforeFrench)
  assert.deepEqual(
    storage.saves.map(({ locale }) => locale),
    ["de"],
  )
})

test("unsupported update locale fails before any storage access", async () => {
  const storage = createMemoryStorage({})
  const config = createConfig({ storage })

  await assert.rejects(
    updateTranslationKeyOperation({
      config,
      key: "greeting",
      value: "Hello",
      language: "../../en",
    }),
    LocaleConfigurationError,
  )
  assert.deepEqual(storage.loads, [])
  assert.deepEqual(storage.saves, [])
})
