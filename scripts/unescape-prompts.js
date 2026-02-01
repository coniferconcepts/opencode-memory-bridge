#!/usr/bin/env node
/**
 * Unescape prompt files from JSON-safe format back to human-readable format
 * Converts \\n back to actual newlines, etc.
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = '/Users/benjaminerb/.opencode/universal/prompts';

function unescapeFile(filePath) {
  console.log(`Processing: ${path.basename(filePath)}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if it looks like JSON-escaped content
  if (!content.includes('\\n') && !content.includes('\\t') && !content.includes('\\"')) {
    console.log(`  ℹ️  Already in human-readable format`);
    return false;
  }
  
  // Unescape: convert JSON escape sequences back to actual characters
  const unescaped = content
    .replace(/\\\\/g, '\$ESC$')   // Temporarily protect \\
    .replace(/\\n/g, '\n')         // \\n -> newline
    .replace(/\\r/g, '\r')         // \\r -> carriage return
    .replace(/\\t/g, '\t')         // \\t -> tab
    .replace(/\\"/g, '"')         // \\" -> quote
    .replace(/\\'/g, "'")          // \\' -> apostrophe
    .replace(/\$ESC\$/g, '\\');     // Restore backslashes
  
  // Backup the escaped version
  const backupPath = filePath + '.escaped';
  fs.writeFileSync(backupPath, content);
  
  // Write unescaped version
  fs.writeFileSync(filePath, unescaped);
  
  console.log(`  ✅ Unescaped to human-readable format`);
  console.log(`  💾 Escaped backup: ${path.basename(backupPath)}`);
  
  return true;
}

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (item.endsWith('.txt') || item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

console.log('Unescaping Prompt Files\n');
console.log('=' .repeat(60));

const allFiles = getAllFiles(PROMPTS_DIR);
console.log(`Found ${allFiles.length} files\n`);

let converted = 0;
for (const file of allFiles) {
  try {
    if (unescapeFile(file)) {
      converted++;
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

console.log('\n' + '=' .repeat(60));
console.log(`✅ Processed ${converted} files`);
console.log('\nNext steps:');
console.log('1. Review the unescaped files');
console.log('2. Run: node scripts/build-config.js');
console.log('3. The build script will properly escape them for JSON');
