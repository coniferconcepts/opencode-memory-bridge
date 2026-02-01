#!/usr/bin/env node
/**
 * Test script to simulate OpenCode config resolution
 * This resolves {file:...} references and validates the JSON
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = '/Users/benjaminerb/.config/opencode/opencode.json';
const HOME = process.env.HOME || '/Users/benjaminerb';

function resolveFileReferences(content, depth = 0) {
  if (depth > 10) {
    throw new Error('Maximum file reference depth exceeded (circular reference?)');
  }
  
  // Find all {file:...} references
  const regex = /\{file:([^}]+)\}/g;
  let match;
  let resolved = content;
  const matches = [];
  
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      path: match[1]
    });
  }
  
  // Resolve each reference
  for (const { full, path: filePath } of matches) {
    const resolvedPath = filePath.replace(/^~/, HOME);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ MISSING FILE: ${resolvedPath}`);
      console.error(`   Referenced as: ${full}`);
      continue;
    }
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(resolvedPath, 'utf8');
    } catch (err) {
      console.error(`❌ ERROR reading ${resolvedPath}: ${err.message}`);
      continue;
    }
    
    // Recursively resolve nested references
    fileContent = resolveFileReferences(fileContent, depth + 1);
    
    // Escape the content for JSON insertion
    // We need to escape backslashes and quotes
    const escaped = fileContent
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '\\r')   // Escape carriage returns
      .replace(/\t/g, '\\t');  // Escape tabs
    
    resolved = resolved.replace(full, escaped);
  }
  
  return resolved;
}

console.log('OpenCode Config Resolver Test\n');
console.log('=' .repeat(50));

// Read the config file
let configContent;
try {
  configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  console.log(`✅ Read config file: ${CONFIG_PATH}`);
  console.log(`   Size: ${configContent.length} bytes`);
} catch (err) {
  console.error(`❌ Failed to read config: ${err.message}`);
  process.exit(1);
}

// Resolve file references
console.log('\n📁 Resolving file references...');
let resolvedContent;
try {
  resolvedContent = resolveFileReferences(configContent);
  console.log('✅ File references resolved');
  console.log(`   New size: ${resolvedContent.length} bytes`);
} catch (err) {
  console.error(`❌ Error resolving references: ${err.message}`);
  process.exit(1);
}

// Validate JSON
console.log('\n🔍 Validating JSON...');
try {
  const parsed = JSON.parse(resolvedContent);
  console.log('✅ JSON is valid!');
  console.log(`   Agents found: ${Object.keys(parsed.agent || {}).length}`);
} catch (err) {
  console.error(`❌ JSON parsing error: ${err.message}`);
  
  // Try to find the exact location
  const lines = resolvedContent.split('\n');
  let charCount = 0;
  let errorLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1; // +1 for newline
    if (charCount >= (err.position || 0)) {
      errorLine = i + 1;
      break;
    }
  }
  
  console.error(`   Error around line: ${errorLine}`);
  
  // Show context around error
  const contextStart = Math.max(0, errorLine - 3);
  const contextEnd = Math.min(lines.length, errorLine + 2);
  
  console.error('\n   Context:');
  for (let i = contextStart; i < contextEnd; i++) {
    const prefix = (i + 1 === errorLine) ? '>>> ' : '    ';
    console.error(`${prefix}${i + 1}: ${lines[i].substring(0, 100)}`);
  }
  
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('✅ All checks passed!');
