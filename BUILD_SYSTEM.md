# Build System Quick Reference

## ⚡ One-Liner Commands

```bash
# Build and test
cd ~/CODE/opencode-global-config && node scripts/build-config.js && opencode

# Just build
node ~/CODE/opencode-global-config/scripts/build-config.js

# Build and verify
node ~/CODE/opencode-global-config/scripts/build-config.js && ls -lh ~/.config/opencode/opencode.json
```

## 🚨 Common Issues & Solutions

### Issue: "Config file is not valid JSON"
**Cause:** Using raw source config without building  
**Fix:**
```bash
cd ~/CODE/opencode-global-config && node scripts/build-config.js
```

### Issue: "Missing file" during build
**Cause:** File reference points to non-existent file  
**Fix:** Check error message, create missing file or fix path

### Issue: Agent not responding correctly
**Cause:** Syntax error in prompt file  
**Fix:**
```bash
# Check the prompt file
cat ~/.opencode/universal/prompts/agents/AGENT-NAME.txt

# Rebuild
node ~/CODE/opencode-global-config/scripts/build-config.js
```

### Issue: Need to rollback
**Fix:**
```bash
cp ~/.config/opencode/opencode.json.backup ~/.config/opencode/opencode.json
```

## 📊 Build Output Explained

```
🔧 OpenCode Configuration Builder

📖 Step 2: Reading source configuration...
   ✅ Source: CODE/opencode-global-config/config/opencode.json
   📊 Size: 9.4 KB                    ← Your maintainable source

🔗 Step 3: Resolving file references...
   ✅ Resolved 94 file references     ← All nested refs expanded
   📊 Total bytes read from files: 330.0 KB
   📊 Output size: 405.0 KB            ← Built config for OpenCode

✅ Step 4: Validating JSON...
   ✅ Valid JSON with 24 agents       ← All agents present

💰 SAVINGS vs original 121KB:
   Size reduction: -233.5%            ← Larger but maintainable
   Token reduction: ~-72,593 tokens
```

## 🔄 Workflow Cheat Sheet

### Update an Agent
```bash
# 1. Edit
vim ~/.opencode/universal/prompts/agents/tool-utility.txt

# 2. Build
cd ~/CODE/opencode-global-config && node scripts/build-config.js

# 3. Test
opencode
@tool-utility test
```

### Add a New Agent
```bash
# 1. Create prompt
vim ~/.opencode/universal/prompts/agents/my-agent.txt

# 2. Add to config/opencode.json
#    Copy an existing agent block and modify

# 3. Build & test
node scripts/build-config.js && opencode
@my-agent test
```

### Check Status
```bash
# Config size (should be ~406KB)
ls -lh ~/.config/opencode/opencode.json

# JSON validity
cat ~/.config/opencode/opencode.json | python3 -m json.tool > /dev/null && echo "✅ Valid"

# Agent count (should be 24)
grep -c '"model":' ~/.config/opencode/opencode.json
```

## 🎯 Key Points

1. **Never copy raw source config** - Always build first
2. **Source is 9.4KB** - Built is ~406KB
3. **Build resolves nested references** - Critical for functionality
4. **Automatic backups created** - Rollback if needed
5. **Edit source files** - Not the built config

## 📁 File Locations

| File | Purpose |
|------|---------|
| `config/opencode.json` | Source template (9.4KB) |
| `scripts/build-config.js` | Build script ⭐ |
| `~/.config/opencode/opencode.json` | Built config (~406KB) |
| `universal/prompts/agents/*.txt` | Agent prompts |

## 🆘 Emergency Rollback

```bash
# If everything breaks, restore backup
cp ~/.config/opencode/opencode.json.backup ~/.config/opencode/opencode.json

# Or restore the original working config
cp ~/.config/opencode/opencode.json.backup.121kb.* ~/.config/opencode/opencode.json
```
