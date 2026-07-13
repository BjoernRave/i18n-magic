import type { Configuration } from "./types.js"
import { resolveConfiguredLocale } from "./locale-storage.js"
import {
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "./utils.js"

export interface UpdateTranslationKeyResult {
  key: string
  value: string
  sourceLocale: string
  targetNamespaces: string[]
  updatedLocales: string[]
  pendingLocales: string[]
}

export const updateTranslationKeyOperation = async ({
  config,
  key,
  value,
  language,
}: {
  config: Configuration
  key: string
  value: string
  language?: string
}): Promise<UpdateTranslationKeyResult> => {
  const sourceLocale = resolveConfiguredLocale(config, language)
  const sourceFiles = await Promise.all(
    config.namespaces.map(async (namespace) => ({
      namespace,
      translations: await loadLocalesFile(
        config.loadPath,
        sourceLocale,
        namespace,
        { silent: true },
      ),
    })),
  )
  const targetNamespaces = sourceFiles
    .filter(({ translations }) => Object.hasOwn(translations, key))
    .map(({ namespace }) => namespace)

  if (targetNamespaces.length === 0) {
    throw new Error(
      `Key "${key}" does not exist in the ${sourceLocale} translation files. Use add_translation_key to create it.`,
    )
  }

  const pendingLocales = config.openai
    ? []
    : config.locales.filter((locale) => locale !== sourceLocale)
  const updatedLocales = config.openai ? [...config.locales] : [sourceLocale]
  const translatedValues: Record<string, string> = {
    [sourceLocale]: value,
  }

  if (config.openai) {
    await Promise.all(
      config.locales
        .filter((locale) => locale !== sourceLocale)
        .map(async (locale) => {
          const translation = await translateKey({
            context: config.context || "",
            inputLanguage: sourceLocale,
            outputLanguage: locale,
            object: { [key]: value },
            openai: config.openai,
            model: config.model,
          })
          translatedValues[locale] = translation[key]
        }),
    )
  }

  const snapshots = new Map<string, Record<string, string>>()
  await Promise.all(
    updatedLocales.flatMap((locale) =>
      targetNamespaces.map(async (namespace) => {
        const sourceSnapshot =
          locale === sourceLocale
            ? sourceFiles.find((entry) => entry.namespace === namespace)
                ?.translations
            : undefined
        const existingKeys =
          sourceSnapshot ??
          (await loadLocalesFile(config.loadPath, locale, namespace, {
            silent: true,
          }))
        snapshots.set(
          JSON.stringify([locale, namespace]),
          { ...existingKeys, [key]: translatedValues[locale] },
        )
      }),
    ),
  )

  for (const locale of updatedLocales) {
    for (const namespace of targetNamespaces) {
      const snapshot = snapshots.get(JSON.stringify([locale, namespace]))
      if (!snapshot) {
        throw new Error(
          `Internal error: no staged snapshot for ${locale}/${namespace}.`,
        )
      }
      await writeLocalesFile(config.savePath, locale, namespace, snapshot)
    }
  }

  return {
    key,
    value,
    sourceLocale,
    targetNamespaces,
    updatedLocales,
    pendingLocales,
  }
}
