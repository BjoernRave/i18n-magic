import chalk from "chalk"
import cliProgress from "cli-progress"
import { languages } from "../lib/languges.js"
import type { Configuration } from "../lib/types.js"
import {
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
      status: "pending" | "processing" | "translating" | "done" | "error"
      translated: number
      translationCompleted: number
      translationTotal: number
      reused: number
      error?: string
    }
  > = {}

  for (const locale of localesToProcess) {
    localeResults[locale] = {
      status: "pending",
      translated: 0,
      translationCompleted: 0,
      translationTotal: 0,
      reused: 0,
    }
  }

  const stagedFiles = new Map<
    string,
    { locale: string; namespace: string; translations: Record<string, string> }
  >()

  const progressBars = new cliProgress.MultiBar(
    {
      format: `   {label} {bar} {percentage}% | {value}/{total} | {duration_formatted} | {status}`,
      barCompleteChar: chalk.green("█"),
      barIncompleteChar: chalk.gray("░"),
      hideCursor: true,
      clearOnComplete: false,
      emptyOnZero: true,
      etaAsynchronousUpdate: true,
      barsize: 30,
    },
    cliProgress.Presets.shades_classic,
  )

  const localeProgressBar = progressBars.create(localesToProcess.length, 0, {
    label: "Languages   ",
    status: "",
  })

  const translationProgressBar = progressBars.create(0, 0, {
    label: "Translations",
    status: "finding keys to translate...",
  })

  // Suppress console.log during progress bar display
  const originalConsoleLog = console.log
  const suppressedLog = () => {}

  try {
    // Process locales in parallel batches
    let completedCount = 0
    const currentlyProcessing: Set<string> = new Set()

    // Helper to update progress bars with currently processing languages
    const updateProgressDisplay = () => {
      const processingArray = Array.from(currentlyProcessing)
      const localeStatus =
        processingArray.length > 0
          ? `processing ${processingArray.join(", ")}`
          : ""
      localeProgressBar.update(completedCount, {
        label: "Languages   ",
        status: localeStatus,
      })

      const translationTotals = localesToProcess.reduce(
        (totals, locale) => {
          const result = localeResults[locale]
          totals.completed += result.translationCompleted
          totals.total += result.translationTotal
          return totals
        },
        { completed: 0, total: 0 },
      )
      const translationTotal = translationTotals.total
      const translationCurrent =
        translationTotal > 0
          ? Math.min(translationTotals.completed, translationTotal)
          : 0
      const activeTranslations = localesToProcess.filter((locale) => {
        const result = localeResults[locale]
        return (
          currentlyProcessing.has(locale) &&
          result.translationTotal > 0 &&
          result.translationCompleted < result.translationTotal
        )
      })
      const translationStatus =
        activeTranslations.length > 0
          ? `translating ${activeTranslations
              .map((locale) => {
                const result = localeResults[locale]
                return `${locale} ${result.translationCompleted}/${result.translationTotal}`
              })
              .join(", ")}`
          : processingArray.length > 0
            ? "waiting for translation work..."
            : translationTotal > 0
              ? "translations complete"
              : "finding keys to translate..."

      translationProgressBar.setTotal(translationTotal)
      translationProgressBar.update(translationCurrent, {
        label: "Translations",
        status: translationStatus,
      })
    }

    // Process a single locale
    const processLocale = async (locale: string) => {
      localeResults[locale].status = "processing"
      currentlyProcessing.add(locale)
      updateProgressDisplay()

      try {
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
            if (!Object.hasOwn(localeKeys, key)) {
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

        for (const key of missingKeysList) {
          const existingNamespace = namespaces.find((namespace) =>
            Object.hasOwn(namespaceKeys[namespace], key),
          )
          if (existingNamespace !== undefined) {
            existingTranslations[key] = namespaceKeys[existingNamespace][key]
            localeResults[locale].reused++
          } else {
            keysToTranslate[key] = allMissingKeys[key].value
          }
        }

        let translatedValues: Record<string, string> = {}

        // Translate if needed
        if (Object.keys(keysToTranslate).length > 0) {
          try {
            localeResults[locale].status = "translating"
            localeResults[locale].translationCompleted = 0
            localeResults[locale].translationTotal =
              Object.keys(keysToTranslate).length
            updateProgressDisplay()

            translatedValues = await translateKey({
              inputLanguage: defaultLocale,
              outputLanguage: locale,
              context,
              object: keysToTranslate,
              openai,
              model: config.model,
              onProgress: (completed, total) => {
                localeResults[locale].translationCompleted = completed
                localeResults[locale].translationTotal = total
                updateProgressDisplay()
              },
            })
            localeResults[locale].translationCompleted =
              Object.keys(keysToTranslate).length
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

        for (const namespace of namespaces) {
          let hasChanges = false
          const updatedKeys = { ...namespaceKeys[namespace] }

          for (const key of missingKeysList) {
            if (allMissingKeys[key].namespaces.includes(namespace)) {
              updatedKeys[key] = allTranslations[key]
              hasChanges = true
            }
          }

          if (hasChanges) {
            stagedFiles.set(JSON.stringify([locale, namespace]), {
              locale,
              namespace,
              translations: updatedKeys,
            })
          }
        }

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

    progressBars.stop()

    const errorLocales = localesToProcess.filter(
      (locale) => localeResults[locale].status === "error",
    )
    if (errorLocales.length > 0) {
      throw new TranslationError(
        `Sync failed for ${errorLocales.length} locale(s); no translations were written.`,
      )
    }

    for (const { locale, namespace, translations } of stagedFiles.values()) {
      await writeLocalesFile(savePath, locale, namespace, translations)
    }

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
    progressBars.stop()
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
