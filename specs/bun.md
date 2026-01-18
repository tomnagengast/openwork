# Spec: Migrate from npm to Bun

## Current State
- Package manager: npm (with pnpm@10.28.0 declared in `packageManager` field)
- Lock file: `package-lock.json`
- Node.js: 18+ required, 20+ recommended
- Build: electron-vite + Vite + TypeScript
- CI: GitHub Actions (npm ci, npm run, npm publish)

## Scope

### 1. Root Configuration

**package.json**
- Change `packageManager` field: `"pnpm@10.28.0"` → `"bun@1.x.x"` (or remove entirely)
- Update scripts using `npm run` → `bun run`:
  - `"typecheck": "bun run typecheck:node && bun run typecheck:web"`
  - `"build": "bun run typecheck && electron-vite build"`

**Lock file**
- Delete: `package-lock.json`
- Generate: `bun.lock` via `bun install`

**.npmrc**
- Evaluate if needed for bun (likely removable, `node-linker=hoisted` is npm/pnpm-specific)

### 2. CI/CD Workflows

**.github/workflows/ci.yml**
```yaml
# Before
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm run build

# After
- uses: oven-sh/setup-bun@v2
- run: bun install --frozen-lockfile
- run: bun run lint
- run: bun run typecheck
- run: bun run build
```

**.github/workflows/release.yml**
```yaml
# Before
- run: npm ci
- run: npm version ${{ ... }}
- run: npm run build
- run: npm publish --access public

# After
- uses: oven-sh/setup-bun@v2
- run: bun install --frozen-lockfile
- run: npm version ${{ ... }}  # Keep npm for version bump (writes to package.json)
- run: bun run build
- run: bunx npm publish --access public  # Or keep npm publish
```

**Note:** `npm publish` may be preferable for registry auth compatibility.

### 3. Documentation

**README.md** - Update install/run commands:
```bash
# Before
npm install
npm run dev

# After
bun install
bun run dev
```

**CONTRIBUTING.md** - Update prerequisites and commands:
- Prerequisites: Bun 1.x+ (instead of npm 10+)
- All `npm` commands → `bun`

### 4. Compatibility Concerns

| Area | Risk | Notes |
|------|------|-------|
| electron-vite | Low | Uses Node.js runtime, bun as package manager only |
| Native deps | Medium | Electron rebuilds native modules; test `better-sqlite3` if added |
| TypeScript | None | Bun handles TS natively but we use tsc for type-checking |
| Vite plugins | Low | Run via node, not bun runtime |
| npm publish | None | Can continue using npm CLI for publishing |

### 5. Migration Steps

1. Install bun locally: `curl -fsSL https://bun.sh/install | bash`
2. Delete `package-lock.json`
3. Update `package.json` scripts and `packageManager` field
4. Run `bun install` to generate `bun.lock`
5. Test locally: `bun run dev`, `bun run build`, `bun run lint`
6. Update CI workflows
7. Update README.md and CONTRIBUTING.md
8. Remove `.npmrc` if no longer needed
9. Commit all changes

## Files to Modify
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `README.md`
- `CONTRIBUTING.md`

## Files to Delete
- `package-lock.json`
- `.npmrc` (possibly)

## Files to Create
- `bun.lock` (generated)

## Unresolved Questions
1. Keep `npm publish` or switch to `bun publish`? (npm has better registry auth support)
2. Minimum bun version to require?
3. Any native module deps planned that need electron-rebuild testing?
