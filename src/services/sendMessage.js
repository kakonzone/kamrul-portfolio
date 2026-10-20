// Pluggable contact form submission.
//
// Priority:
//  1. If VITE_CONTACT_ENDPOINT is set, POST a Formspree-style JSON payload to it.
//  2. Otherwise, fall back to opening a mailto: link with the message prefilled
//     and resolve with { ok: true, mode: "mailto" } so the UI can show a clear
//     message to the user.
//
// In dev (no endpoint), default to the mailto fallback.

const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '';

function buildMailto({ name, email, subject, message }) {
  const body = `Hi,\n\n${message}\n\n— ${name}\n${email}`;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

export async function sendMessage(payload) {
  if (!ENDPOINT) {
    // No endpoint configured: open the user's mail client.
    if (typeof window !== 'undefined') {
      window.location.href = buildMailto(payload);
    }
    return { ok: true, mode: 'mailto' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
        _gotcha: payload._gotcha || '',
      }),
    });
    if (!res.ok) {
      return { ok: false, mode: 'http', status: res.status };
    }
    return { ok: true, mode: 'http' };
  } catch (err) {
    return { ok: false, mode: 'http', error: err?.message || 'Network error' };
  }
}

export const CONTACT_HAS_ENDPOINT = Boolean(ENDPOINT);

export default sendMessage;