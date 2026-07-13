import assert from "node:assert/strict"
import test from "node:test"
import * as packageExports from "../src/index.js"

test("public entry point exposes the programmatic translation API", () => {
  assert.equal(typeof packageExports.addTranslationKey, "function")
  assert.equal(typeof packageExports.checkMissing, "function")
  assert.equal(typeof packageExports.collectMissingTranslations, "function")
  assert.equal(typeof packageExports.MissingTranslationsError, "function")
})
