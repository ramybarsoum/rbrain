import { NextResponse } from 'next/server';

const OWNER    = 'ramybarsoum';
const REPO     = 'RBrain';
const WORKFLOW = 'sync-upstream.yml';
const REF      = 'master';

export async function POST() {
  const token = process.env.GITHUB_PAT;

  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_PAT env var not set. Add it in Vercel project settings.' },
      { status: 500 },
    );
  }

  // Trigger workflow_dispatch via GitHub API
  const triggerRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: REF }),
    },
  );

  // 204 = triggered successfully (GitHub returns no body)
  if (triggerRes.status === 204) {
    return NextResponse.json({
      ok: true,
      message: 'Workflow triggered.',
      actions_url: `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}`,
    });
  }

  const body = await triggerRes.text();
  return NextResponse.json(
    { error: `GitHub API error ${triggerRes.status}`, detail: body },
    { status: 502 },
  );
}
