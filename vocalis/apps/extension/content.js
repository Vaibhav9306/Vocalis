// Scribe Floating Command Bar - Full Featured Extension Content Script
(function () {
  const existingRoot = document.getElementById('scribe-floating-bar-root');
  if (existingRoot) {
    existingRoot.remove();
  }

  const WS_URL = 'ws://localhost:3001/api/sessions/live-stream';
  const API_URL = 'http://localhost:3001/api';

  let isStreaming = false;
  let micEnabled = true;
  let systemAudioEnabled = false;
  let isExpanded = false;
  let isMinimized = false;
  let isVisible = true;
  let activeTab = 'transcript';
  let seconds = 0;
  let timerInterval = null;

  let ws = null;
  let micStream = null;
  let systemStream = null;
  let micTrackReader = null;
  let sysTrackReader = null;
  let audioContext = null;
  let workletNode = null;

  let chunks = [];
  let interimText = '';
  let latestAnalysis = { keyPoints: [], decisions: [], actionItems: [] };
  let copilotQAs = [];
  let currentAskQuery = '';

  // Draggable Coordinates State
  let posX = null;
  let posY = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let hasMovedDuringDrag = false;

  try {
    const saved = localStorage.getItem('scribe_ext_widget_pos');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const maxX = Math.max(10, window.innerWidth - 300);
        const maxY = Math.max(10, window.innerHeight - 60);
        if (parsed.x >= 10 && parsed.x <= maxX && parsed.y >= 10 && parsed.y <= maxY) {
          posX = parsed.x;
          posY = parsed.y;
        }
      }
    }
  } catch {}

  // Downsample Float32Array to 16kHz Mono 16-bit PCM
  function downsampleTo16k(input, inputSampleRate) {
    if (inputSampleRate === 16000) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }
    const ratio = inputSampleRate / 16000;
    const newLength = Math.floor(input.length / ratio);
    const output = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const offset = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, input[offset]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  // Inject Root Container
  const root = document.createElement('div');
  root.id = 'scribe-floating-bar-root';
  applyRootPosition();
  (document.body || document.documentElement).appendChild(root);

  function applyRootPosition() {
    if (!isVisible) {
      root.style.left = 'auto';
      root.style.top = 'auto';
      root.style.bottom = 'auto';
      root.style.transform = 'none';
      return;
    }

    if (posX !== null && posY !== null) {
      const currentWidth = root.offsetWidth || 480;
      const currentHeight = root.offsetHeight || 48;
      const clampedX = Math.max(10, Math.min(window.innerWidth - currentWidth - 10, posX));
      const clampedY = Math.max(10, Math.min(window.innerHeight - currentHeight - 10, posY));

      root.style.left = `${clampedX}px`;
      root.style.top = `${clampedY}px`;
      root.style.bottom = 'auto';
      root.style.transform = 'none';
    } else {
      root.style.left = '50%';
      root.style.bottom = '24px';
      root.style.top = 'auto';
      root.style.transform = 'translateX(-50%)';
    }
  }

  window.addEventListener('resize', () => {
    applyRootPosition();
  });

  // Extension action click message listener
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.action === 'toggle_scribe_bar') {
          isVisible = !isVisible;
          if (isVisible) isMinimized = false;
          render();
          sendResponse({ visible: isVisible });
        }
      });
    }
  } catch {}

  function updateTimerText() {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    const timerStr = `${mins}:${secs}`;
    const tEl = document.getElementById('scribe-timer-val');
    if (tEl) {
      tEl.textContent = isStreaming ? timerStr : 'Scribe';
      tEl.style.color = isStreaming ? '#dc2626' : '#1a1917';
    }
    const minTEl = document.getElementById('scribe-min-timer-val');
    if (minTEl) minTEl.textContent = isStreaming ? timerStr : 'Scribe';
  }

  function getTickerText() {
    const latestChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null;
    const speakerPrefix = latestChunk?.speakerName ? `[${latestChunk.speakerName}]: ` : '';
    return interimText || (latestChunk ? `${speakerPrefix}${latestChunk.text}` : (isStreaming ? 'Listening to conversation...' : 'Ready to transcribe meeting'));
  }

  function updateTicker() {
    const tickerEl = document.getElementById('scribe-injected-ticker-text');
    if (tickerEl) {
      const text = getTickerText();
      tickerEl.textContent = `💬 ${text}`;
      tickerEl.title = text;
    }
  }

  function updateRecordingStateUI() {
    const recordBtn = document.querySelector('[data-action="record"]');
    if (recordBtn) {
      recordBtn.textContent = isStreaming ? '■ End' : '▶ Record';
      recordBtn.className = `scribe-injected-btn ${isStreaming ? 'scribe-injected-btn-danger' : 'scribe-injected-btn-primary'}`;
    }
    const pulseDots = document.querySelectorAll('.scribe-pulse-dot');
    pulseDots.forEach(dot => {
      if (isStreaming) {
        dot.classList.add('recording');
      } else {
        dot.classList.remove('recording');
      }
    });
    updateTimerText();
  }

  function updateTabBtnBadges() {
    const tabTransBtn = document.querySelector('[data-action="tab-transcript"]');
    if (tabTransBtn) {
      tabTransBtn.textContent = `Transcript (${chunks.length})`;
      if (activeTab === 'transcript') tabTransBtn.classList.add('active');
      else tabTransBtn.classList.remove('active');
    }
    const tabCopilotBtn = document.querySelector('[data-action="tab-copilot"]');
    if (tabCopilotBtn) {
      if (activeTab === 'copilot') tabCopilotBtn.classList.add('active');
      else tabCopilotBtn.classList.remove('active');
    }
    const tabActionsBtn = document.querySelector('[data-action="tab-actions"]');
    if (tabActionsBtn) {
      tabActionsBtn.textContent = `✓ Actions (${(latestAnalysis.actionItems || []).length})`;
      if (activeTab === 'actions') tabActionsBtn.classList.add('active');
      else tabActionsBtn.classList.remove('active');
    }
  }

  function renderDrawerBodyContent() {
    const drawerBody = document.getElementById('scribe-drawer-body');
    if (!drawerBody) return;

    if (activeTab === 'transcript') {
      if (chunks.length === 0 && !interimText) {
        drawerBody.innerHTML = `
          <div style="color:#8c877d;text-align:center;padding:14px 0;">
            ${isStreaming ? 'Listening for speech in meeting tab...' : 'Click Record to start live speech transcription.'}
          </div>
        `;
      } else {
        const transcriptHtml = chunks.map(c => {
          const isSpeaker1 = !c.speakerName || c.speakerName.includes('Speaker 1') || c.speakerName.includes('You');
          const badgeClass = isSpeaker1 ? 'scribe-speaker-1' : 'scribe-speaker-2';
          const speakerLabel = c.speakerName || 'Speaker 1 (You)';
          return `
            <div style="border-bottom:1px solid rgba(0,0,0,0.06);padding-bottom:5px;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px;">
              <span class="scribe-speaker-badge ${badgeClass}">${speakerLabel}</span>
              <span style="font-family:monospace;font-size:11px;color:#8c877d;margin-right:4px;">${c.timestamp || '00:00'}</span>
              <span style="color:#1a1917;">${c.text}</span>
            </div>
          `;
        }).join('');

        const liveHtml = interimText ? `
          <div style="color:#8c877d;font-style:italic;display:flex;align-items:baseline;gap:4px;">
            <span class="scribe-speaker-badge scribe-speaker-1">Live</span>
            <span>${interimText}</span>
          </div>
        ` : '';

        drawerBody.innerHTML = transcriptHtml + liveHtml;
      }
      drawerBody.scrollTop = drawerBody.scrollHeight;
    } else if (activeTab === 'copilot') {
      let html = '';
      if (latestAnalysis.keyPoints && latestAnalysis.keyPoints.length > 0) {
        html += `
          <div style="background:#ffffff;padding:8px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);">
            <strong style="font-size:11px;text-transform:uppercase;color:#8c877d;">Key Discussion Points</strong>
            <ul style="margin:4px 0 0 16px;padding:0;">
              ${latestAnalysis.keyPoints.map(kp => `<li style="margin-top:3px;">${kp}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      if (copilotQAs.length > 0) {
        html += copilotQAs.map(qa => `
          <div style="background:#ffffff;padding:8px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.12);margin-top:6px;">
            <strong style="font-size:12px;color:#1a1917;">Q: ${qa.q}</strong>
            <div style="color:#4a4843;margin-top:3px;font-size:12px;">${qa.a}</div>
          </div>
        `).join('');
      }
      if (!html) {
        html = `
          <div style="color:#8c877d;text-align:center;padding:14px 0;">
            AI insights and key discussion points will appear as the conversation develops.
          </div>
        `;
      }
      drawerBody.innerHTML = html;
    } else if (activeTab === 'actions') {
      let html = '';
      if (latestAnalysis.decisions && latestAnalysis.decisions.length > 0) {
        html += `
          <div>
            <strong style="font-size:11px;color:#16a34a;text-transform:uppercase;">✓ Agreed Decisions</strong>
            ${latestAnalysis.decisions.map(d => `<div style="font-size:12px;margin-top:3px;">• ${d}</div>`).join('')}
          </div>
        `;
      }
      if (latestAnalysis.actionItems && latestAnalysis.actionItems.length > 0) {
        html += `
          <div style="margin-top:6px;">
            <strong style="font-size:11px;color:#d97706;text-transform:uppercase;">📋 Action Items</strong>
            ${latestAnalysis.actionItems.map(a => `<div style="font-size:12px;margin-top:3px;">- [ ] <strong>${a.task}</strong> ${a.owner ? `(${a.owner})` : ''}</div>`).join('')}
          </div>
        `;
      }
      if (!html) {
        html = `
          <div style="color:#8c877d;text-align:center;padding:14px 0;">
            No action items or decisions detected yet.
          </div>
        `;
      }
      drawerBody.innerHTML = html;
    }
  }

  function render() {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    const timerStr = `${mins}:${secs}`;
    const tickerText = getTickerText();

    // 1. If Hidden/Dismissed: Render discrete reopen launcher pill
    if (!isVisible) {
      root.innerHTML = `
        <div class="scribe-reopen-pill" data-action="reopen" title="Click to open Scribe Meeting Copilot">
          <span class="scribe-pulse-dot ${isStreaming ? 'recording' : ''}"></span>
          <span>${isStreaming ? `● ${timerStr}` : '🎙️ Scribe'}</span>
        </div>
      `;
      applyRootPosition();
      return;
    }

    // 2. If Minimized: Render compact floating bubble
    if (isMinimized) {
      root.innerHTML = `
        <div class="scribe-minimized-bubble" data-action="restore" title="Click to expand Scribe Command Bar">
          <span class="scribe-pulse-dot ${isStreaming ? 'recording' : ''}"></span>
          <span id="scribe-min-timer-val" style="font-size:12px;font-weight:700;font-family:monospace;color:${isStreaming ? '#dc2626' : '#1a1917'};">${isStreaming ? timerStr : 'Scribe'}</span>
          <span style="font-size:11px;color:#8c877d;margin-left:2px;">▲ Expand</span>
        </div>
      `;
      applyRootPosition();
      return;
    }

    // 3. Main Command Bar (and optional expanded drawer)
    // Preserve input if existing
    const existingInput = document.getElementById('scribe-ask-input');
    if (existingInput) {
      currentAskQuery = existingInput.value;
    }

    root.innerHTML = `
      ${isExpanded ? `
        <div class="scribe-injected-drawer" id="scribe-drawer">
          <!-- Drawer Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.1);">
            <div style="display:flex;gap:6px;">
              <button class="scribe-injected-btn ${activeTab === 'transcript' ? 'active' : ''}" data-action="tab-transcript" style="height:26px;font-size:11px;">
                Transcript (${chunks.length})
              </button>
              <button class="scribe-injected-btn ${activeTab === 'copilot' ? 'active' : ''}" data-action="tab-copilot" style="height:26px;font-size:11px;">
                ✨ AI Copilot
              </button>
              <button class="scribe-injected-btn ${activeTab === 'actions' ? 'active' : ''}" data-action="tab-actions" style="height:26px;font-size:11px;">
                ✓ Actions (${(latestAnalysis.actionItems || []).length})
              </button>
            </div>
            <button data-action="drawer-close" style="background:none;border:none;cursor:pointer;font-size:14px;color:#8c877d;padding:2px 6px;">✕</button>
          </div>

          <!-- Drawer Body -->
          <div id="scribe-drawer-body" style="padding:12px 14px;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.45;">
          </div>

          <!-- Drawer Ask Query Form -->
          <form id="scribe-ask-form" style="display:flex;padding:6px 10px;border-top:1px solid rgba(0,0,0,0.1);gap:6px;background:#ffffff;">
            <input type="text" id="scribe-ask-input" value="${currentAskQuery.replace(/"/g, '&quot;')}" placeholder="Ask Copilot during meeting..." style="flex:1;font-size:12px;padding:6px 8px;border:1px solid rgba(0,0,0,0.15);border-radius:6px;outline:none;" />
            <button type="submit" class="scribe-injected-btn active" style="height:28px;">Ask</button>
          </form>
        </div>
      ` : ''}

      <!-- Main Horizontal Command Pill -->
      <div class="scribe-injected-bar" id="scribe-drag-handle">
        <div data-action="insights" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <span class="scribe-pulse-dot ${isStreaming ? 'recording' : ''}"></span>
          <span id="scribe-timer-val" style="font-size:12px;font-weight:700;font-family:monospace;color:${isStreaming ? '#dc2626' : '#1a1917'};">
            ${isStreaming ? timerStr : 'Scribe'}
          </span>
        </div>

        <span style="width:1px;height:16px;background:rgba(0,0,0,0.12);"></span>

        <div class="scribe-injected-ticker" data-action="insights" title="${tickerText}" id="scribe-injected-ticker-text">
          💬 ${tickerText}
        </div>

        <div style="display:flex;align-items:center;gap:4px;">
          <button class="scribe-injected-btn ${micEnabled ? '' : 'scribe-injected-btn-danger'}" data-action="mic" title="Toggle Microphone">
            ${micEnabled ? '🎙️' : '🔇'}
          </button>
          <button class="scribe-injected-btn ${systemAudioEnabled ? 'active' : ''}" data-action="tab" title="Capture Meeting Tab Audio (Google Meet / Zoom)">
            ${systemAudioEnabled ? '🔊 Tab' : '🔈 +Tab'}
          </button>
          <button class="scribe-injected-btn ${isExpanded ? 'active' : ''}" data-action="insights">
            ${isExpanded ? '▼' : '▲ Insights'}
          </button>
          <button class="scribe-injected-btn ${isStreaming ? 'scribe-injected-btn-danger' : 'scribe-injected-btn-primary'}" data-action="record">
            ${isStreaming ? '■ End' : '▶ Record'}
          </button>

          <!-- Minimize Button (SVG Dash) -->
          <button class="scribe-injected-btn-icon" data-action="minimize" title="Minimize bar" id="scribe-btn-min">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8z"/>
            </svg>
          </button>

          <!-- Close / Dismiss Button (SVG Cross) -->
          <button class="scribe-injected-btn-icon" data-action="close" title="Dismiss bar (click floating badge or extension icon to restore)" id="scribe-btn-close">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    applyRootPosition();

    if (isExpanded) {
      renderDrawerBodyContent();
    }
  }

  // Preserve typed text in currentAskQuery continuously
  root.addEventListener('input', (e) => {
    if (e.target.id === 'scribe-ask-input') {
      currentAskQuery = e.target.value;
    }
  });

  // Unified Action Handler
  function handleAction(action) {
    if (!action) return;
    if (action === 'record') {
      toggleRecording();
    } else if (action === 'mic') {
      toggleMic();
    } else if (action === 'tab') {
      toggleTabAudio();
    } else if (action === 'insights') {
      isExpanded = !isExpanded;
      render();
    } else if (action === 'drawer-close') {
      isExpanded = false;
      render();
    } else if (action === 'minimize') {
      isMinimized = true;
      isExpanded = false;
      isVisible = true;
      render();
    } else if (action === 'restore') {
      isMinimized = false;
      isVisible = true;
      render();
    } else if (action === 'close') {
      isVisible = false;
      isExpanded = false;
      render();
    } else if (action === 'reopen') {
      isVisible = true;
      isMinimized = false;
      render();
    } else if (action === 'tab-transcript') {
      activeTab = 'transcript';
      updateTabBtnBadges();
      renderDrawerBodyContent();
    } else if (action === 'tab-copilot') {
      activeTab = 'copilot';
      updateTabBtnBadges();
      renderDrawerBodyContent();
    } else if (action === 'tab-actions') {
      activeTab = 'actions';
      updateTabBtnBadges();
      renderDrawerBodyContent();
    }
  }

  // Unified Event Delegation on Root
  root.addEventListener('click', (e) => {
    if (hasMovedDuringDrag) {
      hasMovedDuringDrag = false;
      return;
    }
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    e.stopPropagation();
    e.preventDefault();
    const action = actionEl.getAttribute('data-action');
    handleAction(action);
  });

  // Form Submission
  root.addEventListener('submit', async (e) => {
    if (e.target.id === 'scribe-ask-form') {
      e.preventDefault();
      const input = document.getElementById('scribe-ask-input');
      if (!input || !input.value.trim()) return;
      const q = input.value.trim();
      currentAskQuery = '';
      input.value = '';
      try {
        const res = await fetch(`${API_URL}/ai/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        copilotQAs.push({ q, a: data.answer || 'No specific answer found.' });
        activeTab = 'copilot';
        updateTabBtnBadges();
        renderDrawerBodyContent();
      } catch (err) {
        copilotQAs.push({ q, a: 'Failed to reach AI assistant. Ensure Scribe backend is running.' });
        activeTab = 'copilot';
        updateTabBtnBadges();
        renderDrawerBodyContent();
      }
    }
  });

  // Dragging Listeners
  root.addEventListener('mousedown', (e) => {
    const dragHandle = e.target.closest('#scribe-drag-handle, .scribe-minimized-bubble');
    if (!dragHandle) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('form') || e.target.closest('.scribe-reopen-pill')) return;

    isDragging = true;
    hasMovedDuringDrag = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = root.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const dx = moveEvent.clientX - dragStartX;
      const dy = moveEvent.clientY - dragStartY;

      if (Math.hypot(dx, dy) > 4) {
        hasMovedDuringDrag = true;
      }

      const currentWidth = root.offsetWidth || 480;
      const currentHeight = root.offsetHeight || 48;

      posX = Math.max(10, Math.min(window.innerWidth - currentWidth - 10, initialLeft + dx));
      posY = Math.max(10, Math.min(window.innerHeight - currentHeight - 10, initialTop + dy));

      applyRootPosition();
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (hasMovedDuringDrag && posX !== null && posY !== null) {
        try {
          localStorage.setItem('scribe_ext_widget_pos', JSON.stringify({ x: posX, y: posY }));
        } catch {}
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // Track Audio Processor (Native W3C WebCodecs - bypasses all CSP script restrictions & eliminates ScriptProcessorNode)
  async function startTrackAudioReader(track, isMic = true) {
    if (typeof MediaStreamTrackProcessor !== 'undefined') {
      try {
        const trackProcessor = new MediaStreamTrackProcessor({ track });
        const reader = trackProcessor.readable.getReader();
        if (isMic) micTrackReader = reader;
        else sysTrackReader = reader;

        while (isStreaming) {
          const { done, value } = await reader.read();
          if (done || !value) break;

          const numberOfFrames = value.numberOfFrames;
          const sampleRate = value.sampleRate;
          const f32 = new Float32Array(numberOfFrames);
          value.copyTo(f32, { planeIndex: 0 });
          value.close();

          if (isStreaming && ws && ws.readyState === WebSocket.OPEN) {
            if (isMic && !micEnabled) continue;
            const pcm16 = downsampleTo16k(f32, sampleRate);
            ws.send(pcm16.buffer);
          }
        }
        return true;
      } catch (e) {
        console.warn('Track processor note:', e);
      }
    }
    return false;
  }

  async function toggleRecording() {
    if (!isStreaming) {
      try {
        // 1. Microphone
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micEnabled = true;

        // 2. Connect WebSocket using EXACT backend protocol
        ws = new WebSocket(WS_URL);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          // Send start action recognized by backend liveMeetingWs.ts
          ws.send(JSON.stringify({ action: 'start', title: `Meeting in ${document.title || 'Tab'}` }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'interim_transcript') {
              if (msg.interimText) {
                interimText = msg.interimText;
                updateTicker();
                if (isExpanded && activeTab === 'transcript') {
                  renderDrawerBodyContent();
                }
              }
            } else if (msg.type === 'final_transcript') {
              interimText = '';
              if (msg.chunk) {
                // Deduplicate if already present
                const exists = chunks.some(c => c.text === msg.chunk.text && Math.abs((c.sequenceNumber || 0) - (msg.chunk.sequenceNumber || 0)) < 2);
                if (!exists) {
                  chunks.push(msg.chunk);
                }
              }
              if (msg.latestAnalysis) {
                latestAnalysis = msg.latestAnalysis;
              }
              updateTicker();
              updateTabBtnBadges();
              if (isExpanded) {
                renderDrawerBodyContent();
              }
            } else if (msg.type === 'analysis_update') {
              if (msg.latestAnalysis) {
                latestAnalysis = msg.latestAnalysis;
                updateTabBtnBadges();
                if (isExpanded && (activeTab === 'copilot' || activeTab === 'actions')) {
                  renderDrawerBodyContent();
                }
              }
            } else if (msg.type === 'session_completed') {
              if (msg.session?.latestAnalysis) {
                latestAnalysis = msg.session.latestAnalysis;
              }
              updateTabBtnBadges();
              if (isExpanded) {
                renderDrawerBodyContent();
              }
            }
          } catch {}
        };

        isStreaming = true;
        seconds = 0;
        timerInterval = setInterval(() => {
          seconds++;
          updateTimerText();
        }, 1000);

        // 3. Start audio stream processing
        const micTrack = micStream.getAudioTracks()[0];
        if (micTrack) {
          startTrackAudioReader(micTrack, true);
        }

        if (systemStream && systemStream.getAudioTracks().length > 0) {
          startTrackAudioReader(systemStream.getAudioTracks()[0], false);
        }

        updateRecordingStateUI();
        updateTicker();
      } catch (err) {
        console.warn('Could not access microphone directly:', err);
        isStreaming = true;
        seconds = 0;
        timerInterval = setInterval(() => {
          seconds++;
          updateTimerText();
        }, 1000);
        updateRecordingStateUI();
        updateTicker();
      }
    } else {
      // Stop Recording
      isStreaming = false;
      if (timerInterval) clearInterval(timerInterval);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'stop' }));
        setTimeout(() => ws.close(), 500);
      }

      if (micTrackReader) {
        try { micTrackReader.cancel(); } catch {}
        micTrackReader = null;
      }
      if (sysTrackReader) {
        try { sysTrackReader.cancel(); } catch {}
        sysTrackReader = null;
      }

      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (systemStream) {
        systemStream.getTracks().forEach(t => t.stop());
        systemStream = null;
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      interimText = '';
      systemAudioEnabled = false;
      updateRecordingStateUI();
      updateTicker();
      if (isExpanded) {
        renderDrawerBodyContent();
      }
    }
  }

  function toggleMic() {
    micEnabled = !micEnabled;
    if (micStream) {
      micStream.getAudioTracks().forEach(t => { t.enabled = micEnabled; });
    }
    const micBtn = document.querySelector('[data-action="mic"]');
    if (micBtn) {
      micBtn.textContent = micEnabled ? '🎙️' : '🔇';
      micBtn.className = `scribe-injected-btn ${micEnabled ? '' : 'scribe-injected-btn-danger'}`;
    }
  }

  async function toggleTabAudio() {
    if (systemAudioEnabled && systemStream) {
      if (sysTrackReader) {
        try { sysTrackReader.cancel(); } catch {}
        sysTrackReader = null;
      }
      systemStream.getTracks().forEach(t => t.stop());
      systemStream = null;
      systemAudioEnabled = false;
      const tabBtn = document.querySelector('[data-action="tab"]');
      if (tabBtn) {
        tabBtn.textContent = '🔈 +Tab';
        tabBtn.classList.remove('active');
      }
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach(t => t.stop());
        alert('No audio track shared. When selecting the tab, ensure "Also share tab audio" is enabled.');
        return;
      }
      displayStream.getVideoTracks().forEach(t => t.stop());

      systemStream = displayStream;
      systemAudioEnabled = true;

      if (isStreaming && audioTracks[0]) {
        startTrackAudioReader(audioTracks[0], false);
      }

      const tabBtn = document.querySelector('[data-action="tab"]');
      if (tabBtn) {
        tabBtn.textContent = '🔊 Tab';
        tabBtn.classList.add('active');
      }
    } catch (err) {
      // User cancelled picker
    }
  }

  render();
})();
