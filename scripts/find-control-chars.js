#!/usr/bin/env node
const fs = require('fs');

// Read the resolved content
const content = fs.readFileSync('/Users/benjaminerb/.config/opencode/opencode.json', 'utf8');

console.log('Scanning for control characters...\n');

// Find control characters
let found = false;
for (let i = 0; i < Math.min(content.length, 500000); i++) {
  const char = content.charCodeAt(i);
  // Control characters are 0-31, except tab(9), newline(10), carriage return(13)
  if (char < 32 && char !== 9 && char !== 10 && char !== 13) {
    const line = content.substring(0, i).split('\n').length;
    console.log('❌ Control character found!');
    console.log('   Position:', i);
    console.log('   Character code:', char, '(0x' + char.toString(16) + ')');
    console.log('   Line:', line);
    console.log('   Context:', JSON.stringify(content.substring(Math.max(0, i-50), i+50)));
    found = true;
    break;
  }
}

if (!found) {
  console.log('No control characters found in first 500KB');
}

// Check for tabs (char 9) which might be valid but let's see
console.log('\nChecking for tabs in prompt fields...');
const tabMatches = content.match(/"prompt":\s*"[^"]*\t[^"]*/g);
if (tabMatches) {
  console.log('Found', tabMatches.length, 'tabs in prompts');
  console.log('First occurrence:', tabMatches[0].substring(0, 100));
}
