export class TranslationResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TranslationResponseError"
  }
}

export class TranslationProviderUnavailableError extends Error {
  constructor() {
    super(
      "A translation provider is required for this operation, but no provider credentials are configured.",
    )
    this.name = "TranslationProviderUnavailableError"
  }
}

export const parseTranslationResponse = (
  content: string | null,
  requestedKeys: string[],
): Record<string, string> => {
  let parsed: unknown

  try {
    parsed = content === null ? null : JSON.parse(content)
  } catch {
    throw new TranslationResponseError(
      "Translation provider returned malformed JSON.",
    )
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TranslationResponseError(
      "Translation provider returned a value that is not a JSON object.",
    )
  }

  const response = parsed as Record<string, unknown>
  const requested = new Set(requestedKeys)
  const responseKeys = Object.keys(response)
  const missingKeys = requestedKeys.filter((key) => !Object.hasOwn(response, key))
  const extraKeys = responseKeys.filter((key) => !requested.has(key))
  const invalidValueKeys = responseKeys.filter(
    (key) => typeof response[key] !== "string",
  )

  if (missingKeys.length > 0 || extraKeys.length > 0 || invalidValueKeys.length > 0) {
    const problems: string[] = []
    if (missingKeys.length > 0) problems.push(`missing keys: ${missingKeys.join(", ")}`)
    if (extraKeys.length > 0) problems.push(`extra keys: ${extraKeys.join(", ")}`)
    if (invalidValueKeys.length > 0) {
      problems.push(`non-string values: ${invalidValueKeys.join(", ")}`)
    }
    throw new TranslationResponseError(
      `Translation provider returned an invalid key/value shape (${problems.join("; ")}).`,
    )
  }

  return response as Record<string, string>
}
