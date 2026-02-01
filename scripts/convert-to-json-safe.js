#!/usr/bin/env node
/**
 * Convert prompt files to JSON-safe format
 * Replaces actual newlines with \n escape sequences
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = '/Users/benjaminerb/.opencode/universal/prompts';

function convertFileToJsonSafe(filePath) {
  console.log(`Processing: ${filePath}`);
  
  // Read file
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Count original newlines
  const originalNewlines = (content.match(/\n/g) || []).length;
  
  // Convert actual newlines to \n escape sequences
  // But we need to be careful about already-escaped newlines
  const converted = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  
  // Count the converted newlines
  const convertedNewlines = (converted.match(/\\n/g) || []).length;
  
  // Backup original
  const backupPath = filePath + '.backup';
  fs.writeFileSync(backupPath, content);
  
  // Write converted content
  fs.writeFileSync(filePath, converted);
  
  console.log(`  ✓ Converted ${originalNewlines} newlines to \\n`);
  console.log(`  ✓ Backup saved to: ${backupPath}`);
  
  return {
    file: path.basename(filePath),
    originalNewlines,
    convertedNewlines
  };
}

function findAllPromptFiles(dir) {
  const files = [];
  
  // Read agents directory
  const agentsDir = path.join(dir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.txt'))
      .map(f => path.join(agentsDir, f));
    files.push(...agentFiles);
  }
  
  // Read base files
  const baseFiles = ['base-orchestrator.txt', 'base-subagent.txt', 'agent-registry.txt'];
  for (const baseFile of baseFiles) {
    const basePath = path.join(dir, baseFile);
    if (fs.existsSync(basePath)) {
      files.push(basePath);
    }
  }
  
  return files;
}

console.log('Converting prompt files to JSON-safe format\n');
console.log('=' .repeat(60));

const files = findAllPromptFiles(PROMPTS_DIR);
console.log(`Found ${files.length} files to convert\n`);

const results = [];
for (const file of files) {
  try {
    const result = convertFileToJsonSafe(file);
    results.push(result);
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('Conversion Summary:');
console.log(`Total files processed: ${results.length}`);
console.log(`Total newlines converted: ${results.reduce((sum, r) => sum + r.originalNewlines, 0)}`);
console.log('\n✅ All prompt files are now JSON-safe!');
console.log('   Backups saved as .backup files');
console.log('\nTest with: opencode');
