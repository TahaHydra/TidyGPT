#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('chat-sweeper')
  .description('CLI to analyze and report on ChatGPT export data locally')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a ChatGPT export zip')
  .argument('<path>', 'Path to the export zip')
  .action((path) => {
    console.log(`Analyzing export at ${path}...`);
    // Will implement using core engine
  });

program.parse();
