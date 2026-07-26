// Appends each log row to a CSV file in a private GitHub repo, so data
// survives Render restarts/redeploys instead of living only on the
// ephemeral local filesystem. Fire-and-forget from the caller's
// perspective — never blocks or slows down the actual API response.

const GITHUB_TOKEN = process.env.GITHUB_LOG_TOKEN;
const GITHUB_REPO = process.env.GITHUB_LOG_REPO;     // e.g. "GAGANANAIR/exposure-check-logs"
const GITHUB_PATH = process.env.GITHUB_LOG_PATH || 'check_logs.csv';
const GITHUB_BRANCH = process.env.GITHUB_LOG_BRANCH || 'main';

const HEADER = 'Time,VisitorID,IP,Country,Browser,OS,Device,Page,Method,SearchType,InputSubmitted,Result,ResponseTimeMs,Status\n';
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

function isEnabled() {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO);
}

async function githubGetFile() {
  const res = await fetch(`${API_BASE}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (res.status === 404) return { sha: null, content: HEADER };
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, content };
}

async function githubPutFile(newContent, sha, message) {
  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(newContent).toString('base64'),
      sha: sha || undefined,
      branch: GITHUB_BRANCH
    })
  });
  return res;
}

/**
 * Append one CSV row to the log file stored in the private GitHub repo.
 * Retries once on a 409 (someone else updated the file between our GET
 * and PUT — a real possibility under concurrent requests), by re-fetching
 * the latest SHA and trying again.
 */
async function appendRowToGitHub(row, attempt = 0) {
  if (!isEnabled()) return; // silently no-op if not configured

  try {
    const { sha, content } = await githubGetFile();
    const updated = content.endsWith('\n') ? content + row + '\n' : content + '\n' + row + '\n';
    const res = await githubPutFile(updated, sha, `log: append check event`);

    if (res.status === 409 && attempt < 2) {
      // Conflict — another write happened concurrently. Retry with fresh SHA.
      return appendRowToGitHub(row, attempt + 1);
    }
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      console.error('GitHub log append failed:', res.status, text);
    }
  } catch (err) {
    console.error('GitHub log append error:', err.message);
  }
}

module.exports = { appendRowToGitHub, isEnabled };
