// Pluggable contact form submission.
//
// Priority:
//  1. If VITE_CONTACT_ENDPOINT is set, POST a Formspree-style JSON payload to it.
//  2. Otherwise, fall back to opening a mailto: link with the message prefilled
//     and resolve with { ok: true, mode: "mailto" } so the UI can show a clear
//     message to the user.
//
// In dev (no endpoint), default to the mailto fallback.

import { profile } from '../data/profile';

const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '';

// Give up rather than leaving the submit button stuck on "Sending…" forever.
const REQUEST_TIMEOUT_MS = 10000;

// The recipient is the SITE OWNER, never the visitor. The visitor's own address
// is a reply-to hint that goes in the body — using it as the `mailto:` target
// addressed every enquiry back to the person who sent it.
function ownerEmail() {
  return (profile && profile.email) || '';
}

function buildMailto({ name, email, subject, message }) {
  const body = `Hi,\n\n${message}\n\n— ${name}\n${email}`;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${ownerEmail()}?${params.toString()}`;
}

export async function sendMessage(payload) {
  // Honeypot: a hidden field only a bot fills in. Say nothing, send nothing and
  // open no mail client — a bot must not learn that it was detected, and it must
  // not be able to reach a real inbox through the mailto fallback either.
  if (payload && payload._gotcha) {
    return { ok: true, mode: 'blocked' };
  }

  if (!ENDPOINT) {
    // No endpoint configured: open the user's mail client.
    if (!ownerEmail()) {
      return { ok: false, mode: 'mailto', error: 'no-owner-email' };
    }
    if (typeof window !== 'undefined') {
      window.location.href = buildMailto(payload);
    }
    return { ok: true, mode: 'mailto' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    // An aborted request rejects with a TimeoutError, which must read as a
    // failure the visitor can retry — not as a silent hang.
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      ok: false,
      mode: 'http',
      error: timedOut ? 'Request timed out' : err?.message || 'Network error',
    };
  }
}

export const CONTACT_HAS_ENDPOINT = Boolean(ENDPOINT);

export default sendMessage;