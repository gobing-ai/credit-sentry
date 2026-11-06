# CreditSentry

Local statement auditing for possible duplicate charges, recurring price changes and unfamiliar
small charges, with evidence the user can review.

**Status:** product definition and feature tree established; application code is still the starter
planet demo. Financial import, parsing, auditing and privacy controls are planned. Do not load real
financial data into the current unauthenticated demo.

- [Product requirements](docs/01_PRD.md)
- [Roadmap](docs/02_ROADMAP.md)
- [Architecture](docs/03_ARCHITECTURE.md) and [surface design](docs/04_DESIGN.md)
- [Feature status](docs/05_FEATURES.md) and [generated tree](docs/features/INDEX.md)
- [BRD](docs/business_requirement_document.md) and [technical brief](docs/technical_specification.md)
- [Review and rationale](docs/plans/2026-11-05-product-review.md)

The existing Bun workspaces are `apps/{server,web,cli}` and `packages/{api,config,db,utils}`.
See [AGENTS.md](AGENTS.md) for conventions and [the ADR](docs/00_ADR.md) for decisions.

Use the versions pinned in `.prototools` (`proto use` if proto is installed), then:

```sh
bun install
bun run dev
bun run gate
```

The server defaults to port 3000; Vite defaults to 5173. The current CLI talks to the server and
only supports the demo:

```sh
bun run apps/cli/src/index.ts list
bun run apps/cli/src/index.ts create Earth
```

`bun run gate` formats, builds, typechecks, tests and runs Spur rules. Its results validate the
scaffold, not future financial behavior. The current repository license is [Apache-2.0](LICENSE);
commercial distribution terms are undecided.
