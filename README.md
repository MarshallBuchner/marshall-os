# Marshall OS

Personal AI command center / orchestration layer. Internal assistant: **JARVIS**.

## V0 scope

- Next.js App Router + TypeScript + Tailwind
- Demo fixtures clearly marked (`DEMO_FIXTURE` / `DEMO_MODE`)
- Jarvis command pipeline with approval workflow (simulated)
- Integration adapters as placeholders — **Not configured**
- No live trading, no Level 4 execution, no unrestricted autonomy
- No API keys in client code; privileged actions via `/api/jarvis` and `/api/approvals`

## Scripts

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Command center dashboard |
| `/projects` | Project registry |
| `/projects/[project]` | Mini command center |
| `/agents` | Agent registry |
| `/automations` | Example automations (disabled) |
| `/systems` | Integration adapters |
| `/knowledge` | Future knowledge layer UI |

Do not commit secrets. Leave V0 local for review when instructed.
