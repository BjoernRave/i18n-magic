import { Command } from 'commander';
import { translateMissing } from './commands/scan';
import { loadConfig } from './lib/utils';

const program = new Command();

require('dotenv').config();

program
  .name('i18n-magic')
  .description(
    'CLI to help you manage your locales JSON with translations, replacements, etc.'
  )
  .version('0.1.6');

const commands = [
  {
    name: 'scan',
    description: 'Scan for missing translations',
    action: translateMissing,
  },
];

for (const command of commands) {
  program
    .command(command.name)
    .description(command.description)
    .action(async () => {
      const config = await loadConfig();

      if (!process.env.OPENAI_KEY) {
        console.error(
          'Please provide an OpenAI API key in your .env file, called OPENAI_KEY.'
        );
        process.exit(1);
      }

      command.action(config);
    });
}

program.parse(process.argv);
