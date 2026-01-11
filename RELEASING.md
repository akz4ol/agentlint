# Releasing

This document describes how to release new versions of AgentLint.

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Release Process

### 1. Prepare the Release

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Run all checks
npm test
npm run lint
npm run build
```

### 2. Update Version

```bash
# Update version in package.json
npm version patch  # or minor, or major

# This creates a commit and tag automatically
```

### 3. Update CHANGELOG

Edit `CHANGELOG.md`:

1. Move items from `[Unreleased]` to new version section
2. Add release date
3. Update comparison links at bottom

```bash
git add CHANGELOG.md
git commit --amend --no-edit
git tag -f v$(node -p "require('./package.json').version")
```

### 4. Push Release

```bash
# Push commit and tag
git push origin main
git push origin --tags
```

### 5. GitHub Actions

The `release.yml` workflow will automatically:

1. Build the project
2. Run tests
3. Publish to npm
4. Create GitHub Release with notes

### 6. Verify Release

- Check [npm package](https://www.npmjs.com/package/agentlint)
- Check [GitHub Releases](https://github.com/akz4ol/agentlint/releases)
- Test installation: `npx agentlint@latest version`

## Hotfix Process

For urgent fixes:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/v0.1.1 v0.1.0

# Make fix, commit, then:
npm version patch
git push origin hotfix/v0.1.1
git push origin --tags

# After release, merge back to main
git checkout main
git merge hotfix/v0.1.1
git push origin main
```

## Pre-release Versions

For beta/rc versions:

```bash
npm version prerelease --preid=beta
# Creates: 0.2.0-beta.0

npm version prerelease --preid=rc
# Creates: 0.2.0-rc.0
```

Publish with tag:

```bash
npm publish --tag beta
```
