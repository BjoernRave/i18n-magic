import fs from "node:fs"
import type { Configuration } from "../lib/types.js"
import {
  TranslationError,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
  findExistingTranslations,
} from "../lib/utils.js"

export const syncLocales = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    namespaces,
    locales,
    context,
    openai,
  } = config

  console.log(`🔄 Syncing translations for locales: ${locales.join(", ")}`)
  console.log(`📦 Namespaces: ${namespaces.join(", ")}`)
  console.log(`🌐 Default locale: ${defaultLocale}`)

  try {
    // Helper to ensure a locale/namespace file exists before we add keys
    const ensureLocaleNamespaceFile = async (
      locale: string,
      namespace: string,
    ) => {
      if (typeof savePath === "string") {
        const filePath = savePath
          .replace("{{lng}}", locale)
          .replace("{{ns}}", namespace)
        if (!fs.existsSync(filePath)) {
          console.log(`📄 Creating missing namespace file: ${filePath}`)
          await writeLocalesFile(savePath, locale, namespace, {})
        }
      }
    }

    // Ensure all default-locale namespace files exist first
    await Promise.all(
      namespaces.map((namespace) =>
        ensureLocaleNamespaceFile(defaultLocale, namespace),
      ),
    )

    // Process all non-default locales in parallel
    const localesToProcess = locales.filter((l) => l !== defaultLocale)

    await Promise.all(
      localesToProcess.map(async (locale) => {
        console.log(`\n🔍 Processing locale: ${locale}`)

        // Ensure all namespace files for this locale exist before filling keys
        await Promise.all(
          namespaces.map((namespace) =>
            ensureLocaleNamespaceFile(locale, namespace),
          ),
        )

        // Collect all missing keys for this locale across all namespaces
        const allMissingKeys: Record<
          string,
          { value: string; namespaces: string[] }
        > = {}
        const namespaceKeys: Record<string, Record<string, string>> = {}

        // Load existing keys for all namespaces in parallel
        const namespaceResults = await Promise.all(
          namespaces.map(async (namespace) => {
            const defaultLocaleKeys = await loadLocalesFile(
              loadPath,
              defaultLocale,
              namespace,
            )

            const localeKeys = await loadLocalesFile(
              loadPath,
              locale,
              namespace,
            )

            return {
              namespace,
              defaultLocaleKeys,
              localeKeys,
            }
          }),
        )

        // Process results and collect missing keys
        for (const result of namespaceResults) {
          const { namespace, defaultLocaleKeys, localeKeys } = result
          namespaceKeys[namespace] = localeKeys

          // Check which keys from default locale are missing in current locale
          for (const [key, value] of Object.entries(defaultLocaleKeys)) {
            if (!localeKeys[key]) {
              if (allMissingKeys[key]) {
                // Key already exists, add this namespace to the list
                allMissingKeys[key].namespaces.push(namespace)
              } else {
                // New missing key
                allMissingKeys[key] = {
                  value,
                  namespaces: [namespace],
                }
              }
            }
          }
        }

        const missingKeysList = Object.keys(allMissingKeys)
        if (missingKeysList.length === 0) {
          console.log(`✅ No missing keys found for ${locale}`)
          return
        }

        console.log(
          `Found ${missingKeysList.length} unique missing keys in ${locale}`,
        )

        // Check for existing translations of these keys in other namespaces (parallelized)
        const keysToTranslate: Record<string, string> = {}
        const existingTranslations: Record<string, string> = {}

        const existingTranslationResults = await findExistingTranslations(
          missingKeysList,
          namespaces,
          locale,
          loadPath,
        )

        const reusedKeys: string[] = []
        for (const key of missingKeysList) {
          const existingValue = existingTranslationResults[key]

          if (existingValue) {
            existingTranslations[key] = existingValue
            reusedKeys.push(key)
          } else {
            keysToTranslate[key] = allMissingKeys[key].value
          }
        }

        // Batch log reused translations
        if (reusedKeys.length > 0) {
          console.log(
            `🔄 Reusing ${reusedKeys.length} existing translations for ${locale}`,
          )
        }

        let translatedValues: Record<string, string> = {}

        // Translate only the keys that don't have existing translations
        if (Object.keys(keysToTranslate).length > 0) {
          console.log(
            `🔤 Translating ${Object.keys(keysToTranslate).length} new keys for ${locale}`,
          )

          try {
            translatedValues = await translateKey({
              inputLanguage: defaultLocale,
              outputLanguage: locale,
              context,
              object: keysToTranslate,
              openai,
              model: config.model,
            })
          } catch (error) {
            throw new TranslationError(
              `Failed to translate keys for locale "${locale}"`,
              locale,
              undefined,
              error instanceof Error ? error : undefined,
            )
          }
        }

        // Combine existing translations with new translations
        const allTranslations = { ...existingTranslations, ...translatedValues }

        // Distribute translations to all relevant namespaces in parallel
        await Promise.all(
          namespaces.map(async (namespace) => {
            let hasChanges = false
            const updatedKeys = { ...namespaceKeys[namespace] }

            for (const key of missingKeysList) {
              if (allMissingKeys[key].namespaces.includes(namespace)) {
                const translation = allTranslations[key] || ""
                updatedKeys[key] = translation
                hasChanges = true
              }
            }

            if (hasChanges) {
              try {
                await writeLocalesFile(savePath, locale, namespace, updatedKeys)

                const addedKeysCount = Object.keys(allMissingKeys).filter(
                  (key) => allMissingKeys[key].namespaces.includes(namespace),
                ).length

                console.log(
                  `✅ Updated ${locale} (${namespace}): ${addedKeysCount} keys`,
                )
              } catch (error) {
                throw new TranslationError(
                  `Failed to save translations for locale "${locale}" (namespace: ${namespace})`,
                  locale,
                  namespace,
                  error instanceof Error ? error : undefined,
                )
              }
            }
          }),
        )
      }),
    )
  } catch (error) {
    if (error instanceof TranslationError) {
      throw error
    }
    throw new TranslationError(
      "An unexpected error occurred during translation",
      undefined,
      undefined,
      error instanceof Error ? error : undefined,
    )
  }
}
