console.log('Project 54 — Training Manual Assistant loaded');

// ─── PDF.JS ───────────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let conversationHistory = [];
let pendingAttachments  = [];
let manualContents      = {};
let sessionImages       = [];
let currentManualId     = String(Date.now());
let chatDisplayMessages = [];
let customTitle         = null;   // user-defined title
let isRecording         = false;
let isListening         = false;
let mediaRecorder       = null;
let audioChunks         = [];
let speechRecognition   = null;
let dragDepth           = 0;
let attachPanelOpen     = false;

const STORAGE_KEY = 'p54_manuals';

// One-time migration: strip any legacy base64 image data from old saves
function migrateStorage() {
  if (localStorage.getItem('p54_migrated_v1')) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { localStorage.setItem('p54_migrated_v1', '1'); return; }
    const manuals = JSON.parse(raw);
    const cleaned = manuals.map(m => ({
      ...m,
      images: [],
      messages: (m.messages || []).map(msg => ({
        ...msg,
        attachments: (msg.attachments || []).map(a => {
          if (a.type === 'image') return { type: 'image', name: a.name };
          if (a.type === 'doc' || a.type === 'audio') return { type: a.type, name: a.name };
          return a;
        })
      })),
      history: (m.history || []).map(msg => {
        if (!Array.isArray(msg.content)) return msg;
        return {
          ...msg,
          content: msg.content.map(block =>
            block.type === 'image_url'
              ? { type: 'image_url', image_url: { url: '[image removed]' } }
              : block
          )
        };
      })
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    localStorage.setItem('p54_migrated_v1', '1');
    console.log('Storage migration complete — stripped legacy image/doc data');
  } catch (e) {
    console.warn('Storage migration failed:', e);
  }
}
migrateStorage();

// ─── DOM ──────────────────────────────────────────────────────────────────────
const chatInner    = document.getElementById('chat-inner');
const chatArea     = document.getElementById('chat-area');
const notesEl      = document.getElementById('notes');
const sendBtn      = document.getElementById('send-btn');
const plusBtn      = document.getElementById('plus-btn');
const attachPanel  = document.getElementById('attach-panel');
const attachBar    = document.getElementById('attachments-bar');
const inlineStatus = document.getElementById('inline-status');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const statusStop   = document.getElementById('status-stop');
const dragOverlay  = document.getElementById('drag-overlay');
const inputWrapper = document.getElementById('input-wrapper');
const sidebarList  = document.getElementById('sidebar-list');
const scrollBtn    = document.getElementById('scroll-bottom-btn');


// ══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function scrollToBottom() {
  chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
}

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function getApiKey() {
  return document.getElementById('api-key').value.trim();
}

// Extract the actual title from a generated manual
function extractManualTitle(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleaned = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
    if (cleaned.length >= 4 && cleaned.length < 90 &&
        !cleaned.startsWith('-') && !cleaned.startsWith('•') &&
        !/^\d+\.\s/.test(cleaned)) {
      return cleaned;
    }
  }
  return 'Training Manual';
}

// Detect if a response is a full training manual (not just chat)
function isManualResponse(text) {
  if (text.length < 600) return false;
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 12) return false;
  const hasNumberedSections = lines.filter(l => /^[0-9]+\.\s/.test(l)).length >= 3;
  const hasHeadings         = lines.filter(l => /^#{1,3}\s/.test(l)).length >= 3;
  return hasNumberedSections || hasHeadings;
}

// Detect if the user's message is a rename request
function isRenameRequest(text) {
  const lower = text.toLowerCase();

  // Edit/content requests must never be intercepted as renames
  const isEditRequest =
    lower.includes('edit') ||
    lower.includes('update the manual') ||
    lower.includes('change the manual') ||
    lower.includes('adjust') ||
    lower.includes('rewrite') ||
    lower.includes('modify') ||
    lower.includes('keep the content') ||
    lower.includes('keep everything') ||
    lower.includes('same content') ||
    lower.includes('just change the title') ||
    lower.includes('just update the title');

  if (isEditRequest) return false;

  return conversationHistory.length > 1 && (
    lower.includes('rename') ||
    lower.includes('name this manual') ||
    lower.includes('name the manual') ||
    lower.includes('call this manual') ||
    lower.includes('call the manual') ||
    (lower.includes('title') && lower.includes(' to ') && lower.length < 60)
  );
}

// Domain function: ask the chat model to extract a manual title from a rename
// message. Built on top of groqClient.chat so the prompt lives with the product,
// not the transport.
async function extractTitleFromMessage(userMessage) {
  const content = await groqClient.chat(
    [
      {
        role: 'system',
        content: 'You extract title names from messages. The user wants to rename their training manual. Reply with ONLY the new title name. No explanation. No punctuation around it. No quotes. Just the title itself.'
      },
      { role: 'user', content: userMessage }
    ],
    { maxTokens: 30 }
  );
  return content.trim();
}

function getManualTitle() {
  if (customTitle) return customTitle;
  const latestManual = Object.values(manualContents).slice(-1)[0] || '';
  return latestManual ? extractManualTitle(latestManual) : 'Untitled Manual';
}


// ══════════════════════════════════════════════════════════════════════════════
// GROQ CLIENT
// ══════════════════════════════════════════════════════════════════════════════
// Transport seam for all Groq calls. Implementation lives in groq.js. The key
// getter is late-bound so the user can update the key in settings mid-session.

const groqClient = new GroqClient(() => getApiKey());


// ══════════════════════════════════════════════════════════════════════════════
// SCROLL TO BOTTOM BUTTON
// ══════════════════════════════════════════════════════════════════════════════

chatArea.addEventListener('scroll', () => {
  const distFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
  scrollBtn.classList.toggle('visible', distFromBottom > 160);
});

scrollBtn.addEventListener('click', scrollToBottom);


// ══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE — MANUAL HISTORY
// ══════════════════════════════════════════════════════════════════════════════

function getAllManuals() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveCurrentManual() {
  if (conversationHistory.length === 0 && Object.keys(manualContents).length === 0) return;

  const manuals  = getAllManuals();
  const existing = manuals.findIndex(m => m.id === currentManualId);

  const record = {
    id:           currentManualId,
    title:        getManualTitle(),
    customTitle:  customTitle,
    date:         new Date().toISOString(),
    history:      conversationHistory.map(msg => {
      if (!Array.isArray(msg.content)) return msg;
      return {
        ...msg,
        content: msg.content.map(block =>
          block.type === 'image_url'
            ? { type: 'image_url', image_url: { url: '[image removed]' } }
            : block
        )
      };
    }),
    messages:     chatDisplayMessages.map(msg => ({
      ...msg,
      attachments: (msg.attachments || []).map(a => {
        if (a.type === 'image') return { type: 'image', name: a.name };
        if (a.type === 'doc' || a.type === 'audio') return { type: a.type, name: a.name };
        return a;
      })
    })),
    manualTexts:  manualContents,
    images:       []
  };

  if (existing >= 0) manuals[existing] = record;
  else manuals.unshift(record);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manuals.slice(0, 40)));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manuals.slice(0, 15)));
  }

  renderSidebar();
}

function renderSidebar(preloadedManuals) {
  const manuals = preloadedManuals || getAllManuals();

  if (manuals.length === 0) {
    sidebarList.innerHTML = '<div class="sidebar-empty">Your manuals will appear here.</div>';
    return;
  }

  sidebarList.innerHTML = manuals.map(m => `
    <div class="sidebar-item ${m.id === currentManualId ? 'active' : ''}"
         data-id="${m.id}" onclick="loadManual('${m.id}')">
      <div class="sidebar-item-main">
        <div class="sidebar-item-title">${escapeHtml(m.customTitle || m.title || 'Untitled Manual')}</div>
        <div class="sidebar-item-date">${relativeTime(m.date)}</div>
      </div>
      <div class="sidebar-item-actions" onclick="event.stopPropagation()">
        <button class="sidebar-action" title="Rename" onclick="renameManual('${m.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="sidebar-action del" title="Delete" onclick="deleteManual('${m.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

window.loadManual = async function (id) {
  console.log(`loadManual: start — id=${id}`);

  // Show loading indicator immediately so the screen doesn't appear frozen
  chatInner.innerHTML = '';
  const loadingEl = document.createElement('div');
  loadingEl.className = 'system-wrap';
  loadingEl.innerHTML = '<div class="system-msg">Loading manual…</div>';
  chatInner.appendChild(loadingEl);

  // Yield to the browser so the loading message paints before heavy work begins
  await new Promise(r => setTimeout(r, 0));

  console.log('loadManual: saving current session');
  saveCurrentManual();

  // Read localStorage once and reuse the result everywhere
  console.log('loadManual: reading from localStorage');
  const manuals = getAllManuals();
  const manual  = manuals.find(m => m.id === id);
  if (!manual) {
    console.warn('loadManual: manual not found');
    loadingEl.remove();
    return;
  }

  console.log('loadManual: restoring state');
  currentManualId     = manual.id;
  conversationHistory = manual.history || [];
  chatDisplayMessages = manual.messages || [];
  manualContents      = manual.manualTexts || {};
  sessionImages       = manual.images || [];
  customTitle         = manual.customTitle || null;

  loadingEl.remove();

  // Render messages in async batches — yields every 5 messages so the browser
  // can stay responsive instead of locking up for the entire render loop
  const msgs = [...chatDisplayMessages];
  console.log(`loadManual: rendering ${msgs.length} messages`);
  for (let i = 0; i < msgs.length; i++) {
    renderStoredMessage(msgs[i]);
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 0));
  }

  scrollToBottom();

  // Pass the already-loaded manuals array so renderSidebar doesn't re-parse localStorage
  console.log('loadManual: rendering sidebar');
  renderSidebar(manuals);
  console.log('loadManual: complete');
};

window.renameManual = function (id) {
  const manuals = getAllManuals();
  const manual  = manuals.find(m => m.id === id);
  if (!manual) return;

  const current  = manual.customTitle || manual.title || 'Untitled Manual';
  const newTitle = window.prompt('Rename manual:', current);
  if (!newTitle || !newTitle.trim() || newTitle.trim() === current) return;

  manual.customTitle = newTitle.trim();
  manual.title       = newTitle.trim();
  manual.date        = new Date().toISOString();

  if (id === currentManualId) customTitle = newTitle.trim();

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(manuals)); } catch {}
  renderSidebar();
};

window.deleteManual = function (id) {
  if (!window.confirm('Delete this manual? This cannot be undone.')) return;

  let manuals = getAllManuals().filter(m => m.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(manuals)); } catch {}

  if (id === currentManualId) startNewManual();
  else renderSidebar();
};

function renderStoredMessage(msg) {
  if (msg.role === 'assistant' && msg.isManual) {
    renderManualMessage(msg.content, msg.msgId);
  } else if (msg.role === 'assistant') {
    renderAssistantBubble(msg.content);
  } else if (msg.role === 'user') {
    renderUserMessage(msg.content, msg.attachments || []);
  } else if (msg.role === 'system') {
    addSystemMessage(msg.content, true);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW MANUAL
// ══════════════════════════════════════════════════════════════════════════════

document.getElementById('new-manual-btn').addEventListener('click', startNewManual);

function startNewManual() {
  saveCurrentManual();
  currentManualId     = String(Date.now());
  conversationHistory = [];
  chatDisplayMessages = [];
  manualContents      = {};
  sessionImages       = [];
  pendingAttachments  = [];
  customTitle         = null;

  chatInner.innerHTML = '';
  renderAttachmentsBar();
  showWelcome();
  renderSidebar();
  notesEl.focus();
}


// ══════════════════════════════════════════════════════════════════════════════
// WELCOME MESSAGE
// ══════════════════════════════════════════════════════════════════════════════

function showWelcome() {
  const el = document.createElement('div');
  el.className = 'message';
  el.innerHTML = `
    <div class="msg-avatar">54</div>
    <div class="welcome-wrap">
      <div class="welcome-card">
        <div class="welcome-logo-row">
          <div class="welcome-logo">PROJECT <span>54</span></div>
          <div class="welcome-subtitle">Training Manual Assistant</div>
        </div>
        <p class="welcome-text">
          Welcome — what would you like to <strong>create today?</strong>
        </p>
      </div>
    </div>`;
  chatInner.appendChild(el);
}

showWelcome();
renderSidebar();


// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

document.getElementById('settings-btn').addEventListener('click', function () {
  document.getElementById('settings-drawer').classList.toggle('open');
  this.classList.toggle('active');
});

document.getElementById('toggle-btn').addEventListener('click', function () {
  const input = document.getElementById('api-key');
  if (input.type === 'password') { input.type = 'text'; this.textContent = 'Hide'; }
  else { input.type = 'password'; this.textContent = 'Show'; }
});


// ══════════════════════════════════════════════════════════════════════════════
// TEXTAREA — auto-expand, paste, send on Enter
// ══════════════════════════════════════════════════════════════════════════════

function resizeTextarea() {
  notesEl.style.height = 'auto';
  notesEl.style.height = Math.min(notesEl.scrollHeight, 160) + 'px';
}

notesEl.addEventListener('input', resizeTextarea);

// Explicit paste handler — ensures resize works after paste
notesEl.addEventListener('paste', () => {
  setTimeout(resizeTextarea, 0);
});

notesEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    const active = document.activeElement;
    const isInputFocused = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    );
    const hasSelection = window.getSelection()?.toString().length > 0;
    if (!isInputFocused && !hasSelection) notesEl.focus();
  }
});

document.addEventListener('paste', (e) => {
  const active = document.activeElement;
  const isInputFocused = active && (
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA' ||
    active.isContentEditable
  );

  if (isInputFocused) return;

  e.preventDefault();
  notesEl.focus();
  const text = e.clipboardData.getData('text/plain');
  const start = notesEl.selectionStart;
  const end   = notesEl.selectionEnd;
  notesEl.value = notesEl.value.substring(0, start) + text + notesEl.value.substring(end);
  notesEl.selectionStart = notesEl.selectionEnd = start + text.length;
  resizeTextarea();
});

// Clicking anywhere in the input wrapper focuses the textarea
inputWrapper.addEventListener('click', (e) => {
  if (e.target !== notesEl) notesEl.focus();
});

sendBtn.addEventListener('click', handleSend);


// ══════════════════════════════════════════════════════════════════════════════
// SEND / HANDLE MESSAGE
// ══════════════════════════════════════════════════════════════════════════════

async function handleSend() {
  const text        = notesEl.value.trim();
  const attachments = [...pendingAttachments];

  if (!text && attachments.length === 0) return;

  if (!getApiKey()) {
    addSystemMessage('Please open ⚙ settings and enter your Groq API key.');
    document.getElementById('settings-drawer').classList.add('open');
    document.getElementById('settings-btn').classList.add('active');
    return;
  }

  // Clear input
  pendingAttachments = [];
  renderAttachmentsBar();
  notesEl.value = '';
  notesEl.style.height = 'auto';
  sendBtn.disabled = true;

  // Rename requests are handled with a completely isolated API call — not via the
  // main conversation history, so the system prompt context doesn't interfere
  if (isRenameRequest(text)) {
    renderUserMessage(text, []);
    chatDisplayMessages.push({ role: 'user', content: text, attachments: [] });
    const typingId = addTypingIndicator();
    try {
      const newTitle = await extractTitleFromMessage(text);
      if (newTitle) {
        customTitle = newTitle;
        saveCurrentManual();
        renderSidebar();
        removeTypingIndicator(typingId);
        renderAssistantBubble(`Done — manual renamed to "${newTitle}"`);
        chatDisplayMessages.push({ role: 'assistant', content: `Done — manual renamed to "${newTitle}"`, isManual: false });
      } else {
        removeTypingIndicator(typingId);
        renderAssistantBubble('I could not figure out the new title. Try: "Rename this manual to Staff Onboarding"');
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      addSystemMessage(`Rename failed: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      notesEl.focus();
    }
    return;
  }

  // Render user bubble
  renderUserMessage(text, attachments);
  chatDisplayMessages.push({ role: 'user', content: text, attachments });

  // Store images for PDF
  const imageAtts = attachments.filter(a => a.type === 'image');
  sessionImages.push(...imageAtts.map(a => ({ name: a.name, dataUrl: a.dataUrl, format: a.format })));

  const typingId = addTypingIndicator();

  try {
    // Build user content
    const hasImages = imageAtts.length > 0;
    let userContent;

    if (hasImages) {
      userContent = [];
      let combined = text || '';
      const docTexts = attachments.filter(a => a.type === 'doc' || a.type === 'audio').map(a => a.text).filter(Boolean);
      if (docTexts.length) combined += (combined ? '\n\n' : '') + docTexts.join('\n\n');
      userContent.push({ type: 'text', text: combined || 'Please use this image.' });
      for (const img of imageAtts) {
        userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
      }
    } else {
      let combined = text || '';
      const docTexts = attachments.filter(a => a.type === 'doc' || a.type === 'audio').map(a => a.text).filter(Boolean);
      if (docTexts.length) combined += (combined ? '\n\n' : '') + docTexts.join('\n\n');
      userContent = combined;
    }

    // Build conversation
    if (conversationHistory.length === 0) {
      conversationHistory.push({
        role: 'system',
        content: `You are a helpful assistant for Project 54, an organisation operating across Africa.

You can have normal conversations AND create professional training manuals.

CONVERSATION RULES:
- For greetings, small talk, or general questions: respond naturally and helpfully. Keep it short and friendly.
- For requests to create a training manual, or when the user provides notes/topics/documents: produce a full, structured training manual.
- For follow-up messages after creating a manual: refine or adjust it as requested.

MANUAL FORMAT (only when creating a manual):
- Clear title on the very first line
- Introduction
- Numbered sections with headings
- Step-by-step instructions where relevant
- Conclusion

Tone: professional but warm and approachable.`
      });
    }

    conversationHistory.push({ role: 'user', content: userContent });

    const model  = hasImages ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';
    const result = await groqClient.chat(conversationHistory, { model });
    conversationHistory.push({ role: 'assistant', content: result });

    removeTypingIndicator(typingId);

    // Decide: manual card or regular chat bubble
    if (isManualResponse(result)) {
      const msgId = renderManualMessage(result);
      chatDisplayMessages.push({ role: 'assistant', content: result, isManual: true, msgId });
    } else {
      renderAssistantBubble(result);
      chatDisplayMessages.push({ role: 'assistant', content: result, isManual: false });
    }

    saveCurrentManual();

  } catch (err) {
    console.error('Send error:', err);
    removeTypingIndicator(typingId);
    addSystemMessage(`❌ ${err.message}`);
    if (conversationHistory.at(-1)?.role === 'user') conversationHistory.pop();
  } finally {
    sendBtn.disabled = false;
    notesEl.focus();
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// RENDER MESSAGES
// ══════════════════════════════════════════════════════════════════════════════

function avatarHTML() {
  return '<div class="msg-avatar">54</div>';
}

function renderAssistantBubble(content) {
  const el = document.createElement('div');
  el.className = 'message';
  el.innerHTML = `${avatarHTML()}<div class="msg-bubble"><div class="msg-bubble-inner">${escapeHtml(content)}</div></div>`;
  chatInner.appendChild(el);
  scrollToBottom();
}

function renderUserMessage(text, attachments = []) {
  const el = document.createElement('div');
  el.className = 'message message-user';

  const docAtts  = attachments.filter(a => a.type === 'doc' || a.type === 'audio');
  const imgAtts  = attachments.filter(a => a.type === 'image');

  let inner = '';

  if (imgAtts.length) {
    inner += `<div class="user-images">`;
    for (const img of imgAtts) {
      if (img.dataUrl) {
        inner += `<img class="user-img-thumb" src="${img.dataUrl}" alt="${escapeHtml(img.name)}" title="${escapeHtml(img.name)}"/>`;
      } else {
        inner += `<div class="user-file-chip">🖼 ${escapeHtml(img.name)}</div>`;
      }
    }
    inner += `</div>`;
  }

  for (const doc of docAtts) {
    inner += `<div class="user-file-chip">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      ${escapeHtml(doc.name)}
    </div>`;
  }

  if (text) inner += escapeHtml(text);

  el.innerHTML = `<div class="msg-bubble"><div class="msg-bubble-inner">${inner || '(Attached)'}</div></div>`;
  chatInner.appendChild(el);
  scrollToBottom();
}

function renderManualMessage(content, existingMsgId) {
  const msgId = existingMsgId || Date.now();
  manualContents[msgId] = content;

  const el = document.createElement('div');
  el.className = 'message';
  el.id = `msg-${msgId}`;
  el.innerHTML = `
    ${avatarHTML()}
    <div class="manual-wrap">
      <div class="manual-card">
        <div class="manual-card-header">
          <span class="manual-badge">Training Manual</span>
          <div class="manual-actions">
            <button class="manual-action-btn" onclick="downloadPDF(${msgId})">↓ PDF</button>
            <button class="manual-action-btn" onclick="copyManual(${msgId})">Copy</button>
          </div>
        </div>
        <div class="manual-text" id="manual-text-${msgId}"></div>
      </div>
    </div>`;

  chatInner.appendChild(el);
  document.getElementById(`manual-text-${msgId}`).textContent = content;
  scrollToBottom();
  return msgId;
}

function addTypingIndicator() {
  const id = `typing-${Date.now()}`;
  const el = document.createElement('div');
  el.className = 'message';
  el.id = id;
  el.innerHTML = `${avatarHTML()}<div class="msg-bubble"><div class="msg-bubble-inner"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  chatInner.appendChild(el);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

function addSystemMessage(text, skipStore = false) {
  const el = document.createElement('div');
  el.className = 'system-wrap';
  el.innerHTML = `<div class="system-msg">${escapeHtml(text)}</div>`;
  chatInner.appendChild(el);
  if (!skipStore) chatDisplayMessages.push({ role: 'system', content: text });
  scrollToBottom();
}


// ══════════════════════════════════════════════════════════════════════════════
// COPY & PDF
// ══════════════════════════════════════════════════════════════════════════════

window.copyManual = function (id) {
  const content = manualContents[id];
  if (!content) return;
  navigator.clipboard.writeText(content).then(() => {
    const btn = document.querySelector(`#msg-${id} .manual-action-btn:last-child`);
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2200); }
  });
};

window.downloadPDF = function (id) {
  const content = manualContents[id];
  if (!content) return;

  const { jsPDF } = window.jspdf;
  const doc       = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW     = doc.internal.pageSize.getWidth();
  const pageH     = doc.internal.pageSize.getHeight();
  const margin    = 18;
  const textW     = pageW - margin * 2;
  let y           = 0;

  function drawHeader() {
    doc.setFillColor(53, 71, 57);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(235, 229, 216);
    doc.text('PROJECT 54', margin, 10.5);
    doc.setTextColor(206, 133, 35);
    doc.text('Training Manual', pageW - margin, 10.5, { align: 'right' });
    doc.setTextColor(53, 71, 57);
  }

  function drawFooter() {
    doc.setFillColor(235, 229, 216);
    doc.rect(0, pageH - 11, pageW, 11, 'F');
  }

  function newPage() {
    drawFooter();
    doc.addPage();
    drawHeader();
    return 26;
  }

  drawHeader();
  y = 28;

  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { y += 3.5; continue; }

    const isTitle   = /^#/.test(line);
    const isSection = /^[0-9]+\.\s/.test(line) || /^[A-Z][A-Z\s\-:]{4,}$/.test(line.trim());
    const isBullet  = /^[-•*]\s/.test(line);

    let fontSize   = 10;
    let fontStyle  = 'normal';
    let lineH      = 5.5;
    let indent     = margin;

    if (isTitle)   { fontSize = 15; fontStyle = 'bold'; lineH = 8; }
    else if (isSection) { fontSize = 11; fontStyle = 'bold'; lineH = 6.5; }
    else if (isBullet)  { indent = margin + 4; }

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);

    const cleanLine = line.replace(/^#+\s*/, '').replace(/^[-•*]\s/, isBullet ? '• ' : '');
    const wrapped   = doc.splitTextToSize(cleanLine, isBullet ? textW - 4 : textW);

    for (const wl of wrapped) {
      if (y + lineH > pageH - 14) y = newPage();
      doc.text(wl, indent, y);
      y += lineH;
    }

    if (isTitle || isSection) y += 2;
  }

  // Embed images
  for (const img of sessionImages) {
    try {
      y = newPage();
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(53, 71, 57);
      doc.text(`Reference: ${img.name}`, margin, y);
      y += 6;
      doc.addImage(img.dataUrl, img.format || 'JPEG', margin, y, textW, Math.min(pageH - y - 20, textW * 0.65));
    } catch (e) { console.warn('Image embed error:', e); }
  }

  drawFooter();

  // Page numbers
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 155, 145);
    doc.text(`Page ${i} of ${total}  —  Project 54 Confidential`, pageW / 2, pageH - 4, { align: 'center' });
  }

  const titleLine  = content.split('\n').find(l => l.trim());
  const safeTitle  = (titleLine || 'Training Manual').replace(/^#+\s*/, '').replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 45);
  doc.save(`${safeTitle || 'Training Manual'}.pdf`);
};


// ══════════════════════════════════════════════════════════════════════════════
// + BUTTON & ATTACH PANEL
// ══════════════════════════════════════════════════════════════════════════════

plusBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  attachPanelOpen = !attachPanelOpen;
  attachPanel.classList.toggle('open', attachPanelOpen);
  plusBtn.classList.toggle('open', attachPanelOpen);
});

document.addEventListener('click', (e) => {
  if (!attachPanel.contains(e.target) && e.target !== plusBtn) closeAttachPanel();
});

function closeAttachPanel() {
  attachPanelOpen = false;
  attachPanel.classList.remove('open');
  plusBtn.classList.remove('open');
}

document.getElementById('opt-file').addEventListener('click',   () => { closeAttachPanel(); document.getElementById('file-input').click(); });
document.getElementById('opt-image').addEventListener('click',  () => { closeAttachPanel(); document.getElementById('image-input').click(); });
document.getElementById('opt-audio').addEventListener('click',  () => { closeAttachPanel(); document.getElementById('audio-input').click(); });
document.getElementById('opt-speak').addEventListener('click',  () => { closeAttachPanel(); toggleLiveSpeak(); });
document.getElementById('opt-record').addEventListener('click', () => { closeAttachPanel(); toggleRecording(); });


// ══════════════════════════════════════════════════════════════════════════════
// ATTACHMENT CHIPS
// ══════════════════════════════════════════════════════════════════════════════

function addAttachment(attachment) {
  attachment.id = String(Date.now() + Math.random());
  pendingAttachments.push(attachment);
  renderAttachmentsBar();
}

function renderAttachmentsBar() {
  if (!pendingAttachments.length) {
    attachBar.innerHTML = '';
    attachBar.classList.remove('has-items');
    return;
  }

  attachBar.classList.add('has-items');
  attachBar.innerHTML = pendingAttachments.map(a => {
    if (a.type === 'image') {
      return `<div class="attach-chip" data-id="${a.id}" onclick="previewAttachment('${a.id}')">
        <img class="chip-img-thumb" src="${a.dataUrl}" alt="${escapeHtml(a.name)}"/>
        <span class="chip-name">${escapeHtml(a.name)}</span>
        <button class="chip-remove" onclick="event.stopPropagation(); removeAttachment('${a.id}')">×</button>
      </div>`;
    }
    return `<div class="attach-chip" data-id="${a.id}" onclick="previewAttachment('${a.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <span class="chip-name">${escapeHtml(a.name)}</span>
      <button class="chip-remove" onclick="event.stopPropagation(); removeAttachment('${a.id}')">×</button>
    </div>`;
  }).join('');
}

window.removeAttachment = function (id) {
  pendingAttachments = pendingAttachments.filter(a => a.id !== id);
  renderAttachmentsBar();
};

// ── Attachment preview popup ──────────────────────────────────────────────────

const previewOverlay = document.getElementById('attach-preview-overlay');
const previewBody    = document.getElementById('attach-preview-body');
const previewBadge   = document.getElementById('attach-preview-badge');
const previewName    = document.getElementById('attach-preview-name');

const BADGE_LABELS = { image: 'Image', doc: 'Document', audio: 'Transcript' };

window.previewAttachment = function (id) {
  const att = pendingAttachments.find(a => a.id === id);
  if (!att) return;

  previewBadge.textContent = BADGE_LABELS[att.type] || att.type;
  previewName.textContent  = att.name;
  previewBody.innerHTML    = '';

  if (att.type === 'image' && att.dataUrl) {
    const img = document.createElement('img');
    img.src       = att.dataUrl;
    img.className = 'attach-preview-img';
    img.alt       = att.name;
    previewBody.appendChild(img);

  } else if ((att.type === 'doc' || att.type === 'audio') && att.text) {
    const PREVIEW_LIMIT = 3000;
    const text = att.text;

    const div = document.createElement('div');
    div.className   = 'attach-preview-text';
    div.textContent = text.length > PREVIEW_LIMIT
      ? text.slice(0, PREVIEW_LIMIT) + '\n\n…'
      : text;
    previewBody.appendChild(div);

    const meta = document.createElement('div');
    meta.className   = 'attach-preview-meta';
    const words = text.trim().split(/\s+/).length;
    meta.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} characters`;
    previewBody.appendChild(meta);

  } else {
    const empty = document.createElement('div');
    empty.className   = 'attach-preview-empty';
    empty.textContent = 'No preview available.';
    previewBody.appendChild(empty);
  }

  previewOverlay.classList.add('visible');
};

function closeAttachPreview() {
  previewOverlay.classList.remove('visible');
}

document.getElementById('attach-preview-close').addEventListener('click', closeAttachPreview);

previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) closeAttachPreview();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && previewOverlay.classList.contains('visible')) {
    closeAttachPreview();
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// INLINE STATUS
// ══════════════════════════════════════════════════════════════════════════════

function showInlineStatus(text, dotClass, onStop) {
  statusDot.className = `status-dot ${dotClass}`;
  statusText.textContent = text;
  statusStop.style.display = onStop ? '' : 'none';
  statusStop.onclick = onStop || null;
  inlineStatus.classList.add('visible');
}

function hideInlineStatus() {
  inlineStatus.classList.remove('visible');
  statusStop.style.display = '';
}


// ══════════════════════════════════════════════════════════════════════════════
// LIVE SPEAK
// ══════════════════════════════════════════════════════════════════════════════

function toggleLiveSpeak() {
  if (isListening) { speechRecognition?.stop(); return; }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addSystemMessage('Live speech requires Chrome or Edge.'); return; }

  speechRecognition = new SR();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  let finalText = notesEl.value;

  speechRecognition.onstart = () => {
    isListening = true;
    showInlineStatus('Listening — speak now', 'teal', () => speechRecognition.stop());
    document.getElementById('speak-label').textContent = 'Stop Listening';
  };

  speechRecognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t + ' ';
      else interim += t;
    }
    notesEl.value = finalText + interim;
    resizeTextarea();
  };

  speechRecognition.onerror = (e) => { addSystemMessage(`Microphone error: ${e.error}`); stopSpeech(); };
  speechRecognition.onend   = stopSpeech;
  speechRecognition.start();
}

function stopSpeech() {
  isListening = false;
  hideInlineStatus();
  document.getElementById('speak-label').textContent = 'Live Speak';
  notesEl.value = notesEl.value.trim();
}


// ══════════════════════════════════════════════════════════════════════════════
// RECORD & TRANSCRIBE
// ══════════════════════════════════════════════════════════════════════════════

function toggleRecording() {
  if (isRecording) { mediaRecorder?.stop(); return; }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        document.getElementById('record-label').textContent = 'Record Audio';
        isRecording = false;
        showInlineStatus('Transcribing…', 'teal', null);

        if (!getApiKey()) {
          hideInlineStatus();
          addSystemMessage('Please enter your Groq API key to transcribe.');
          return;
        }

        try {
          const blob       = new Blob(audioChunks, { type: 'audio/webm' });
          const transcript = await groqClient.transcribe(blob, 'recording.webm');
          const existing   = notesEl.value.trim();
          notesEl.value    = existing ? existing + '\n\n' + transcript : transcript;
          resizeTextarea();
        } catch (err) {
          addSystemMessage(`Transcription failed: ${err.message}`);
        } finally {
          hideInlineStatus();
        }
      };

      mediaRecorder.start();
      isRecording = true;
      document.getElementById('record-label').textContent = 'Stop Recording';
      showInlineStatus('Recording — click Stop when done', 'red', () => mediaRecorder?.stop());
    })
    .catch(() => addSystemMessage('Could not access microphone. Please allow microphone permission.'));
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

document.getElementById('file-input').addEventListener('change', async function () {
  if (this.files[0]) { await handleDocFile(this.files[0]); this.value = ''; }
});

document.getElementById('image-input').addEventListener('change', async function () {
  if (this.files[0]) { await handleImageFile(this.files[0]); this.value = ''; }
});

document.getElementById('audio-input').addEventListener('change', async function () {
  if (this.files[0]) { await handleAudioFileUpload(this.files[0]); this.value = ''; }
});

async function handleDocFile(file) {
  try {
    let text = '';
    if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const ct   = await page.getTextContent();
        text += ct.items.map(x => x.str).join(' ') + '\n\n';
      }
    } else {
      const buf    = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      text = result.value;
    }
    if (!text.trim()) { addSystemMessage('Could not extract text from this file.'); return; }
    addAttachment({ type: 'doc', name: file.name, text: text.trim() });
  } catch (err) {
    addSystemMessage(`Error reading file: ${err.message}`);
  }
}

async function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const format  = file.type.includes('png') ? 'PNG' : file.type.includes('gif') ? 'GIF' : 'JPEG';
    addAttachment({ type: 'image', name: file.name, dataUrl, format });
  };
  reader.readAsDataURL(file);
}

async function handleAudioFileUpload(file) {
  if (!getApiKey()) {
    addSystemMessage('Please enter your Groq API key in ⚙ settings to transcribe audio.');
    document.getElementById('settings-drawer').classList.add('open');
    return;
  }

  addSystemMessage(`Transcribing "${file.name}"…`);

  try {
    const transcript = await groqClient.transcribe(file, file.name);

    // Remove the "transcribing" system message and add chip instead
    const sysEls = chatInner.querySelectorAll('.system-wrap');
    sysEls[sysEls.length - 1]?.remove();
    chatDisplayMessages.pop();

    addAttachment({ type: 'audio', name: file.name, text: transcript });
  } catch (err) {
    addSystemMessage(`Transcription failed: ${err.message}`);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  if (++dragDepth === 1) { dragOverlay.classList.add('active'); inputWrapper.classList.add('drag-over'); }
});

document.addEventListener('dragleave', () => {
  if (--dragDepth === 0) { dragOverlay.classList.remove('active'); inputWrapper.classList.remove('drag-over'); }
});

document.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dragOverlay.classList.remove('active');
  inputWrapper.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (!file) return;

  if (file.type.startsWith('image/')) {
    await handleImageFile(file);
  } else if (file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac)$/i.test(file.name)) {
    await handleAudioFileUpload(file);
  } else {
    await handleDocFile(file);
  }
});
