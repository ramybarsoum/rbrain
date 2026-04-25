import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

// Only runs locally — Vercel deployments return instructions instead.
export async function POST(req: Request) {
  const { apply } = await req.json().catch(() => ({ apply: false }));

  // On Vercel, just return the commands to run locally
  if (process.env.VERCEL) {
    return NextResponse.json({
      mode: 'instructions',
      commands: [
        'bash scripts/sync-upstream.sh          # preview',
        'bash scripts/sync-upstream.sh --apply  # merge',
      ],
    });
  }

  // Local: find repo root relative to this file and run the script
  // dashboard/app/api/sync-upstream/route.ts → ../../.. → dashboard → .. → repo root
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');

  try {
    const scriptPath = path.join(repoRoot, 'scripts', 'sync-upstream.sh');
    const args = apply ? ['--apply'] : [];
    const { stdout, stderr } = await execFileAsync('bash', [scriptPath, ...args], {
      cwd: repoRoot,
      timeout: 60_000,
    });
    return NextResponse.json({ mode: 'ran', output: stdout + stderr, apply });
  } catch (err: any) {
    return NextResponse.json(
      { mode: 'error', output: err.stdout + err.stderr, message: err.message },
      { status: 500 },
    );
  }
}
