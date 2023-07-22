import OpenAI from 'openai';

export interface Configuration {
  loadPath: string;
  savePath: string;
  defaultLocale: string;
  defaultNamespace: string;
  namespaces: string[];
  locales: string[];
  globPatterns: string[];
  context?: string;
  openai: OpenAI;
}
