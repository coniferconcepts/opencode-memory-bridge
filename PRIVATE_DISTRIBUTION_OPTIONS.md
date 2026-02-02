# Alternatives to npm Publishing for Private Use

## Overview

You have several excellent options for using the OpenCode Memory Bridge without publishing to the public npm registry. These range from completely private (local only) to semi-private (Git-based) to private registry solutions.

---

## Option 1: GitHub/Git Submodules (Recommended for Your Setup)

**Best for:** Your current architecture with multiple repos

### How It Works
Instead of publishing to npm, you install the package directly from GitHub using git submodules or git+https references.

### Method A: Git Submodules (Most Explicit)

```bash
# In content-tracker repo
git submodule add \
  https://github.com/coniferconcepts/opencode-memory-bridge.git \
  packages/memory-plugin

git submodule init
git submodule update
```

**package.json in content-tracker:**
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin"
  }
}
```

**Pros:**
- ✅ Perfect version control (pinned to specific commit)
- ✅ Easy to modify and test changes
- ✅ No npm publishing required
- ✅ Works with your existing repo structure
- ✅ All your code stays in git

**Cons:**
- ⚠️ Requires `git submodule update` after cloning
- ⚠️ Slightly more complex for team members

**When to Use:**
- You want explicit control over versions
- You frequently modify the bridge code
- You prefer git-based workflows

---

### Method B: Git+HTTPS Reference (Simpler)

**package.json in content-tracker:**
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "github:coniferconcepts/opencode-memory-bridge#main"
  }
}
```

Or with specific commit/tag:
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "github:coniferconcepts/opencode-memory-bridge#v3.2.0"
  }
}
```

**Installation:**
```bash
bun install
# or
npm install
```

**Pros:**
- ✅ Simple, no submodules needed
- ✅ npm/bun handles the git clone
- ✅ Can pin to specific commits/tags
- ✅ No npm publishing

**Cons:**
- ⚠️ Requires git to be installed
- ⚠️ Slower install (clones repo)
- ⚠️ Harder to make local modifications

**When to Use:**
- You want simplicity
- You don't modify the bridge often
- You want automatic updates from main branch

---

## Option 2: Local File/Path Reference (Simplest)

**Best for:** Single-machine development or monorepo

### How It Works
Reference the package directly from your local filesystem without any git remotes.

### Setup

**If keeping everything in content-tracker (current state):**
```json
// content-tracker/package.json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin"
  }
}
```

**If extracted to separate local directory:**
```json
// content-tracker/package.json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:../opencode-memory-bridge"
  }
}
```

**Installation:**
```bash
cd /content-tracker
bun install
```

This creates a symlink in node_modules pointing to your local directory.

### Directory Structure

```
~/CODE/
├── content-tracker/
│   ├── package.json (references ../opencode-memory-bridge)
│   └── node_modules/
│       └── @opencode/memory-plugin -> ../../opencode-memory-bridge
│
└── opencode-memory-bridge/
    ├── package.json
    └── src/
```

**Pros:**
- ✅ Absolute simplest setup
- ✅ Instant changes (no reinstall needed)
- ✅ Perfect for development
- ✅ No git remotes required
- ✅ No npm publishing
- ✅ No network needed

**Cons:**
- ⚠️ Only works on your local machine
- ⚠️ Team members need same directory structure
- ⚠️ Not suitable for CI/CD without adjustments
- ⚠️ Paths are absolute/relative (fragile)

**When to Use:**
- Solo development
- Rapid iteration/testing
- Proof of concepts
- Before deciding on final architecture

---

## Option 3: GitHub Packages (Private npm Registry)

**Best for:** Private npm-like experience without public npm

### How It Works
GitHub provides a private npm registry tied to your repository. You publish to GitHub Packages instead of npm.

### Setup

**1. Enable GitHub Packages in opencode-memory-bridge repo:**
```yaml
# .github/workflows/publish.yml
name: Publish to GitHub Packages
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      
      - name: Configure npm for GitHub Packages
        run: |
          echo "@coniferconcepts:registry=https://npm.pkg.github.com" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc
      
      - run: npm publish
```

**2. Update package.json to use GitHub registry:**
```json
{
  "name": "@coniferconcepts/memory-plugin",
  "version": "3.2.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

**3. In content-tracker, add .npmrc:**
```bash
# content-tracker/.npmrc
@coniferconcepts:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

**4. Install:**
```json
// content-tracker/package.json
{
  "dependencies": {
    "@coniferconcepts/memory-plugin": "^3.2.0"
  }
}
```

```bash
bun install
```

**Pros:**
- ✅ True npm package management (versions, semver, etc.)
- ✅ Private (only your GitHub org can access)
- ✅ Works with npm/bun/pnpm
- ✅ CI/CD friendly
- ✅ No public npm publishing

**Cons:**
- ⚠️ Requires GitHub authentication
- ⚠️ Slightly more setup
- ⚠️ Team members need GitHub tokens
- ⚠️ Not accessible outside GitHub ecosystem

**When to Use:**
- You want npm features without public registry
- Team needs version management
- You use GitHub for everything
- You want CI/CD integration

---

## Option 4: Private npm Registry (Verdaccio)

**Best for:** Complete control over package distribution

### How It Works
Run your own private npm registry server (like Verdaccio) and publish there instead of npm.

### Setup

**1. Run Verdaccio (locally or on server):**
```bash
# Install globally
npm install -g verdaccio

# Run the registry
verdaccio
# Registry runs on http://localhost:4873
```

**2. Configure npm to use local registry:**
```bash
# In opencode-memory-bridge
npm set registry http://localhost:4873
npm adduser --registry http://localhost:4873
npm publish
```

**3. In content-tracker:**
```bash
# Configure to use local registry
npm set registry http://localhost:4873

# Or in .npmrc
registry=http://localhost:4873
```

```json
// content-tracker/package.json
{
  "dependencies": {
    "@opencode/memory-plugin": "^3.2.0"
  }
}
```

```bash
bun install
```

**Pros:**
- ✅ Complete control
- ✅ No external dependencies
- ✅ Can be run locally or on private server
- ✅ Full npm protocol support
- ✅ Caching proxy to public npm

**Cons:**
- ⚠️ Requires running a server
- ⚠️ More infrastructure to maintain
- ⚠️ Team members need registry access
- ⚠️ Overkill for single-user scenarios

**When to Use:**
- You have many private packages
- You want complete control
- You need air-gapped/offline support
- Enterprise environment

---

## Option 5: npm Private Packages (Scoped)

**Best for:** Using npm registry but keeping packages private

### How It Works
Publish to npm with `private: true` and scoped package name. Requires npm Pro ($7/month) for private packages.

### Setup

**1. Update package.json:**
```json
{
  "name": "@coniferconcepts/memory-plugin",
  "version": "3.2.0",
  "private": true,
  "publishConfig": {
    "access": "restricted"
  }
}
```

**2. Publish (requires npm Pro subscription):**
```bash
npm login
npm publish --access restricted
```

**3. In content-tracker:**
```json
{
  "dependencies": {
    "@coniferconcepts/memory-plugin": "^3.2.0"
  }
}
```

```bash
bun install
# Will prompt for npm auth if needed
```

**Pros:**
- ✅ Official npm registry
- ✅ Full npm ecosystem integration
- ✅ Semantic versioning
- ✅ Works everywhere npm works

**Cons:**
- ⚠️ **Requires npm Pro ($7/month)**
- ⚠️ Still published to npm (just private)
- ⚠️ Not truly "self-hosted"
- ⚠️ npm account required for install

**When to Use:**
- You already have npm Pro
- You want official npm registry
- You use other npm private packages
- Budget allows for subscription

---

## Comparison Matrix

| Method | Private | Cost | Complexity | Updates | Best For |
|--------|---------|------|------------|---------|----------|
| **Git Submodules** | ✅ Private | Free | Medium | Manual | Your setup, version control |
| **Git+HTTPS** | ✅ Private | Free | Low | Semi-auto | Simple git-based installs |
| **Local Path** | ✅ Private | Free | Low | Instant | Solo dev, rapid iteration |
| **GitHub Packages** | ✅ Private | Free | Medium | Auto | GitHub-centric workflows |
| **Verdaccio** | ✅ Private | Free (self-hosted) | High | Auto | Many packages, enterprise |
| **npm Private** | ✅ Private | $7/month | Low | Auto | npm ecosystem users |

---

## Recommended Approach for Your Setup

Given your current architecture with 3 proposed repos, here are my recommendations:

### For Development Phase (Solo)
**Use: Local Path Reference**
```json
"@opencode/memory-plugin": "file:../opencode-memory-bridge"
```
- Instant changes
- No network needed
- Perfect for rapid iteration

### For Team/Production
**Use: Git Submodules OR GitHub Packages**

**Git Submodules (Recommended):**
```bash
git submodule add https://github.com/coniferconcepts/opencode-memory-bridge.git packages/memory-plugin
```
- Explicit version control
- Works with your existing workflow
- No authentication complexity
- Easy to modify and contribute back

**GitHub Packages (Alternative):**
- If you want true npm-style versioning
- If team prefers npm install over submodules
- If you use GitHub Actions extensively

### Why Not npm Public?
- ✅ You keep full control
- ✅ No accidental public exposure
- ✅ No npm account management
- ✅ No publishing overhead
- ✅ Easier to iterate rapidly

---

## Implementation Example: Git Submodules (Recommended)

### Step 1: Create opencode-memory-bridge Repo
```bash
# Create the repo on GitHub first
mkdir opencode-memory-bridge
cd opencode-memory-bridge
git init
git remote add origin https://github.com/coniferconcepts/opencode-memory-bridge.git
# ... add files ...
git push -u origin main
```

### Step 2: Add as Submodule in Content-Tracker
```bash
cd /content-tracker
git submodule add \
  https://github.com/coniferconcepts/opencode-memory-bridge.git \
  packages/memory-plugin

git submodule init
git submodule update
```

### Step 3: Reference in package.json
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin"
  }
}
```

### Step 4: Install
```bash
bun install
```

### Step 5: Update Submodule When Needed
```bash
# To get latest changes
cd packages/memory-plugin
git pull origin main
cd ../..
git add packages/memory-plugin
git commit -m "Update memory-plugin submodule"

# To pin to specific commit
cd packages/memory-plugin
git checkout abc123
cd ../..
git add packages/memory-plugin
git commit -m "Pin memory-plugin to specific commit"
```

---

## FAQ

### Q: Can I still use npm/bun with these methods?
**A:** Yes! All methods work with npm, bun, and pnpm. The package.json `file:` and `github:` protocols are standard.

### Q: What about TypeScript types?
**A:** Works the same. If using `file:` reference, TypeScript will resolve types from the local directory. If using git submodules, make sure the bridge repo has proper types exported.

### Q: Can I still version the bridge?
**A:** Yes! Even without npm, you can:
- Use git tags (e.g., `v3.2.0`)
- Pin submodules to specific commits
- Use branches (e.g., `github:...#develop`)
- Use semver in git tags

### Q: What if I want to share with a friend?
**A:** If using Git submodules or GitHub references, just give them access to the GitHub repo. They can clone and use it the same way.

### Q: Can I switch to npm later?
**A:** Absolutely! If you later decide to publish to npm (public or private), just:
1. Publish the package
2. Update package.json to use npm version
3. Remove submodule (if using that method)
4. `bun install`

### Q: Do these methods work with CI/CD?
**A:** Yes, but with considerations:
- **Git submodules:** Need `submodule: true` in GitHub Actions checkout
- **Git+HTTPS:** Works natively, just needs git
- **Local path:** Won't work in CI (path won't exist)
- **GitHub Packages:** Best for CI/CD (token-based auth)
- **Verdaccio:** Needs registry accessible from CI

---

## Summary

**For your specific situation (personal use, 3-repo architecture):**

1. **Recommended:** Git submodules with `file:` reference
   - Keeps everything in git
   - No npm publishing overhead
   - Perfect version control
   - Works with your workflow

2. **Alternative:** GitHub Packages
   - If you want npm-style versioning
   - Still private and free
   - More familiar to npm users

3. **For rapid dev:** Local path reference
   - Easiest to set up initially
   - Instant changes
   - Migrate to git later

**Avoid:** npm public registry (unnecessary for private use), npm Pro (costs money), Verdaccio (overkill for single package).

---

*Document Version: 1.0*  
*Date: 2026-02-02*  
*Purpose: Explain private distribution options for OpenCode Memory Bridge*