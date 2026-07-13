import type { Configuration } from "../lib/types.js"
import {
  getKeysWithNamespaces,
  getPureKey,
  loadLocalesFile,
} from "../lib/utils.js"

export interface MissingTranslationsReport {
  missing: Record<string, Record<string, string[]>>
  totalExpected: number
  totalMissing: number
}

export class MissingTranslationsError extends Error {
  constructor(public report: MissingTranslationsReport) {
    super(`Found ${report.totalMissing} missing translation(s).`)
    this.name = "MissingTranslationsError"
  }
}

export const collectMissingTranslations = async (
  config: Configuration,
): Promise<MissingTranslationsReport> => {
  const keysWithNamespaces = await getKeysWithNamespaces({
    globPatterns: config.globPatterns,
    defaultNamespace: config.defaultNamespace,
  })
  const expectedByNamespace = Object.fromEntries(
    config.namespaces.map((namespace) => [namespace, new Set<string>()]),
  ) as Record<string, Set<string>>

  for (const { key, namespaces } of keysWithNamespaces) {
    for (const namespace of namespaces) {
      if (!expectedByNamespace[namespace]) continue

      const pureKey = getPureKey(
        key,
        namespace,
        namespace === config.defaultNamespace,
      )
      const expectedKey = pureKey || (!key.includes(":") ? key : null)
      if (expectedKey !== null) expectedByNamespace[namespace].add(expectedKey)
    }
  }

  const loadedFiles = await Promise.all(
    config.locales.flatMap((locale) =>
      config.namespaces.map(async (namespace) => ({
        locale,
        namespace,
        translations: await loadLocalesFile(
          config.loadPath,
          locale,
          namespace,
          { silent: true },
        ),
      })),
    ),
  )

  const missing: Record<string, Record<string, string[]>> = {}
  let totalMissing = 0

  for (const { locale, namespace, translations } of loadedFiles) {
    const missingKeys = Array.from(expectedByNamespace[namespace]).filter(
      (key) => !Object.hasOwn(translations, key),
    )
    if (missingKeys.length === 0) continue

    missing[locale] ??= {}
    missing[locale][namespace] = missingKeys.sort()
    totalMissing += missingKeys.length
  }

  return {
    missing,
    totalExpected: Object.values(expectedByNamespace).reduce(
      (total, keys) => total + keys.size,
      0,
    ),
    totalMissing,
  }
}

const printMissingTranslationsReport = (report: MissingTranslationsReport) => {
  if (report.totalMissing === 0) {
    console.log("✅ No missing translations found.")
    return
  }

  console.error(`❌ Found ${report.totalMissing} missing translation(s):`)
  for (const [locale, namespaces] of Object.entries(report.missing)) {
    for (const [namespace, keys] of Object.entries(namespaces)) {
      console.error(`   ${locale}/${namespace}: ${keys.join(", ")}`)
    }
  }
}

export const checkMissing = async (config: Configuration) => {
  const report = await collectMissingTranslations(config)
  printMissingTranslationsReport(report)

  if (report.totalMissing > 0) {
    throw new MissingTranslationsError(report)
  }

  return report
}
