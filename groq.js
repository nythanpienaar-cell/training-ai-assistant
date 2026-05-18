// Transport layer for the Groq API.
//
// The API key is read via an injected getter so the client never touches the
// DOM and stays testable. All failures (HTTP error, malformed response, empty
// content) surface as thrown Errors — callers wrap in try/catch.

(function () {
  'use strict';

  const DEFAULT_CHAT_MODEL    = 'llama-3.3-70b-versatile';
  const DEFAULT_WHISPER_MODEL = 'whisper-large-v3-turbo';

  const CHAT_URL       = 'https://api.groq.com/openai/v1/chat/completions';
  const TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

  class GroqClient {
    constructor(apiKeyGetter) {
      if (typeof apiKeyGetter !== 'function') {
        throw new Error('GroqClient requires a getter function for the API key.');
      }
      this._getApiKey = apiKeyGetter;
    }

    async chat(messages, opts = {}) {
      const apiKey = this._requireKey();
      const body = {
        model:    opts.model || DEFAULT_CHAT_MODEL,
        messages
      };
      if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify(body)
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
      const apiKey = this._requireKey();

      const formData = new FormData();
      formData.append('file',            blob, filename);
      formData.append('model',           opts.model || DEFAULT_WHISPER_MODEL);
      formData.append('response_format', 'text');

      const response = await fetch(TRANSCRIBE_URL, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body:    formData
      });

      if (!response.ok) {
        throw new Error(`Groq transcription error ${response.status}`);
      }

      const transcript = (await response.text()).trim();
      if (!transcript) throw new Error('Groq transcription returned no text.');
      return transcript;
    }

    _requireKey() {
      const key = this._getApiKey();
      if (!key) throw new Error('Missing Groq API key.');
      return key;
    }
  }

  window.GroqClient = GroqClient;
})();
