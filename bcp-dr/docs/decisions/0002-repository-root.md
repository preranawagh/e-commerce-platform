# 0002 — Repository root stays at `e-commerce-platform/`

- **Status:** Accepted
- **Date:** 2026-10-24
- **Roadmap ID:** D1

## Context

The git repository (`github.com/preranawagh/e-commerce-platform`) is rooted at `e-commerce-platform/`, but all CloudResilience code lives in its `bcp-dr/` subfolder. The blueprint's target layout calls the project root `CloudResilience/`. GitHub Actions only reads workflows from `.github/workflows/` at the **git** root.

Two options were considered:

| Option | What changes | Cost |
|---|---|---|
| (a) Make `bcp-dr/` the git root | Move `.git/` into `bcp-dr/`, or create a new repository | Every tracked path changes (`bcp-dr/x` → `x`); the existing GitHub repository's history and links no longer line up; a new or force-pushed remote |
| (b) Keep `e-commerce-platform/` as git root | Nothing moves | CI jobs set `working-directory: bcp-dr`; one extra folder level in paths |

## Decision

**Option (b).** Keep `e-commerce-platform/` as the git root; `bcp-dr/` is the CloudResilience project root (the blueprint's `CloudResilience/`).

- `.github/workflows/` will be created at `e-commerce-platform/.github/workflows/`, with `defaults.run.working-directory: bcp-dr`.
- The old root `package.json` / `package-lock.json` (which only forwarded npm scripts into `bcp-dr`) stay **deleted**. Run all npm commands from `bcp-dr/`.
- A short `README.md` at the git root points visitors to `bcp-dr/`.

## Consequences

- No history rewrite; the existing GitHub repository keeps working.
- All project docs refer to paths relative to `bcp-dr/` unless stated otherwise.
- Revisit only if the project is later published as a standalone repository; a `git subtree split --prefix=bcp-dr` can produce a clean `CloudResilience` repo at that point without losing history.
