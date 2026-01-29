import fs from "node:fs"
import chalk from "chalk"
import cliProgress from "cli-progress"
import { languages } from "../lib/languges.js"
import type { Configuration } from "../lib/types.js"
import {
  findExistingTranslations,
  loadLocalesFile,
  TranslationError,
  translateKey,
  writeLocalesFile,
} from "../lib/utils.js"

const getLanguageLabel = (locale: string): string => {
  const lang = languages.find((l) => l.value === locale)
  return lang?.label || locale
}

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

  const localesToProcess = locales.filter((l) => l !== defaultLocale)

  const BATCH_SIZE = 5

  console.log(chalk.cyan("\n🔄 Syncing translations\n"))
  console.log(
    chalk.dim(
      `   Default locale: ${chalk.white(getLanguageLabel(defaultLocale))}`,
    ),
  )
  console.log(chalk.dim(`   Namespaces: ${chalk.white(namespaces.join(", "))}`))
  console.log(
    chalk.dim(`   Target languages: ${chalk.white(localesToProcess.length)}`),
  )
  console.log(
    chalk.dim(
      `   Concurrency: ${chalk.white(`${BATCH_SIZE} languages at a time`)}\n`,
    ),
  )

  // Track results for each locale
  const localeResults: Record<
    string,
    {
      status: "pending" | "processing" | "done" | "error"
      translated: number
      reused: number
      error?: string
    }
  > = {}

  for (const locale of localesToProcess) {
    localeResults[locale] = { status: "pending", translated: 0, reused: 0 }
  }

  // Create a single progress bar for overall progress
  const progressBar = new cliProgress.SingleBar(
    {
      format: `   {bar} {percentage}% | {current}/{total} | {lang} {status}`,
      barCompleteChar: chalk.green("█"),
      barIncompleteChar: chalk.gray("░"),
      hideCursor: true,
      clearOnComplete: false,
      barsize: 30,
    },
    cliProgress.Presets.shades_classic,
  )

  progressBar.start(localesToProcess.length, 0, {
    status: "",
    current: 0,
    lang: "",
  })

  // Suppress console.log during progress bar display
  const originalConsoleLog = console.log
  const suppressedLog = () => {}

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

    // Process locales in parallel batches
    let completedCount = 0
    const currentlyProcessing: Set<string> = new Set()

    // Helper to update progress bar with currently processing languages
    const updateProgressDisplay = () => {
      const processingArray = Array.from(currentlyProcessing)
      const langs = processingArray
        .slice(0, 3)
        .map((l) => getLanguageLabel(l).substring(0, 8))
        .join(", ")
      const status = processingArray.length > 0 ? `processing ${langs}...` : ""
      progressBar.update(completedCount, {
        status,
        current: completedCount,
        lang: "",
      })
    }

    // Process a single locale
    const processLocale = async (locale: string) => {
      const langLabel = getLanguageLabel(locale)
      const shortLang = langLabel.substring(0, 10).padEnd(10)
      localeResults[locale].status = "processing"
      currentlyProcessing.add(locale)
      updateProgressDisplay()

      try {
        // Ensure all namespace files for this locale exist
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
              { silent: true },
            )

            const localeKeys = await loadLocalesFile(
              loadPath,
              locale,
              namespace,
              { silent: true },
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

          for (const [key, value] of Object.entries(defaultLocaleKeys)) {
            if (!localeKeys[key]) {
              if (allMissingKeys[key]) {
                allMissingKeys[key].namespaces.push(namespace)
              } else {
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
          localeResults[locale].status = "done"
          currentlyProcessing.delete(locale)
          completedCount++
          updateProgressDisplay()
          return
        }

        // Check for existing translations
        const keysToTranslate: Record<string, string> = {}
        const existingTranslations: Record<string, string> = {}

        const existingTranslationResults = await findExistingTranslations(
          missingKeysList,
          namespaces,
          locale,
          loadPath,
          { silent: true },
        )

        for (const key of missingKeysList) {
          const existingValue = existingTranslationResults[key]
          if (existingValue !== null) {
            existingTranslations[key] = existingValue
            localeResults[locale].reused++
          } else {
            keysToTranslate[key] = allMissingKeys[key].value
          }
        }

        let translatedValues: Record<string, string> = {}

        // Translate if needed
        if (Object.keys(keysToTranslate).length > 0) {
          try {
            translatedValues = await translateKey({
              inputLanguage: defaultLocale,
              outputLanguage: locale,
              context,
              object: keysToTranslate,
              openai,
              model: config.model,
              onProgress: (completed, total) => {
                // Progress callback still works but doesn't update UI during parallel processing
              },
            })
            localeResults[locale].translated =
              Object.keys(translatedValues).length
          } catch (error) {
            localeResults[locale].status = "error"
            localeResults[locale].error =
              error instanceof Error ? error.message : "Translation failed"
            currentlyProcessing.delete(locale)
            completedCount++
            updateProgressDisplay()
            return
          }
        }

        // Combine and save
        const allTranslations = { ...existingTranslations, ...translatedValues }

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
              await writeLocalesFile(savePath, locale, namespace, updatedKeys)
            }
          }),
        )

        localeResults[locale].status = "done"
        currentlyProcessing.delete(locale)
        completedCount++
        updateProgressDisplay()
      } catch (error) {
        localeResults[locale].status = "error"
        localeResults[locale].error =
          error instanceof Error ? error.message : "Unknown error"
        currentlyProcessing.delete(locale)
        completedCount++
        updateProgressDisplay()
      }
    }

    // Suppress logs during processing
    console.log = suppressedLog

    // Process locales in batches
    for (let i = 0; i < localesToProcess.length; i += BATCH_SIZE) {
      const batch = localesToProcess.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((locale) => processLocale(locale)))
    }

    // Restore console.log
    console.log = originalConsoleLog

    progressBar.stop()

    // Print summary
    console.log("")
    console.log(chalk.green("✨ Sync complete!\n"))

    // Count totals
    let totalTranslated = 0
    let totalReused = 0
    let totalErrors = 0

    for (const locale of localesToProcess) {
      const result = localeResults[locale]
      totalTranslated += result.translated
      totalReused += result.reused
      if (result.status === "error") totalErrors++
    }

    // Show summary table
    console.log(chalk.dim("   Results by language:\n"))

    // Group results into columns for compact display
    const doneLocales = localesToProcess.filter(
      (l) => localeResults[l].status === "done",
    )
    const errorLocales = localesToProcess.filter(
      (l) => localeResults[l].status === "error",
    )

    // Show successful languages in a compact grid
    if (doneLocales.length > 0) {
      const columns = 3
      const rows = Math.ceil(doneLocales.length / columns)

      for (let row = 0; row < rows; row++) {
        let line = "   "
        for (let col = 0; col < columns; col++) {
          const idx = row + col * rows
          if (idx < doneLocales.length) {
            const locale = doneLocales[idx]
            const result = localeResults[locale]
            const label = getLanguageLabel(locale).substring(0, 14).padEnd(14)
            const count =
              result.translated > 0
                ? chalk.cyan(`+${result.translated}`.padStart(5))
                : chalk.dim(`${result.reused}`.padStart(5))
            line += `${chalk.green("✓")} ${label}${count}  `
          }
        }
        console.log(line)
      }
    }

    // Show errors if any
    if (errorLocales.length > 0) {
      console.log("")
      console.log(chalk.red("   Errors:"))
      for (const locale of errorLocales) {
        const result = localeResults[locale]
        console.log(
          chalk.red(`   ✗ ${getLanguageLabel(locale)}: ${result.error}`),
        )
      }
    }

    console.log("")
    console.log(chalk.dim("   Summary:"))
    console.log(
      chalk.dim(`   • ${chalk.white(totalTranslated)} keys translated`),
    )
    console.log(chalk.dim(`   • ${chalk.white(totalReused)} keys reused`))
    if (totalErrors > 0) {
      console.log(chalk.dim(`   • ${chalk.red(totalErrors)} languages failed`))
    }
    console.log("")
  } catch (error) {
    // Restore console.log
    console.log = originalConsoleLog
    progressBar.stop()
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
