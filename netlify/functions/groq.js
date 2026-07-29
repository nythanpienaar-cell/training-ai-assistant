// Server-side proxy for the Groq API.
//
// The Groq key lives ONLY here, as the GROQ_API_KEY environment variable set in
// the Netlify dashboard. The browser never receives it. The app calls this
// function (via /api/groq); this function adds the key and forwards to Groq.
//
// Optional gate: if ACCESS_PASSWORD is set in the Netlify environment, every
// request must carry a matching `x-access-password` header, so only people who
// know the team password can spend your Groq credits. Leave ACCESS_PASSWORD
// unset to run the proxy open (anyone with the URL can use it).
//
// Two endpoints, selected by ?endpoint=:
//   chat       -> https://api.groq.com/openai/v1/chat/completions   (JSON)
//   transcribe -> https://api.groq.com/openai/v1/audio/transcriptions (multipart)
// Both are pure passthroughs — we forward the body and content-type untouched
// and only inject the Authorization header.

const GROQ_URLS = {
  chat:       'https://api.groq.com/openai/v1/chat/completions',
  transcribe: 'https://api.groq.com/openai/v1/audio/transcriptions',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: { message: 'Method not allowed.' } });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Misconfiguration, not a user error — make it obvious in the app.
    return json(500, { error: { message: 'Server is missing GROQ_API_KEY. Set it in the Netlify dashboard.' } });
  }

  // Optional shared-password gate.
  const gate = process.env.ACCESS_PASSWORD;
  if (gate) {
    const supplied = event.headers['x-access-password'] || '';
    if (supplied !== gate) {
      return json(401, { error: { message: 'Incorrect or missing team access password.' } });
    }
  }

  const endpoint = (event.queryStringParameters && event.queryStringParameters.endpoint) || 'chat';
  const upstream = GROQ_URLS[endpoint];
  if (!upstream) {
    return json(400, { error: { message: `Unknown endpoint "${endpoint}".` } });
  }

  // Forward the raw body. Netlify base64-encodes binary bodies (audio uploads);
  // decode those back to a Buffer so the multipart payload reaches Groq intact.
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  const headers = { Authorization: `Bearer ${apiKey}` };
  // Preserve the caller's content-type (JSON, or multipart with its boundary).
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (contentType) headers['Content-Type'] = contentType;

  let groqRes;
  try {
    groqRes = await fetch(upstream, { method: 'POST', headers, body });
  } catch (err) {
    return json(502, { error: { message: `Could not reach Groq: ${err.message}` } });
  }

  // Pass Groq's response straight back — status, body, and content-type — so the
  // app's existing success/error handling works unchanged.
  const text = await groqRes.text();
  return {
    statusCode: groqRes.status,
    headers: { 'Content-Type': groqRes.headers.get('content-type') || 'text/plain' },
    body: text,
  };
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}
