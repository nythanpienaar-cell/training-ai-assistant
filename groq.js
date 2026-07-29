// Transport layer for the Groq API.
//
// Two modes, chosen at construction:
//   • direct — the browser calls Groq itself with a key the user typed. Used
//     when the page is opened straight from disk (file://) for local dev.
//   • proxy  — the browser calls this app's own Netlify function, which holds
//     the Groq key server-side and forwards the request. Used when the app is
//     served from a real host, so the team never sees or types a key.
//
// The key/access value is read via an injected getter so the client never
// touches the DOM and stays testable. In direct mode the getter supplies the
// Groq key; in proxy mode it supplies an OPTIONAL team access password (blank
// is fine unless the server was configured to require one). All failures
// (HTTP error, malformed response, empty content) surface as thrown Errors.

(function () {
  'use strict';

  const DEFAULT_CHAT_MODEL    = 'llama-3.3-70b-versatile';
  const DEFAULT_WHISPER_MODEL = 'whisper-large-v3-turbo';

  const DIRECT_CHAT_URL       = 'https://api.groq.com/openai/v1/chat/completions';
  const DIRECT_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

  // When served from a host, calls go to our own function instead of Groq.
  const PROXY_CHAT_URL       = '/api/groq?endpoint=chat';
  const PROXY_TRANSCRIBE_URL = '/api/groq?endpoint=transcribe';

  // Default: proxy whenever we're NOT opened as a local file. Opening
  // index.html straight from disk keeps the original "type your key" flow.
  function detectProxyMode() {
    return typeof location !== 'undefined' && location.protocol !== 'file:';
  }

  class GroqClient {
    constructor(apiKeyGetter, config = {}) {
      if (typeof apiKeyGetter !== 'function') {
        throw new Error('GroqClient requires a getter function for the API key.');
      }
      this._getApiKey = apiKeyGetter;
      this._proxy = config.proxy != null ? config.proxy : detectProxyMode();
      this._chatUrl       = this._proxy ? PROXY_CHAT_URL       : DIRECT_CHAT_URL;
      this._transcribeUrl = this._proxy ? PROXY_TRANSCRIBE_URL : DIRECT_TRANSCRIBE_URL;
    }

    // True when the app can make a call: always in proxy mode (the key lives on
    // the server); only with a typed key in direct mode.
    isReady() {
      return this._proxy || !!this._getApiKey();
    }

    isProxy() {
      return this._proxy;
    }

    async chat(messages, opts = {}) {
      const body = {
        model:    opts.model || DEFAULT_CHAT_MODEL,
        messages
      };
      if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;

      const headers = { 'Content-Type': 'application/json' };
      this._applyAuth(headers);

      const response = await fetch(this._chatUrl, {
        method:  'POST',
        headers,
        body:    JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Groq chat error ${response.status}`);
      }

      const data    = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Groq chat returned no content.');
      return content;
    }

    async transcribe(blob, filename, opts = {}) {
      const formData = new FormData();
      formData.append('file',            blob, filename);
      formData.append('model',           opts.model || DEFAULT_WHISPER_MODEL);
      formData.append('response_format', 'text');

      // No Content-Type here — the browser sets the multipart boundary.
      const headers = {};
      this._applyAuth(headers);

      const response = await fetch(this._transcribeUrl, {
        method:  'POST',
        headers,
        body:    formData
      });

      if (!response.ok) {
        throw new Error(`Groq transcription error ${response.status}`);
      }

      const transcript = (await response.text()).trim();
      if (!transcript) throw new Error('Groq transcription returned no text.');
      return transcript;
    }

    // Direct mode: attach the Groq key as a Bearer token (required).
    // Proxy mode: attach the optional team access password, if the user set one.
    _applyAuth(headers) {
      const val = (this._getApiKey() || '').trim();
      if (this._proxy) {
        if (val) headers['x-access-password'] = val;
        return;
      }
      if (!val) throw new Error('Missing Groq API key.');
      headers['Authorization'] = `Bearer ${val}`;
    }
  }

  window.GroqClient = GroqClient;
})();
