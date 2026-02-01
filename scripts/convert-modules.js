#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Convert all .md files in modules directory
const modulesDir = '/Users/benjaminerb/.opencode/universal/prompts/modules';

console.log('Converting module files...\n');

const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filepath = path.join(modulesDir, file);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Check if it has actual newlines
  const hasNewlines = content.includes('\n') && !content.includes('\\n');
  
  if (hasNewlines) {
    console.log(`Converting: ${file}`);
    const originalLines = (content.match(/\n/g) || []).length;
    
    // Convert actual newlines to \n escape sequences
    const converted = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    
    // Backup
    fs.writeFileSync(filepath + '.backup', content);
    
    // Write converted
    fs.writeFileSync(filepath, converted);
    
    console.log(`  ✓ Converted ${originalLines} newlines to \\n`);
  } else {
    console.log(`Skipping: ${file} (already converted or no newlines)`);
  }
}

console.log('\n✅ Module files converted!');
