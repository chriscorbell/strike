# pnpm 12 native builds: allowBuilds, and better-sqlite3 needs no build

Read when: `pnpm install` fails with ERR_PNPM_IGNORED_BUILDS or "node-gyp: command not found", or when adding a dependency with an install script.
Status: verified
Scope: workspace install, local and CI/Docker
Verified: 2026-10-07
Source: `pnpm-workspace.yaml`; observed with pnpm 12.6.0 on mbp
Recheck when: pnpm or better-sqlite3 major version changes

pnpm 12 reads `allowBuilds:` (a map of package to true/false) in `pnpm-workspace.yaml`; `onlyBuiltDependencies` is no longer honored, and an unlisted package with an install script fails the install. better-sqlite3 13 ships prebuilt binaries for darwin/linux (glibc and musl) inside the package, so its implicit `node-gyp rebuild` is unnecessary and fails where node-gyp isn't installed: keep `better-sqlite3: false`. esbuild stays `true`. pnpm also writes `minimumReleaseAgeExclude` entries for very new releases (the Claude Agent SDK and its platform packages); keep them, or a frozen install in CI rejects the lockfile.
