export interface Configuration {
  loadPath: string;
  savePath: string;
  defaultLocale: string;
  defaultNamespace: string;
  namespaces: string[];
  locales: string[];
  globPatterns: string[];
  context?: string;
}
