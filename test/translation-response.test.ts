import assert from "node:assert/strict"
import test from "node:test"
import { TranslationResponseError } from "../src/lib/translation-response.js"
import { translateKey } from "../src/lib/utils.js"
import { createQueuedProvider } from "./helpers.js"

const translate = async (responses: Array<string | null | Error>) => {
  const fake = createQueuedProvider(responses)
  const result = await translateKey({
    inputLanguage: "en",
    outputLanguage: "de",
    context: "",
    object: { greeting: "Hello" },
    openai: fake.provider,
    model: "gpt-4o-mini",
  })
  return { ...fake, result }
}

test("an exact response passes on the first attempt and preserves empty strings", async () => {
  const fake = createQueuedProvider(['{"greeting":""}'])
  const result = await translateKey({
    inputLanguage: "en",
    outputLanguage: "de",
    context: "",
    object: { greeting: "Hello" },
    openai: fake.provider,
    model: "gpt-4o-mini",
  })
  assert.deepEqual(result, { greeting: "" })
  assert.equal(fake.calls.length, 1)
})

for (const [name, invalid] of [
  ["missing keys", "{}"],
  ["extra keys", '{"greeting":"Hallo","extra":"x"}'],
  ["non-string values", '{"greeting":42}'],
  ["malformed JSON", "{"],
  ["null", null],
] as const) {
  test(`${name} trigger one corrective retry`, async () => {
    const { calls, result } = await translate([
      invalid,
      '{"greeting":"Hallo"}',
    ])
    assert.deepEqual(result, { greeting: "Hallo" })
    assert.equal(calls.length, 2)
    assert.match(JSON.stringify(calls[1].messages), /greeting/)
  })
}

test("two invalid responses throw without exposing the raw payload", async () => {
  const rawPayload = '{"secret-provider-output":"do not expose"}'
  const fake = createQueuedProvider([rawPayload, rawPayload])

  await assert.rejects(
    translateKey({
      inputLanguage: "en",
      outputLanguage: "de",
      context: "",
      object: { greeting: "Hello" },
      openai: fake.provider,
      model: "gpt-4o-mini",
    }),
    (error: unknown) => {
      assert.ok(error instanceof TranslationResponseError)
      assert.doesNotMatch(error.message, /do not expose/)
      return true
    },
  )
  assert.equal(fake.calls.length, 2)
})
