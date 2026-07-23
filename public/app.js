const state = {
  password: null, // null = not checked, true = exposed, false = clear
  email: null,
  phone: null, // phone only affects verdict if explicitly invalid
};

function setLoading(resultEl, label) {
  resultEl.className = 'result';
  resultEl.innerHTML = `<span class="redaction-line">${label}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`;
}

function setResult(resultEl, { ok, headline, detail }) {
  resultEl.className = `result ${ok ? 'clear' : 'exposed'}`;
  resultEl.innerHTML = `${headline}${detail ? `<span class="detail">${detail}</span>` : ''}`;
}

function setError(resultEl, message) {
  resultEl.className = 'result';
  resultEl.innerHTML = `<span class="detail">${message}</span>`;
}

function updateVerdict() {
  const stamp = document.getElementById('stamp');
  const checked = [state.password, state.email, state.phone].filter((v) => v !== null);

  if (checked.length === 0) {
    stamp.className = 'stamp';
    stamp.textContent = 'RUN A CHECK ABOVE';
    return;
  }

  const anyExposed = state.password === true || state.email === true || state.phone === true;

  if (anyExposed) {
    stamp.className = 'stamp exposed';
    stamp.textContent = 'EXPOSURE FOUND';
  } else {
    stamp.className = 'stamp clear';
    stamp.textContent = checked.length < 3 ? 'CLEAR SO FAR' : 'ALL CLEAR';
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
