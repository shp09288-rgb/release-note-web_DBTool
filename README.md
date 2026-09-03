# Release Note Web Tool

A web tool for browsing SW version history per site/equipment. Digital R&D
produces the deployment documents (HTML); this tool ingests them, parses the
changed items, and lets you look up what changed, when, and in which version.

It is not an authoring tool — documents are received and parsed, not written
or edited here.

## Setup

See **[SETUP.md](./SETUP.md)** for Supabase environment variables.

```bash
npm install
cp .env.local.example .env.local
# fill in .env.local with your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test         # vitest
npx tsc --noEmit # type check
npm run build    # production build
```

## Design

Full design and rationale: `docs/superpowers/specs/2026-09-01-sw-version-history-design.md`.
For day-to-day conventions and current status, see [CLAUDE.md](./CLAUDE.md),
[ARCHITECTURE.md](./ARCHITECTURE.md), and [MEMORY.md](./MEMORY.md).
