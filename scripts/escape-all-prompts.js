#!/usr/bin/env node
/**
 * Convert ALL prompt files to be JSON-safe for OpenCode
 * This properly escapes all characters that break JSON
 */

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = '/Users/benjaminerb/.opencode/universal/prompts';

function makeJsonSafe(content) {
  // First, escape backslashes
  let escaped = content.replace(/\\/g, '\\\\');
  
  // Then escape double quotes
  escaped = escaped.replace(/"/g, '\\"');
  
  // Then escape newlines and other control characters
  escaped = escaped.replace(/\n/g, '\\n')
                   .replace(/\r/g, '\\r')
                   .replace(/\t/g, '\\t');
  
  return escaped;
}

function processFile(filepath) {
  console.log(`Processing: ${path.basename(filepath)}`);
  
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Check if it needs conversion
  const needsConversion = content.includes('\n') || 
                          (content.includes('"') && !content.includes('\\"'));
  
  if (!needsConversion) {
    console.log(`  ℹ️  Already JSON-safe or no special chars`);
    return;
  }
  
  // Convert
  const converted = makeJsonSafe(content);
  
  // Backup original
  fs.writeFileSync(filepath + '.original', content);
  
  // Write converted
  fs.writeFileSync(filepath, converted);
  
  console.log(`  ✅ Converted to JSON-safe format`);
  console.log(`  💾 Backup: ${path.basename(filepath)}.original`);
}

console.log('Converting ALL prompt files to JSON-safe format\n');
console.log('=' .repeat(60));

// Get all files recursively
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

const allFiles = getAllFiles(PROMPTS_DIR);
console.log(`Found ${allFiles.length} files to process\n`);

let converted = 0;
for (const file of allFiles) {
  try {
    processFile(file);
    converted++;
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

console.log('\n' + '=' .repeat(60));
console.log(`✅ Processed ${converted} files`);
console.log('\nNext steps:');
console.log('1. Test: opencode');
console.log('2. If still fails, use: opencode-resolved.json');
