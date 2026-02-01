#!/usr/bin/env node
/**
 * Build script for OpenCode configuration
 * Resolves file references and generates production-ready config
 * 
 * Usage: node scripts/build-config.js
 * 
 * This script:
 * 1. Reads the source config with {file:...} references
 * 2. Resolves all file references recursively
 * 3. Properly escapes content for JSON
 * 4. Validates the output is valid JSON
 * 5. Writes to ~/.config/opencode/opencode.json
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/Users/benjaminerb';
const SOURCE_CONFIG = path.join(HOME, 'CODE/opencode-global-config/config/opencode.json');
const OUTPUT_CONFIG = path.join(HOME, '.config/opencode/opencode.json');
const BACKUP_CONFIG = path.join(HOME, '.config/opencode/opencode.json.backup');

// Statistics
let stats = {
  filesResolved: 0,
  totalBytesRead: 0,
  totalBytesWritten: 0,
  errors: []
};

function resolveFileReferences(content, baseDir, depth = 0, sourceFile = 'config') {
  if (depth > 10) {
    throw new Error(`Maximum file reference depth exceeded in ${sourceFile} (circular reference?)`);
  }
  
  const regex = /\{file:([^}]+)\}/g;
  let resolved = content;
  let match;
  const matches = [];
  
  // Find all matches first
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      path: match[1],
      index: match.index
    });
  }
  
  // Resolve each reference (process in reverse to maintain string positions)
  for (let i = matches.length - 1; i >= 0; i--) {
    const { full, path: filePath } = matches[i];
    let resolvedPath = filePath;
    
    // Resolve home directory
    resolvedPath = resolvedPath.replace(/^~/, HOME);
    
    // Resolve relative paths
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.join(baseDir, resolvedPath);
    }
    
    // Normalize path
    resolvedPath = path.normalize(resolvedPath);
    
    if (!fs.existsSync(resolvedPath)) {
      const error = `❌ MISSING FILE: ${resolvedPath}\n   Referenced in: ${sourceFile}\n   Reference: ${full}`;
      stats.errors.push(error);
      console.error(error);
      continue;
    }
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(resolvedPath, 'utf8');
      stats.filesResolved++;
      stats.totalBytesRead += fileContent.length;
    } catch (err) {
      const error = `❌ ERROR reading ${resolvedPath}: ${err.message}`;
      stats.errors.push(error);
      console.error(error);
      continue;
    }
    
    // Recursively resolve nested references
    const nestedBaseDir = path.dirname(resolvedPath);
    const nestedSource = path.relative(HOME, resolvedPath);
    fileContent = resolveFileReferences(fileContent, nestedBaseDir, depth + 1, nestedSource);
    
    // Escape the content for JSON insertion
    // The files now contain actual newlines, tabs, etc. that need to be escaped
    const escaped = fileContent
      .replace(/\\/g, '\\\\')     // Escape backslashes first
      .replace(/"/g, '\\"')       // Escape double quotes
      .replace(/\n/g, '\\n')       // Escape newlines
      .replace(/\r/g, '\\r')       // Escape carriage returns
      .replace(/\t/g, '\\t');      // Escape tabs
    
    // Replace this reference with escaped content
    resolved = resolved.substring(0, matches[i].index) + escaped + resolved.substring(matches[i].index + full.length);
  }
  
  return resolved;
}

function validateJson(content) {
  try {
    const parsed = JSON.parse(content);
    return { valid: true, parsed };
  } catch (err) {
    // Try to find the error location
    const lines = content.split('\n');
    let charCount = 0;
    let errorLine = 0;
    let errorColumn = 0;
    
    const position = err.message.match(/position (\d+)/);
    if (position) {
      const pos = parseInt(position[1]);
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= pos) {
          errorLine = i + 1;
          errorColumn = pos - charCount;
          break;
        }
        charCount += lines[i].length + 1; // +1 for newline
      }
    }
    
    return { 
      valid: false, 
      error: err.message,
      line: errorLine,
      column: errorColumn,
      context: errorLine > 0 ? lines.slice(Math.max(0, errorLine - 3), errorLine + 2) : []
    };
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

console.log('🔧 OpenCode Configuration Builder\n');
console.log('=' .repeat(70));

// Step 1: Backup current config
console.log('\n💾 Step 1: Creating backup...');
if (fs.existsSync(OUTPUT_CONFIG)) {
  try {
    fs.copyFileSync(OUTPUT_CONFIG, BACKUP_CONFIG);
    console.log(`   ✅ Backup created: ${path.basename(BACKUP_CONFIG)}`);
  } catch (err) {
    console.error(`   ⚠️  Warning: Could not create backup: ${err.message}`);
  }
} else {
  console.log('   ℹ️  No existing config to backup');
}

// Step 2: Read source config
console.log('\n📖 Step 2: Reading source configuration...');
let sourceContent;
try {
  sourceContent = fs.readFileSync(SOURCE_CONFIG, 'utf8');
  console.log(`   ✅ Source: ${path.relative(HOME, SOURCE_CONFIG)}`);
  console.log(`   📊 Size: ${formatBytes(sourceContent.length)}`);
} catch (err) {
  console.error(`\n❌ Failed to read source config: ${err.message}`);
  process.exit(1);
}

// Step 3: Resolve file references
console.log('\n🔗 Step 3: Resolving file references...');
const baseDir = path.dirname(SOURCE_CONFIG);
let resolvedContent;
try {
  resolvedContent = resolveFileReferences(sourceContent, baseDir);
  console.log(`   ✅ Resolved ${stats.filesResolved} file references`);
  console.log(`   📊 Total bytes read from files: ${formatBytes(stats.totalBytesRead)}`);
  console.log(`   📊 Output size: ${formatBytes(resolvedContent.length)}`);
} catch (err) {
  console.error(`\n❌ Error resolving references: ${err.message}`);
  process.exit(1);
}

// Check for any errors during resolution
if (stats.errors.length > 0) {
  console.error(`\n❌ Found ${stats.errors.length} error(s) during file resolution:`);
  stats.errors.forEach((err, i) => {
    console.error(`\n   Error ${i + 1}:`);
    console.error(err.split('\n').map(l => '   ' + l).join('\n'));
  });
  console.error('\n⚠️  Build failed due to missing files or errors');
  process.exit(1);
}

// Step 4: Validate JSON
console.log('\n✅ Step 4: Validating JSON...');
const validation = validateJson(resolvedContent);
if (!validation.valid) {
  console.error(`\n❌ JSON validation failed: ${validation.error}`);
  if (validation.line > 0) {
    console.error(`   Location: Line ${validation.line}, Column ${validation.column}`);
    console.error('\n   Context:');
    validation.context.forEach((line, i) => {
      const lineNum = validation.line - 3 + i;
      const prefix = (lineNum === validation.line) ? '>>> ' : '    ';
      console.error(`${prefix}${lineNum}: ${line.substring(0, 80)}`);
    });
  }
  process.exit(1);
}

const agentCount = Object.keys(validation.parsed.agent || {}).length;
console.log(`   ✅ Valid JSON with ${agentCount} agents`);

// Additional validation
if (validation.parsed.$schema) {
  console.log(`   ✅ Schema: ${validation.parsed.$schema}`);
}
if (validation.parsed.model) {
  console.log(`   ✅ Default model: ${validation.parsed.model}`);
}

// Step 5: Write output
console.log('\n💾 Step 5: Writing configuration...');
try {
  // Ensure directory exists
  const outputDir = path.dirname(OUTPUT_CONFIG);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_CONFIG, resolvedContent);
  console.log(`   ✅ Written to: ${path.relative(HOME, OUTPUT_CONFIG)}`);
  stats.totalBytesWritten = resolvedContent.length;
} catch (err) {
  console.error(`\n❌ Failed to write config: ${err.message}`);
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 BUILD SUMMARY\n');
console.log(`   Source config:      ${formatBytes(sourceContent.length)}`);
console.log(`   Output config:      ${formatBytes(stats.totalBytesWritten)}`);
console.log(`   Files resolved:     ${stats.filesResolved}`);
console.log(`   Agents configured:  ${agentCount}`);

// Calculate savings vs original 121KB
const originalSize = 124350; // bytes
const savings = ((1 - stats.totalBytesWritten / originalSize) * 100).toFixed(1);
const tokenSavings = Math.round((originalSize - stats.totalBytesWritten) / 4); // ~4 bytes per token

console.log(`\n💰 SAVINGS vs original 121KB:`);
console.log(`   Size reduction:     ${savings}%`);
console.log(`   Token reduction:    ~${tokenSavings.toLocaleString()} tokens per conversation`);
console.log(`   Cost savings:       ~$${(tokenSavings * 0.00003).toFixed(2)} per conversation`);

console.log('\n' + '='.repeat(70));
console.log('✅ Build complete!\n');
console.log('Next steps:');
console.log('   1. Test: opencode');
console.log('   2. Verify agents load: @tool-utility test');
console.log('   3. If issues: cp ~/.config/opencode/opencode.json.backup ~/.config/opencode/opencode.json');
console.log('');
