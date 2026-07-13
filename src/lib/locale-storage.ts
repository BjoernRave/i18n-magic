import path from "node:path"
import type { Configuration } from "./types.js"

export class LocaleConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LocaleConfigurationError"
  }
}

export const resolveConfiguredLocale = (
  config: Pick<Configuration, "defaultLocale" | "locales">,
  requested?: string,
) => {
  const locale = requested ?? config.defaultLocale

  if (!config.locales.includes(locale)) {
    throw new LocaleConfigurationError(
      `Unsupported locale "${locale}". Expected one of: ${config.locales.join(", ")}.`,
    )
  }

  return locale
}

const getConfiguredBasePath = (template: string) => {
  const placeholderIndexes = [
    template.indexOf("{{lng}}"),
    template.indexOf("{{ns}}"),
  ].filter((index) => index >= 0)

  if (placeholderIndexes.length === 0) {
    return path.dirname(path.resolve(template))
  }

  const firstPlaceholder = Math.min(...placeholderIndexes)
  const staticPrefix = template.slice(0, firstPlaceholder)

  if (
    staticPrefix.length === 0 ||
    staticPrefix.endsWith(path.sep) ||
    staticPrefix.endsWith("/") ||
    staticPrefix.endsWith("\\")
  ) {
    return path.resolve(staticPrefix || ".")
  }

  return path.dirname(path.resolve(staticPrefix))
}

export const resolveLocaleTemplatePath = (
  template: string,
  locale: string,
  namespace: string,
) => {
  const configuredBase = getConfiguredBasePath(template)
  const expandedPath = template
    .split("{{lng}}")
    .join(locale)
    .split("{{ns}}")
    .join(namespace)
  const resolvedPath = path.resolve(expandedPath)
  const relativePath = path.relative(configuredBase, resolvedPath)

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new LocaleConfigurationError(
      "Expanded locale path escapes the configured storage base.",
    )
  }

  return resolvedPath
}
