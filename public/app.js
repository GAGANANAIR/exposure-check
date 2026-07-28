const state = {
  password: null, // null = not checked, true = exposed, false = clear
  email: null,
  phone: null, // phone only affects verdict if explicitly invalid
};

function setLoading(resultEl, label) {
  resultEl.className = 'result';
  const textEl = resultEl.querySelector('.result-text');
  const barEl = resultEl.querySelector('.redaction-bar');
  textEl.textContent = '';
  barEl.className = 'redaction-bar scanning';
  barEl.textContent = label;
}

function setResult(resultEl, { ok, headline, detail }) {
  resultEl.className = `result ${ok ? 'clear' : 'exposed'}`;
  const textEl = resultEl.querySelector('.result-text');
  const barEl = resultEl.querySelector('.redaction-bar');
  textEl.innerHTML = `${headline}${detail ? `<span class="detail">${detail}</span>` : ''}`;

  // Let the text render underneath first, then peel the redaction bar
  // away to reveal it — the bar slides sideways like a censor strip.
  barEl.className = 'redaction-bar';
  barEl.textContent = '';
  requestAnimationFrame(() => {
    barEl.classList.add('lifting');
  });
}

function setError(resultEl, message) {
  resultEl.className = 'result';
  const textEl = resultEl.querySelector('.result-text');
  const barEl = resultEl.querySelector('.redaction-bar');
  textEl.innerHTML = `<span class="detail">${message}</span>`;
  barEl.className = 'redaction-bar';
  barEl.textContent = '';
  requestAnimationFrame(() => {
    barEl.classList.add('lifting');
  });
}

// ---------------------------------------------------------------------
// Progress tracker: fills in step 1/2/3 as each check completes
// ---------------------------------------------------------------------
function updateProgress() {
  const tabs = [
    { el: document.getElementById('tab-1'), value: state.password },
    { el: document.getElementById('tab-2'), value: state.email },
    { el: document.getElementById('tab-3'), value: state.phone },
  ];
  tabs.forEach(({ el, value }) => {
    el.classList.remove('done', 'exposed', 'active');
    if (value === true) el.classList.add('exposed');
    else if (value === false) el.classList.add('done');
  });
}

// ---------------------------------------------------------------------
// Live client-side password strength meter — pure heuristic, runs
// entirely locally, sends nothing anywhere. Just gives quick visual
// feedback before someone even hits "Check".
// ---------------------------------------------------------------------
function estimateStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (pw.length < 6) score = Math.min(score, 1);

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return { score, label: labels[score] || labels[labels.length - 1] };
}

function updateStrengthMeter() {
  const input = document.getElementById('password-input');
  const meter = document.getElementById('strength-meter');
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!input.value) {
    meter.classList.remove('show');
    return;
  }
  meter.classList.add('show');
  const { score, label: text } = estimateStrength(input.value);
  const pct = Math.min((score / 5) * 100, 100);
  fill.style.width = `${pct}%`;
  const colors = ['#b3311d', '#c25a1e', '#c9922c', '#7a8f3f', '#3f6d4e', '#2a4b7c'];
  fill.style.background = colors[score] || colors[colors.length - 1];
  label.textContent = text;
}

document.getElementById('password-input').addEventListener('input', updateStrengthMeter);

// Show/hide password toggle
document.getElementById('password-reveal').addEventListener('click', () => {
  const input = document.getElementById('password-input');
  const btn = document.getElementById('password-reveal');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.textContent = showing ? '👁' : '🙈';
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

function updateVerdict() {
  const stamp = document.getElementById('stamp');
  const checked = [state.password, state.email, state.phone].filter((v) => v !== null);

  updateProgress();

  if (checked.length === 0) {
    stamp.className = 'stamp';
    stamp.textContent = 'RUN A CHECK ABOVE';
    return;
  }

  const anyExposed = state.password === true || state.email === true || state.phone === true;
  const prevClass = stamp.className;

  if (anyExposed) {
    stamp.className = 'stamp exposed animate-in';
    stamp.textContent = 'EXPOSURE FOUND';
  } else {
    stamp.className = 'stamp clear animate-in';
    stamp.textContent = checked.length < 3 ? 'CLEAR SO FAR' : 'ALL CLEAR';
    if (checked.length === 3) {
      stamp.classList.add('all-clear-pulse');
    }
  }
  // Retrigger animation even if the class was already set (e.g. two clear results in a row)
  if (prevClass === stamp.className) {
    stamp.classList.remove('animate-in');
    void stamp.offsetWidth; // force reflow
    stamp.classList.add('animate-in');
  }
}

async function checkPassword() {
  const input = document.getElementById('password-input');
  const btn = document.getElementById('password-btn');
  const resultEl = document.getElementById('password-result');
  const password = input.value;

  if (!password) return;

  btn.disabled = true;
  setLoading(resultEl, 'Checking against leak database');

  try {
    const res = await fetch('/api/password-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || data.error || 'Check failed');

    state.password = data.breached;
    setResult(resultEl, {
      ok: !data.breached,
      headline: data.breached ? `⚠ Found in ${data.timesSeen.toLocaleString()} breaches` : '✓ Not found in known breaches',
      detail: data.cached ? 'result cached, no repeat API call made' : null,
    });
  } catch (err) {
    setError(resultEl, `Could not complete check: ${err.message}`);
  } finally {
    btn.disabled = false;
    updateVerdict();
  }
}

async function checkEmail() {
  const input = document.getElementById('email-input');
  const btn = document.getElementById('email-btn');
  const resultEl = document.getElementById('email-result');
  const email = input.value.trim();

  if (!email) return;

  btn.disabled = true;
  setLoading(resultEl, 'Searching breach index');

  try {
    const res = await fetch(`/api/email-check?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || data.error || 'Check failed');

    state.email = data.exposed;
    const breachNames = (data.breaches || []).slice(0, 4).join(', ');
    setResult(resultEl, {
      ok: !data.exposed,
      headline: data.exposed ? `⚠ Found in ${data.breachCount} breach source(s)` : '✓ No known breaches found',
      detail: breachNames || data.note,
    });
  } catch (err) {
    setError(resultEl, `Could not complete check: ${err.message}`);
  } finally {
    btn.disabled = false;
    updateVerdict();
  }
}

async function checkPhone() {
  const input = document.getElementById('phone-input');
  const btn = document.getElementById('phone-btn');
  const resultEl = document.getElementById('phone-result');
  const phone = input.value.trim();

  if (!phone) return;

  btn.disabled = true;
  setLoading(resultEl, 'Validating number');

  try {
    const res = await fetch('/api/phone-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || data.error || 'Check failed');

    state.phone = !data.valid; // "exposed" concept doesn't apply — invalid counts against clean verdict
    const details = [data.country, data.type, data.carrier, data.lineType].filter(Boolean).join(' · ');
    setResult(resultEl, {
      ok: data.valid,
      headline: data.valid ? '✓ Valid number format' : '⚠ Not a recognized number',
      detail: details || data.message,
    });
  } catch (err) {
    setError(resultEl, `Could not complete check: ${err.message}`);
  } finally {
    btn.disabled = false;
    updateVerdict();
  }
}

document.getElementById('password-btn').addEventListener('click', checkPassword);
document.getElementById('email-btn').addEventListener('click', checkEmail);
document.getElementById('phone-btn').addEventListener('click', checkPhone);

// Allow Enter key inside each input to trigger its own check
document.getElementById('password-input').addEventListener('keydown', (e) => e.key === 'Enter' && checkPassword());
document.getElementById('email-input').addEventListener('keydown', (e) => e.key === 'Enter' && checkEmail());
document.getElementById('phone-input').addEventListener('keydown', (e) => e.key === 'Enter' && checkPhone());

// Folder tabs lift slightly while their section's input is focused —
// like flipping open that page of the case file.
function wireTabFocus(inputId, tabId) {
  const input = document.getElementById(inputId);
  const tab = document.getElementById(tabId);
  input.addEventListener('focus', () => tab.classList.add('active'));
  input.addEventListener('blur', () => tab.classList.remove('active'));
}
wireTabFocus('password-input', 'tab-1');
wireTabFocus('email-input', 'tab-2');
wireTabFocus('phone-input', 'tab-3');

// ---------------------------------------------------------------------
// Copy summary — builds a short plain-text recap of results (never the
// actual password/email/phone value, only outcomes) and copies it.
// ---------------------------------------------------------------------
document.getElementById('copy-btn').addEventListener('click', async () => {
  const lines = ['Exposure Report summary:'];
  if (state.password !== null) lines.push(`- Password: ${state.password ? 'found in a breach' : 'not found in known breaches'}`);
  if (state.email !== null) lines.push(`- Email: ${state.email ? 'found in a breach' : 'no known breaches'}`);
  if (state.phone !== null) lines.push(`- Phone: ${state.phone ? 'not a recognized number' : 'valid number format'}`);
  if (lines.length === 1) lines.push('- No checks run yet.');

  const text = lines.join('\n');
  const confirmEl = document.getElementById('copy-confirm');
  try {
    await navigator.clipboard.writeText(text);
    confirmEl.textContent = 'Copied!';
  } catch (err) {
    confirmEl.textContent = 'Could not copy';
  }
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
});
