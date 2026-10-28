// Runs automatically on every verified Netlify Forms submission.
// For the early-access priority list, adds the person to MailerLite.
// It never throws and always returns 200, so the form submission is never blocked.

const EARLY_ACCESS_FORMS = ['october-2026-priority'];
const MAILERLITE_URL = 'https://connect.mailerlite.com/api/subscribers';
const MAILERLITE_GROUP = '202577971097109700';

function cleanEmail(raw) {
  let email = String(raw || '').trim();
  if (/\.con$/i.test(email)) email = email.slice(0, -4) + '.com';
  return email;
}

function cleanText(raw) {
  return String(raw || '').trim();
}

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: 'ok' };

  try {
    const payload = JSON.parse(event.body || '{}').payload || {};
    const formName = payload.form_name || (payload.data && payload.data['form-name']);

    if (!EARLY_ACCESS_FORMS.includes(formName)) return ok;

    const data = payload.data || {};
    const email = cleanEmail(data.email);
    if (!email) {
      console.error('[mailerlite] Early-access submission had no email, skipped', { id: payload.id });
      return ok;
    }

    const apiKey = process.env.MAILERLITE_API_KEY;
    if (!apiKey) {
      console.error('[mailerlite] MAILERLITE_API_KEY is not set, subscriber not added', { email });
      return ok;
    }

    const body = {
      email,
      fields: {
        name: cleanText(data['first-name']),
        last_name: cleanText(data['last-name']),
      },
      groups: [MAILERLITE_GROUP],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(MAILERLITE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) {
      console.log('[mailerlite] Subscriber added or updated', { email, status: res.status });
    } else {
      const text = await res.text().catch(() => '');
      console.error('[mailerlite] API error', { email, status: res.status, response: text.slice(0, 1000) });
    }
  } catch (err) {
    console.error('[mailerlite] Unexpected error', err && err.message ? err.message : err);
  }

  return ok;
};
