#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { resolveConfig } from './config-resolver.js';
import { createProfileStore, NpmrcManager } from './store.js';
import { createProfileSwitcher } from './profile-switcher.js';
import { listCommand, listFullCommand, useCommand, setCommand, deleteCommand, renameCommand, copyCommand, helpCommand } from './commands.js';
import { NrsError } from './errors.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const KNOWN_COMMANDS = ['list', 'use', 'set', 'delete', 'rename', 'copy', 'help'];

function findClosestCommand(input) {
  let minDistance = Infinity;
  let closest = null;

  for (const cmd of KNOWN_COMMANDS) {
    const distance = levenshtein(input, cmd);
    if (distance < minDistance) {
      minDistance = distance;
      closest = cmd;
    }
  }

  if (closest && minDistance <= Math.max(closest.length, input.length) / 2) {
    return closest;
  }

  return closest;
}

function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function isSetCommandPattern(argv) {
  return argv.length >= 4 && argv[3] === 'set' && !KNOWN_COMMANDS.includes(argv[2]);
}

function parseSetCommand(argv) {
  const profileName = argv[2];
  const keyValue = argv[4];

  if (!keyValue) {
    return { profileName, registry: '' };
  }

  const match = keyValue.match(/^registry=(.*)$/);
  if (!match) {
    return { profileName, registry: '' };
  }

  let registry = match[1];
  if ((registry.startsWith('"') && registry.endsWith('"')) ||
      (registry.startsWith("'") && registry.endsWith("'"))) {
    registry = registry.slice(1, -1);
  }

  return { profileName, registry };
}

async function main() {
  if (isSetCommandPattern(process.argv)) {
    const parsed = parseSetCommand(process.argv);
    if (parsed) {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const result = await setCommand(store, {
        profileName: parsed.profileName,
        registry: parsed.registry,
      });
      console.log(result);
      return;
    }
  }

  const program = new Command();

  program
    .name('nrs')
    .description('NPM Registry Switcher - manage multiple npm registry profiles')
    .version(pkg.version);

  program.helpCommand(false);
  program.addHelpCommand(false);

  const listCmd = program
    .command('list')
    .description('List all profiles (active profile marked with *)')
    .action(async () => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const output = await listCommand(store);
      if (output) {
        console.log(output);
      }
    });

  listCmd
    .command('full')
    .description('List all profiles with registry URLs')
    .action(async () => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const output = await listFullCommand(store);
      if (output) {
        console.log(output);
      }
    });

  program
    .command('use <profile>')
    .description('Switch to a profile')
    .action(async (profile) => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const npmrcManager = new NpmrcManager(config.npmrcPath);
      const switcher = createProfileSwitcher({
        profileStore: store,
        npmrcManager,
      });
      const result = await useCommand(switcher, profile);
      if (result.warning) {
        console.log(`warning: ${result.warning}`);
      }
      console.log(result.message);
    });

  program
    .command('delete <profile>')
    .description('Delete a profile')
    .action(async (profile) => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const result = await deleteCommand(store, profile);
      if (result.warning) {
        console.log(`warning: ${result.warning}`);
      }
      console.log(result.message);
    });

  program
    .command('rename <old> <new>')
    .description('Rename a profile')
    .action(async (oldName, newName) => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const result = await renameCommand(store, oldName, newName);
      console.log(result.message);
    });

  program
    .command('copy <source> <target>')
    .description('Copy a profile to a new name')
    .action(async (source, target) => {
      const config = resolveConfig();
      const store = createProfileStore(config);
      const result = await copyCommand(store, source, target);
      console.log(result.message);
    });

  program
    .command('help')
    .description('Show help message')
    .action(() => {
      console.log(helpCommand());
    });

  program.on('command:*', (operands) => {
    const unknown = operands[0];
    const suggestion = findClosestCommand(unknown);
    let message = `error: Unknown command '${unknown}'.`;
    if (suggestion) {
      message += ` Did you mean '${suggestion}'?`;
    }
    console.error(message);
    process.exitCode = 1;
  });

  if (process.argv.length <= 2) {
    console.log(helpCommand());
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  if (err instanceof NrsError) {
    console.error(`error: ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`error: ${err.message}`);
  } else {
    console.error(`error: ${String(err)}`);
  }
  process.exitCode = 1;
});
