import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import {
  LocaleConfigurationError,
  resolveConfiguredLocale,
  resolveLocaleTemplatePath,
} from "../src/lib/locale-storage.js"
import {
  addTranslationKey,
  addTranslationKeys,
  loadLocalesFile,
} from "../src/lib/utils.js"
import { createConfig, createMemoryStorage } from "./helpers.js"

test("omitted add locale uses defaultLocale and preserves existing keys", async () => {
  const storage = createMemoryStorage({
    "de/common": { existing: "Bestehend" },
    "en/common": { existing: "Existing" },
  })
  const config = createConfig({
    storage,
    locales: ["de", "en"],
    defaultLocale: "de",
  })

  const result = await addTranslationKey({
    key: "welcome",
    value: "Willkommen",
    config,
  })

  assert.equal(result.providedLanguage, "de")
  assert.deepEqual(storage.saves, [
    {
      locale: "de",
      namespace: "common",
      data: { existing: "Bestehend", welcome: "Willkommen" },
    },
  ])
})

test("batch locales are all validated before scanning or storage access", async () => {
  const storage = createMemoryStorage({})
  const config = createConfig({ storage })

  await assert.rejects(
    addTranslationKeys({
      config,
      keys: [
        { key: "valid", value: "Valid", language: "en" },
        { key: "invalid", value: "Invalid", language: "../de" },
      ],
    }),
    LocaleConfigurationError,
  )
  assert.deepEqual(storage.loads, [])
  assert.deepEqual(storage.saves, [])
})

test("configured locale resolution requires an exact configured member", () => {
  const config = { defaultLocale: "de", locales: ["de", "en"] }
  assert.equal(resolveConfiguredLocale(config), "de")
  assert.equal(resolveConfiguredLocale(config, "en"), "en")
  assert.throws(
    () => resolveConfiguredLocale(config, "EN"),
    LocaleConfigurationError,
  )
})

test("placeholder expansion cannot escape the configured template base", async () => {
  const template = path.join(
    process.cwd(),
    "fixtures",
    "locales",
    "{{lng}}",
    "{{ns}}.json",
  )
  const safePath = resolveLocaleTemplatePath(template, "de", "common")
  assert.equal(
    safePath,
    path.join(process.cwd(), "fixtures", "locales", "de", "common.json"),
  )
  assert.throws(
    () => resolveLocaleTemplatePath(template, "../outside", "common"),
    LocaleConfigurationError,
  )
  await assert.rejects(
    loadLocalesFile(template, "de", "../../outside"),
    LocaleConfigurationError,
  )
})
