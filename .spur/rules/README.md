# credit-sentry spur rules

Local quality-gate ruleset, adapted from spur's own `.spur/rules/` (upstream:
`spur-new/.spur/rules`). `spur rule run` layers these files over the catalog
bundled with the installed spur (`config/rules/**`): a local file with the same
category and filename shadows the bundled one, and bundled rules with no local
counterpart still run unless a preset lists them under `disable`.

Upstream rules are tuned to spur's source repo (`packages/app`, `packages/domain`,
`plugins/sp`, Drizzle). Files here are re-scoped to `apps/**` + `packages/**`;
rules for an architecture credit-sentry does not have are disabled in
`recommended-pre-check.yaml`, each with its reason.

## Categories

| Category | Dir | Purpose |
| --- | --- | --- |
| `typescript` | `typescript/` | Bun tooling, output boundaries, biome/eslint-suppression ban, no `debugger`, mock hygiene |
| `strict` | `strict/` | Runtime boundaries (spawn/fs seams), HTTP boundaries, rule-file structure |
| `boundary` | `boundary/` | Bun SQL boundary, env-var gateway (ADR-007), config loading |
| `structure` | `structure/` | Test layout, protected files, no focused/skipped tests, no scratch verdict pointers |
| `quality` | `quality/` | Post-test gates (coverage, TSDoc on exports) |
| `surface` | `surface/` | CLI surface consistency — disabled until a Commander CLI exists |
| `migration` | `migration/` | regex → `rg` evaluator dialect check (on demand) |

Upstream `ui/` (spur's daisyUI web seam) and `docs/` (advisory citation checks)
are not adopted.

## Presets

| Preset | When | Extends |
| --- | --- | --- |
| `recommended-pre-check` | Before tests | `typescript`, `structure`, `boundary`, `surface`, `strict` |
| `recommended-post-check` | After tests | `quality` |
| `strict-check` | On demand, strict only | `strict` |
| `rg-migration` | On demand | `migration` |
