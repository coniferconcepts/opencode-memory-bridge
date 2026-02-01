#!/usr/bin/env node
const fs = require('fs');
const HOME = process.env.HOME || '/Users/benjaminerb';

function resolveFileReferences(content, depth = 0) {
  if (depth > 10) return content;
  
  const regex = /\{file:([^}]+)\}/g;
  let resolved = content;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const full = match[0];
    const filePath = match[1].replace(/^~/, HOME);
    
    if (fs.existsSync(filePath)) {
      let fileContent = fs.readFileSync(filePath, 'utf8');
      fileContent = resolveFileReferences(fileContent, depth + 1);
      // Escape for JSON
      const escaped = fileContent
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      resolved = resolved.replace(full, escaped);
    }
  }
  
  return resolved;
}

const configContent = fs.readFileSync('/Users/benjaminerb/.config/opencode/opencode.json', 'utf8');
const resolved = resolveFileReferences(configContent);

console.log('Resolved content size:', resolved.length);
console.log('Checking position 332249...\n');

// Check around position 332249
const pos = 332249;
if (pos < resolved.length) {
  const char = resolved.charCodeAt(pos);
  const line = resolved.substring(0, pos).split('\n').length;
  
  console.log('Character at position', pos, ':');
  console.log('  Code:', char, '(0x' + char.toString(16) + ')');
  console.log('  Printable:', char >= 32 && char <= 126 ? String.fromCharCode(char) : 'NO');
  console.log('  Line:', line);
  console.log('  Context:');
  console.log('  ', JSON.stringify(resolved.substring(Math.max(0, pos-100), pos+100)));
}

// Try to find all problematic characters
console.log('\nScanning entire resolved content...');
let issues = [];
for (let i = 0; i < resolved.length; i++) {
  const char = resolved.charCodeAt(i);
  if (char < 32 && char !== 9 && char !== 10 && char !== 13) {
    issues.push({pos: i, char: char, hex: char.toString(16)});
  }
}

if (issues.length > 0) {
  console.log('Found', issues.length, 'control characters:');
  issues.slice(0, 5).forEach(issue => {
    console.log('  Position', issue.pos, '- char code', issue.char, '(0x' + issue.hex + ')');
  });
} else {
  console.log('No control characters found');
}

// Check if there are unescaped newlines in strings
console.log('\nChecking for unescaped newlines in string values...');
const stringRegex = /"(?:[^"\\]|\\.)*"/g;
let stringMatch;
let stringIssues = [];

while ((stringMatch = stringRegex.exec(resolved)) !== null) {
  const str = stringMatch[0];
  // Check for actual newlines (not \n) inside the string
  if (str.includes('\n') && !str.includes('\\n')) {
    stringIssues.push({
      pos: stringMatch.index,
      preview: str.substring(0, 50) + '...'
    });
  }
}

if (stringIssues.length > 0) {
  console.log('Found', stringIssues.length, 'strings with unescaped newlines!');
  stringIssues.slice(0, 3).forEach(issue => {
    console.log('  Position', issue.pos, ':', issue.preview);
  });
} else {
  console.log('No unescaped newlines in strings');
}
