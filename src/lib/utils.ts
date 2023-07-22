import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
export const loadConfig = () => {
  const filePath = path.join(process.cwd(), 'i18n-magic.js');

  if (!fs.existsSync(filePath)) {
    console.error('Config file does not exist:', filePath);
    process.exit(1);
  }

  try {
    const config = require(filePath);
    // Validate config if needed
    return config;
  } catch (error) {
    console.error('Error while loading config:', error);
    process.exit(1);
  }
};

export function removeDuplicatesFromArray<T>(arr: T[]): T[] {
  return arr.filter((item, index) => arr.indexOf(item) === index);
}

export const translateKey = async ({
  inputLanguage,
  context,
  object,
  openai,
  outputLanguage,
}: {
  object: Record<string, string>;
  context: string;
  inputLanguage: string;
  outputLanguage: string;
  openai: OpenAI;
}) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-16k-0613',
    messages: [
      {
        content: `You are a bot that translates the values of a locales JSON. ${
          context
            ? `The user provided some additional context or guidelines about what to fill in the blanks: \"${context}\". `
            : ''
        }The user provides you a JSON with a field named "inputLanguage", which defines the language the values of the JSON are defined in. It also has a field named "outputLanguage", which defines the language you should translate the values to. The last field is named "data", which includes the object with the values to translate. The keys of the values should never be changed. You output only a JSON, which has the same keys as the input, but with translated values. I give you an example input: {"inputLanguage": "English", outputLanguage: "German", "keys": {"hello": "Hello", "world": "World"}}. The output should be {"hello": "Hallo", "world": "Welt"}.`,
        role: 'system',
      },
      {
        content: JSON.stringify({
          inputLanguage,
          outputLanguage,
          data: object,
        }),
        role: 'user',
      },
    ],
  });

  return JSON.parse(completion.choices[0].message.content) as Record<
    string,
    string
  >;
};

export const loadLocalesFile = (
  path: string,
  locale: string,
  namespace: string
) => {
  const resolvedPath = path
    .replace('{{lng}}', locale)
    .replace('{{ns}}', namespace);

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const json = JSON.parse(content);

  return json;
};

export const getPureKey = (
  key: string,
  namespace?: string,
  isDefault?: boolean
) => {
  const splitted = key.split(':');

  if (splitted.length === 1) {
    if (isDefault) {
      return key;
    }

    return null;
  }

  if (splitted[0] === namespace) {
    return splitted[1];
  }

  return null;
};