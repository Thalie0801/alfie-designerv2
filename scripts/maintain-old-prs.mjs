import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPO = 'Thalie0801/alfie-designer';
const BASES = new Set(['main', 'refonte-alfie-2025']);
const BLOCK_LABELS = new Set(['do-not-touch', 'needs-spec', 'security', 'WIP']);
const DAYS = 30;
const DRY_RUN = true;

function formatDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runGh(args, options = {}) {
  try {
    const { stdout } = await execFileAsync('gh', args, {
      env: { ...process.env },
      ...options,
    });
    return stdout.trim();
  } catch (error) {
    if (error.stdout || error.stderr) {
      const stdout = error.stdout?.toString().trim();
      const stderr = error.stderr?.toString().trim();
      const message = [error.message, stdout, stderr].filter(Boolean).join('\n');
      throw new Error(message);
    }
    throw error;
  }
}

function hasBlockingLabel(pr) {
  const labels = Array.isArray(pr.labels) ? pr.labels : [];
  return labels.some((label) => label?.name && BLOCK_LABELS.has(label.name));
}

function buildPlanComment({ baseRefName }) {
  return [
    `Automated maintenance (DRY_RUN=${DRY_RUN})`,
    '',
    `• Base: ${baseRefName} → Rebase planned`,
    '• CI: will run and be checked',
    '• Strategy:',
    '  - If CI ✅ and changes still relevant → squash-merge',
    '  - If CI ❌ or changes obsolete/conflicting → close + delete branch',
    '• Safeguards: no protected branches, no previews deleted, force-with-lease only.',
  ].join('\n');
}

async function listCandidatePullRequests() {
  const createdBefore = formatDate(DAYS);
  const jsonOutput = await runGh([
    'pr',
    'list',
    '-R',
    REPO,
    '--state',
    'open',
    '--search',
    `created:<=${createdBefore}`,
    '--json',
    'number,title,headRefName,baseRefName,labels,url',
  ]);

  if (!jsonOutput) {
    return [];
  }

  const prs = JSON.parse(jsonOutput);

  return prs
    .filter((pr) => BASES.has(pr.baseRefName))
    .filter((pr) => !hasBlockingLabel(pr));
}

async function commentPlan(pr) {
  const body = buildPlanComment(pr);
  await runGh([
    'pr',
    'comment',
    String(pr.number),
    '-R',
    REPO,
    '--body',
    body,
  ]);
}

async function processPullRequests() {
  const candidates = await listCandidatePullRequests();

  if (candidates.length === 0) {
    console.log('No pull requests older than 30 days found that meet the criteria.');
    return;
  }

  console.log(`Found ${candidates.length} pull request(s) older than ${DAYS} days.`);
  const summary = [];

  for (const pr of candidates) {
    console.log(`\nProcessing PR #${pr.number} (${pr.title})`);
    console.log(`Base: ${pr.baseRefName}`);
    console.log(`Head: ${pr.headRefName}`);
    console.log(`URL: ${pr.url}`);

    try {
      console.log('Posting plan comment...');
      await commentPlan(pr);
      console.log('Plan comment posted.');
      summary.push({ number: pr.number, url: pr.url, action: 'commented (plan)' });
    } catch (error) {
      console.error(`Failed to post comment on PR #${pr.number}:`, error.message);
      summary.push({ number: pr.number, url: pr.url, action: `error: ${error.message}` });
      continue;
    }

    if (DRY_RUN) {
      console.log('DRY_RUN active, skipping further actions.');
      continue;
    }

    // Placeholder for full automation when DRY_RUN is false.
  }

  console.log('\nSummary:');
  summary.forEach((entry) => {
    console.log(`#${entry.number} (${entry.url}): ${entry.action}`);
  });
}

processPullRequests().catch((error) => {
  if (error && error.code === 'ENOENT') {
    console.error('Unexpected error: GitHub CLI (gh) is not available in the current environment.');
  } else {
    console.error('Unexpected error:', error);
  }
  process.exitCode = 1;
});
