# Publishing Guide — figma-context-mcp-air

This document explains how to publish new versions of `figma-context-mcp-air` to npm.

---

## How Releases Work (Automated Flow)

Releases are fully automated using [release-please](https://github.com/googleapis/release-please-action) and GitHub Actions. You **never manually edit the version** in `package.json`.

```
Your code change on a feature branch
       ↓
Commit with conventional prefix (feat:, fix:, etc.)
       ↓
Open PR → merge into main
       ↓
release-please opens a "Release PR" (bumps version + CHANGELOG)
       ↓
You review and merge the Release PR
       ↓
GitHub Actions automatically publishes to npm
```

---

## Step-by-Step: Publishing a New Version

### Step 1 — Make your code changes

Work on any branch (e.g. `feature/my-change` or `alternative-development`).

### Step 2 — Commit using Conventional Commits

The commit message prefix controls what version gets bumped:

| Prefix | Version bump | Example |
|--------|-------------|---------|
| `fix:` | Patch (`2.0.0` → `2.0.1`) | `fix: handle null node IDs` |
| `feat:` | Minor (`2.0.0` → `2.1.0`) | `feat: add new get_styles tool` |
| `feat!:` or `BREAKING CHANGE:` | Major (`2.0.0` → `3.0.0`) | `feat!: rename tool parameters` |
| `chore:`, `docs:`, `ci:` | No release | `docs: update README` |

```bash
git commit -m "feat: add support for component variants"
```

### Step 3 — Open a PR into `main`

Push your branch and open a Pull Request — never commit directly to `main`:

```bash
git push origin feature/my-change
```

Then go to `https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR/pulls`, open a PR from your branch into `main`, and merge it after review.

### Step 4 — Wait for the Release PR

Within ~1 minute, the GitHub Actions workflow runs and release-please opens a new PR titled something like:

> **chore: release 2.1.0**

You can see it at:
`https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR/pulls`

This PR contains:
- Updated `package.json` version
- Updated `CHANGELOG.md` with your changes listed

### Step 5 — Review and merge the Release PR

1. Open the Release PR on GitHub
2. Review the CHANGELOG entry — it lists all `feat:` and `fix:` commits since the last release
3. Click **"Merge pull request"**

### Step 6 — GitHub Actions publishes automatically

After merging the Release PR, the workflow runs again and:

1. ✅ Checks out the code
2. ✅ Runs `pnpm type-check`
3. ✅ Runs `pnpm build`
4. ✅ Runs `pnpm publish` using the `NPM_TOKEN` secret
5. ✅ Updates `server.json` with the new version
6. ✅ Publishes to the MCP Registry

Monitor progress at:
`https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR/actions`

### Step 7 — Verify on npm

Once the workflow passes, verify the new version is live:

```bash
npm view figma-context-mcp-air version
# or
npm view figma-context-mcp-air versions
```

Or visit: `https://www.npmjs.com/package/figma-context-mcp-air`

---

## Commit Message Examples

```bash
# Bug fix → 2.0.0 → 2.0.1
git commit -m "fix: correct path validation on Windows drive roots"

# New feature → 2.0.0 → 2.1.0
git commit -m "feat: add get_component_sets tool for variant inspection"

# Breaking change → 2.0.0 → 3.0.0
git commit -m "feat!: rename imageDir parameter to outputDir

BREAKING CHANGE: the imageDir parameter has been renamed to outputDir
for consistency with other tools"

# No release (docs, chores, CI)
git commit -m "docs: add usage examples to README"
git commit -m "chore: update dependencies"
git commit -m "ci: fix workflow node version"
```

---

## Infrastructure Reference

| Resource | URL |
|----------|-----|
| npm package | https://www.npmjs.com/package/figma-context-mcp-air |
| GitHub repo | https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR |
| GitHub Actions | https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR/actions |
| GitHub Secrets | https://github.com/compassalessandrolorenz/Figma-Context-MCP-AIR/settings/secrets/actions |
| npm Tokens | https://www.npmjs.com/settings/~/tokens |

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm automation token with "Bypass 2FA" enabled — used by the publish step |

### Workflow file

[`.github/workflows/release.yml`](.github/workflows/release.yml) — triggered on every push to `main`.

---

## Troubleshooting

### Workflow didn't run after pushing to main

- Check that GitHub Actions are enabled: `Settings → Actions → Allow all actions`
- Verify the push landed on `main` (not another branch)

### Publish failed with 403 Forbidden

- The `NPM_TOKEN` secret may have expired or been revoked
- Go to npmjs.com → Profile → Access Tokens → generate a new Automation token
- Update the `NPM_TOKEN` secret at: `Settings → Secrets → Actions → NPM_TOKEN`

### Publish failed with 404 Not Found

- The `NODE_AUTH_TOKEN` env var is missing from the publish step in [`release.yml`](.github/workflows/release.yml)
- Verify line 51 has: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

### release-please didn't create a Release PR

- Only `feat:` and `fix:` commits trigger releases — `chore:`, `docs:`, `ci:` do not
- Check the workflow run logs in the Actions tab for release-please output

### Version jumped unexpectedly (e.g. 2.0.0 → 3.0.0)

- A commit in the history contained `feat!:` or `BREAKING CHANGE:` in the body
- This is correct behaviour — review the CHANGELOG in the Release PR before merging