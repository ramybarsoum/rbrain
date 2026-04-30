# RBrain Apps

This directory contains small, brain-adjacent applications that should travel with the RBrain fork so teammates get the same tooling when they clone or fork the repo.

## `apps/training`

Remotion app for generating RBrain training videos.

- Source and lockfiles are committed.
- Local dependencies and generated outputs are ignored:
  - `node_modules/`
  - `build/`
  - `dist/`
  - `out/`
  - `.env*`

### Setup

```bash
cd apps/training
npm install
npm run dev
```

### Verify

```bash
cd apps/training
npm run lint
npm run build
```

### Render

Once a real composition exists:

```bash
cd apps/training
npx remotion render
```

## Policy

Keep apps here when they are tightly coupled to RBrain workflows and should be available to team members who fork the brain. Split an app into a separate repo only when it needs independent deployment, release management, permissions, or non-RBrain users.
