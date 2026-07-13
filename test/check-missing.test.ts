import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  checkMissing,
  collectMissingTranslations,
  MissingTranslationsError,
} from "../src/commands/check-missing.js"
import { createConfig, createMemoryStorage } from "./helpers.js"

const createSource = (contents: string) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-missing-"))
  const sourcePath = path.join(directory, "source.ts")
  fs.writeFileSync(sourcePath, contents)
  return { directory, sourcePath }
}

test("complete locales pass and empty strings count as present", async () => {
  const { sourcePath } = createSource('t("welcome"); t("empty")')
  const storage = createMemoryStorage({
    "en/common": { welcome: "Welcome", empty: "" },
    "de/common": { welcome: "Willkommen", empty: "" },
  })
  const config = createConfig({
    storage,
    locales: ["en", "de"],
    globPatterns: [sourcePath],
  })
  config.openai = {
    chat: { completions: { create: async () => assert.fail("provider called") } },
  } as never

  const report = await checkMissing(config)
  assert.equal(report.totalMissing, 0)
  assert.deepEqual(report.missing, {})
  assert.deepEqual(storage.saves, [])
})

test("missing translations are grouped by locale and namespace", async () => {
  const { sourcePath } = createSource('t("welcome"); t("empty")')
  const storage = createMemoryStorage({
    "en/common": { empty: "" },
    "de/common": { welcome: "Willkommen" },
  })
  const config = createConfig({
    storage,
    locales: ["en", "de"],
    globPatterns: [sourcePath],
  })

  const report = await collectMissingTranslations(config)
  assert.deepEqual(report.missing, {
    en: { common: ["welcome"] },
    de: { common: ["empty"] },
  })
  await assert.rejects(
    checkMissing(config),
    (error: unknown) =>
      error instanceof MissingTranslationsError &&
      error.report.totalMissing === 2,
  )
  assert.deepEqual(storage.saves, [])
})

test("custom storage and invalid JSON errors propagate", async () => {
  const { directory, sourcePath } = createSource('t("welcome")')
  const failingStorage = createMemoryStorage({})
  const failingConfig = createConfig({
    storage: failingStorage,
    locales: ["en"],
    globPatterns: [sourcePath],
  })
  failingConfig.loadPath = async () => {
    throw new Error("storage unavailable")
  }
  await assert.rejects(
    collectMissingTranslations(failingConfig),
    /storage unavailable/,
  )

  const localeDirectory = path.join(directory, "locales", "en")
  fs.mkdirSync(localeDirectory, { recursive: true })
  fs.writeFileSync(path.join(localeDirectory, "common.json"), "{")
  const invalidJsonConfig = createConfig({
    storage: createMemoryStorage({}),
    locales: ["en"],
    globPatterns: [sourcePath],
  })
  invalidJsonConfig.loadPath = path.join(
    directory,
    "locales",
    "{{lng}}",
    "{{ns}}.json",
  )
  await assert.rejects(collectMissingTranslations(invalidJsonConfig), /Invalid JSON/)
})

const runCliFixture = (complete: boolean) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-cli-"))
  fs.writeFileSync(path.join(directory, "source.ts"), 't("welcome")')
  for (const locale of ["en", "de"]) {
    const localeDirectory = path.join(directory, "locales", locale)
    fs.mkdirSync(localeDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(localeDirectory, "common.json"),
      JSON.stringify(locale === "de" && !complete ? {} : { welcome: locale }),
    )
  }
  fs.writeFileSync(
    path.join(directory, "i18n-magic.mjs"),
    `export default {
      globPatterns: ["./source.ts"],
      loadPath: "./locales/{{lng}}/{{ns}}.json",
      savePath: "./locales/{{lng}}/{{ns}}.json",
      defaultLocale: "en",
      defaultNamespace: "common",
      namespaces: ["common"],
      locales: ["en", "de"]
    }`,
  )
  const before = new Map(
    ["en", "de"].map((locale) => [
      locale,
      fs.readFileSync(path.join(directory, "locales", locale, "common.json")),
    ]),
  )
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules/tsx/dist/cli.mjs"),
      path.resolve("src/cli.ts"),
      "-c",
      "i18n-magic.mjs",
      "check-missing",
    ],
    { cwd: directory, encoding: "utf8" },
  )

  for (const locale of ["en", "de"]) {
    assert.deepEqual(
      fs.readFileSync(path.join(directory, "locales", locale, "common.json")),
      before.get(locale),
    )
  }
  return result
}

test("CLI check-missing exits zero or one without changing locale files", () => {
  const complete = runCliFixture(true)
  assert.equal(complete.status, 0, complete.stderr)

  const incomplete = runCliFixture(false)
  assert.equal(incomplete.status, 1)
  assert.doesNotMatch(incomplete.stderr, /MissingTranslationsError|\n\s+at /)
})
