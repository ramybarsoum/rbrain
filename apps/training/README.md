# RBrain Training Video App

Remotion app for generating RBrain training videos.

This app intentionally lives under `apps/training/` so teammates who clone or fork Ramy's RBrain repo get the training-video source and exact dependency lockfile. Do **not** commit local dependencies or generated video/bundle output.

## What is committed

- `package.json`
- `package-lock.json`
- `remotion.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `.prettierrc`
- `src/`

## What is local-only

- `node_modules/`
- `build/`
- `dist/`
- `out/`
- `.env*`

## Setup

```console
npm install
```

## Preview

```console
npm run dev
```

## Verify

```console
npm run lint
npm run build
```

## Render

Once a real composition exists:

```console
npx remotion render
```

## Current state

The Remotion shell is installed and verified. `src/Composition.tsx` is still a placeholder; it currently returns `null` until the actual training video composition is implemented.

## Remotion license note

Remotion can require a company license for some commercial uses. Check the current terms before producing commercial/distributed videos: <https://github.com/remotion-dev/remotion/blob/main/LICENSE.md>.
