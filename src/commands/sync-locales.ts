import type { Configuration } from "../lib/types"
import {
  TranslationError,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils"

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

  try {
    for (const namespace of namespaces) {
      let defaultLocaleKeys: Record<string, string>

      try {
        defaultLocaleKeys = await loadLocalesFile(
          loadPath,
          defaultLocale,
          namespace,
        )
      } catch (error) {
        throw new TranslationError(
          `Failed to load default locale file for namespace "${namespace}"`,
          defaultLocale,
          namespace,
          error instanceof Error ? error : undefined,
        )
      }

      for (const locale of locales) {
        if (locale === defaultLocale) continue

        let localeKeys: Record<string, string>
        try {
          localeKeys = await loadLocalesFile(loadPath, locale, namespace)
        } catch (error) {
          console.warn(
            `Warning: Could not load locale file for ${locale} (namespace: ${namespace}). Creating new file.`,
          )
          localeKeys = {}
        }

        const missingKeys: Record<string, string> = {}

        // Check which keys from default locale are missing in current locale
        for (const [key, value] of Object.entries(defaultLocaleKeys)) {
          if (!localeKeys[key]) {
            missingKeys[key] = value
          }
        }

        // If there are missing keys, translate them
        if (Object.keys(missingKeys).length > 0) {
          console.log(
            `Found ${Object.keys(missingKeys).length} missing keys in ${locale} (namespace: ${namespace})`,
          )

          let translatedValues: Record<string, string>
          try {
            translatedValues = await translateKey({
              inputLanguage: defaultLocale,
              outputLanguage: locale,
              context,
              object: missingKeys,
              openai,
              model: config.model,
            })
          } catch (error) {
            throw new TranslationError(
              `Failed to translate keys for locale "${locale}" (namespace: ${namespace})`,
              locale,
              namespace,
              error instanceof Error ? error : undefined,
            )
          }

          // Merge translated values with existing ones
          const updatedLocaleKeys = {
            ...localeKeys,
            ...translatedValues,
          }

          try {
            await writeLocalesFile(
              savePath,
              locale,
              namespace,
              updatedLocaleKeys,
            )
          } catch (error) {
            throw new TranslationError(
              `Failed to save translations for locale "${locale}" (namespace: ${namespace})`,
              locale,
              namespace,
              error instanceof Error ? error : undefined,
            )
          }

          console.log(
            `Successfully translated and saved ${Object.keys(missingKeys).length} keys for ${locale} (namespace: ${namespace})`,
          )
        } else {
          console.log(
            `No missing keys found for ${locale} (namespace: ${namespace})`,
          )
        }
      }
    }
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
