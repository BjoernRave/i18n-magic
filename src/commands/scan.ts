import type { Configuration } from "../lib/types.js"
import {
  getKeysWithNamespaces,
  getPureKey,
  getTextInput,
  loadLocalesFile,
  translateKey,
  writeLocalesFile,
} from "../lib/utils.js"
import { findUnusedKeys, removeUnusedKeys } from "./clean.js"

const fileKey = (locale: string, namespace: string) =>
  JSON.stringify([locale, namespace])

export const translateMissing = async (config: Configuration) => {
  const {
    loadPath,
    savePath,
    defaultLocale,
    defaultNamespace,
    namespaces,
    locales,
    context,
    openai,
    disableTranslationDuringScan,
    autoClear,
  } = config
  const activeLocales = disableTranslationDuringScan
    ? [defaultLocale]
    : locales
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns: config.globPatterns,
    defaultNamespace,
  })
  const expectedByNamespace = Object.fromEntries(
    namespaces.map((namespace) => [namespace, new Set<string>()]),
  ) as Record<string, Set<string>>

  for (const { key, namespaces: keyNamespaces } of keysWithNamespaces) {
    for (const namespace of keyNamespaces) {
      if (!expectedByNamespace[namespace]) continue
      const pureKey = getPureKey(
        key,
        namespace,
        namespace === defaultNamespace,
      )
      const expectedKey = pureKey || (!key.includes(":") ? key : null)
      if (expectedKey !== null) expectedByNamespace[namespace].add(expectedKey)
    }
  }

  const stagedFiles = new Map<string, Record<string, string>>()
  await Promise.all(
    activeLocales.flatMap((locale) =>
      namespaces.map(async (namespace) => {
        const translations = await loadLocalesFile(
          loadPath,
          locale,
          namespace,
          { silent: true },
        )
        stagedFiles.set(fileKey(locale, namespace), { ...translations })
      }),
    ),
  )

  const changedFiles = new Set<string>()
  const missingDefaultKeys = new Map<string, Set<string>>()
  for (const namespace of namespaces) {
    const translations = stagedFiles.get(fileKey(defaultLocale, namespace))!
    for (const key of expectedByNamespace[namespace]) {
      if (!Object.hasOwn(translations, key)) {
        missingDefaultKeys.get(key)?.add(namespace) ??
          missingDefaultKeys.set(key, new Set([namespace]))
      }
    }
  }

  if (missingDefaultKeys.size > 0) {
    console.log(
      `${missingDefaultKeys.size} keys are missing. Please provide the values for the following keys in ${defaultLocale}:`,
    )
  }

  for (const [key, keyNamespaces] of missingDefaultKeys) {
    let value: string | undefined
    for (const namespace of namespaces) {
      const translations = stagedFiles.get(fileKey(defaultLocale, namespace))!
      if (Object.hasOwn(translations, key)) {
        value = translations[key]
        break
      }
    }

    value ??= await getTextInput(key, Array.from(keyNamespaces))
    for (const namespace of keyNamespaces) {
      stagedFiles.get(fileKey(defaultLocale, namespace))![key] = value
      changedFiles.add(fileKey(defaultLocale, namespace))
    }
  }

  await Promise.all(
    activeLocales
      .filter((locale) => locale !== defaultLocale)
      .map(async (locale) => {
        const missingByKey = new Map<string, Set<string>>()
        for (const namespace of namespaces) {
          const translations = stagedFiles.get(fileKey(locale, namespace))!
          for (const key of expectedByNamespace[namespace]) {
            if (!Object.hasOwn(translations, key)) {
              missingByKey.get(key)?.add(namespace) ??
                missingByKey.set(key, new Set([namespace]))
            }
          }
        }

        const reused: Record<string, string> = {}
        const keysToTranslate: Record<string, string> = {}
        for (const key of missingByKey.keys()) {
          let existingValue: string | undefined
          for (const namespace of namespaces) {
            const translations = stagedFiles.get(fileKey(locale, namespace))!
            if (Object.hasOwn(translations, key)) {
              existingValue = translations[key]
              break
            }
          }

          if (existingValue !== undefined) {
            reused[key] = existingValue
            continue
          }

          const sourceNamespace = Array.from(missingByKey.get(key)!)[0]
          const sourceTranslations = stagedFiles.get(
            fileKey(defaultLocale, sourceNamespace),
          )!
          keysToTranslate[key] = sourceTranslations[key]
        }

        const translated = await translateKey({
          inputLanguage: defaultLocale,
          outputLanguage: locale,
          context,
          object: keysToTranslate,
          openai,
          model: config.model,
        })
        const resolvedValues = { ...reused, ...translated }

        for (const [key, keyNamespaces] of missingByKey) {
          for (const namespace of keyNamespaces) {
            stagedFiles.get(fileKey(locale, namespace))![key] =
              resolvedValues[key]
            changedFiles.add(fileKey(locale, namespace))
          }
        }
      }),
  )

  for (const locale of activeLocales) {
    for (const namespace of namespaces) {
      const key = fileKey(locale, namespace)
      if (!changedFiles.has(key)) continue
      await writeLocalesFile(savePath, locale, namespace, stagedFiles.get(key)!)
      console.log(`   📝 Updated ${locale}/${namespace}.json`)
    }
  }

  if (autoClear) {
    console.log("🧹 Checking for unused translations after scanning...")
    const report = await findUnusedKeys(config)
    if (report.unusedCount > 0) await removeUnusedKeys(config)
  }

  if (changedFiles.size === 0) {
    console.log("No missing translations found.")
  } else {
    console.log(`Successfully updated ${changedFiles.size} locale file(s).`)
  }
}
