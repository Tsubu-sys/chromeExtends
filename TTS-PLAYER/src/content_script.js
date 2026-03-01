// content_script.js

// CSS inside Shadow DOM
const cssStyles = `
  #smart-tts-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 44px;
    background: rgba(20, 20, 20, 0.92);
    color: white;
    border-radius: 10px;
    padding: 6px 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    z-index: 2147483647;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: opacity 0.3s ease, transform 0.3s ease;
    user-select: none;
  }
  #smart-tts-container.hidden {
    opacity: 0;
    transform: translateY(20px);
    pointer-events: none;
  }
  /* Expanded panel (clips from clipboard) */
  #clip-panel {
    display: none;
    flex-direction: column;
    gap: 6px;
    width: 280px;
    background: rgba(20, 20, 20, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 10px;
    position: absolute;
    bottom: 0;
    right: 48px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
  #clip-panel.visible {
    display: flex;
  }
  .panel-title {
    font-size: 11px;
    color: #4A90E2;
    font-weight: bold;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 5px;
    margin-bottom: 2px;
  }
  .text-display {
    font-size: 13px;
    line-height: 1.5;
    min-height: 60px;
    max-height: 180px;
    overflow-y: auto;
    word-break: break-word;
    color: #ddd;
    padding-right: 4px;
  }
  .text-display::-webkit-scrollbar { width: 4px; }
  .text-display::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
  .text-display::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 4px; }
  /* Drag handle */
  .drag-handle {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: rgba(255,255,255,0.35);
    font-size: 13px;
    letter-spacing: -1px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
    margin-bottom: 2px;
    transform: rotate(90deg);
  }
  .drag-handle:hover {
    color: rgba(255,255,255,0.7);
    background: rgba(255,255,255,0.08);
  }
  .drag-handle:active { cursor: grabbing; }
  /* Bar buttons */
  .bar-btn {
    background: rgba(255,255,255,0.07);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    padding: 0;
    flex-shrink: 0;
  }
  .bar-btn:hover { background: rgba(255,255,255,0.18); }
  .bar-btn.primary { background: #4A90E2; }
  .bar-btn.primary:hover { background: #357ABD; }
  .bar-btn.danger { background: #C0021A; }
  .bar-btn.danger:hover { background: #960014; }
  .bar-btn.active { background: #4A90E2; }
  .bar-btn.clip-active { background: #2ECC71; }
  .bar-btn.clip-active:hover { background: #27AE60; }
  /* Divider */
  .divider {
    width: 28px;
    height: 1px;
    background: rgba(255,255,255,0.1);
    border-radius: 1px;
    margin: 1px 0;
  }
  .error-text {
    color: #FF6B6B;
    font-size: 12px;
  }
  .highlight-chunk {
    background-color: rgba(74, 144, 226, 0.45);
    border-radius: 2px;
    padding: 0 2px;
  }
  /* Speed panel */
  #speed-panel {
    display: none;
    flex-direction: column;
    gap: 8px;
    width: 200px;
    background: rgba(20, 20, 20, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 10px 12px;
    position: absolute;
    bottom: 0;
    right: 48px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
  #speed-panel.visible { display: flex; }
  .speed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .speed-title {
    font-size: 11px;
    color: #4A90E2;
    font-weight: bold;
  }
  .speed-label {
    font-size: 13px;
    font-weight: bold;
    color: white;
    min-width: 36px;
    text-align: right;
  }
  .speed-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.15);
    outline: none;
    cursor: pointer;
  }
  .speed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4A90E2;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .speed-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: rgba(255,255,255,0.4);
    margin-top: -4px;
  }
  .bar-btn.speed-active { background: #F39C12; }
  .bar-btn.speed-active:hover { background: #D68910; }
  .speed-bar-label {
    font-size: 9px;
    color: rgba(255,255,255,0.55);
    text-align: center;
    line-height: 1;
    margin-top: -2px;
    margin-bottom: 2px;
    letter-spacing: -0.3px;
  }
`;

// Inject global highlight style to the document head
const globalHighlightStyle = document.createElement('style');
globalHighlightStyle.textContent = `
  ::highlight(tts-reading) {
    background-color: rgba(74, 144, 226, 0.4);
    color: inherit;
  }
`;
if (!document.head.querySelector('#tts-global-highlight')) {
  globalHighlightStyle.id = 'tts-global-highlight';
  document.head.appendChild(globalHighlightStyle);
}

class SmartTTSUI {
  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'smart-tts-host';
    if (document.body) {
      document.body.appendChild(this.host);
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        if (document.body && !document.body.contains(this.host)) {
          document.body.appendChild(this.host);
        }
      });
    }

    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.state = 'STOPPED'; // PLAYING, PAUSED, STOPPED
    this.isClickToRead = false;
    this.isClipMode = false; // whether clipboard panel is open
    this.highlightRanges = [];
    this._handleDocClick = this.handleDocClick.bind(this);
    this.currentDocText = '';

    this.render();
    this.setupListeners();
  }

  render() {
    const style = document.createElement('style');
    style.textContent = cssStyles;
    this.shadow.appendChild(style);

    const container = document.createElement('div');
    container.id = 'smart-tts-container';
    container.innerHTML = `
      <!-- Clipboard expanded panel (shown only in clip mode) -->
      <div id="clip-panel">
        <div class="panel-title">📋 クリップボード</div>
        <div class="text-display" id="text-display">クリップボードから読み上げ中...</div>
      </div>

      <!-- Speed panel -->
      <div id="speed-panel">
        <div class="speed-header">
          <span class="speed-title">⚡ 読み上げ速度</span>
          <span class="speed-label" id="speed-label">×1.0</span>
        </div>
        <input class="speed-slider" id="speed-slider" type="range" min="0.5" max="2.0" step="0.1" value="1.0">
        <div class="speed-ticks">
          <span>×0.5</span><span>×1.0</span><span>×1.5</span><span>×2.0</span>
        </div>
      </div>

      <!-- Drag handle -->
      <div class="drag-handle" id="drag-handle" title="ドラッグで移動">⠿</div>
      <!-- Vertical bar buttons -->
      <button class="bar-btn" id="click-to-read-btn" title="画面内選択モード">👆</button>
      <button class="bar-btn" id="clip-btn" title="クリップボードから読み上げ">📋</button>
      <button class="bar-btn" id="speed-btn" title="読み上げ速度">⚡</button>
      <div class="speed-bar-label" id="speed-bar-label">×1.0</div>
      <div class="divider"></div>
      <button class="bar-btn" id="prev-btn" title="前へ">⏮</button>
      <button class="bar-btn primary" id="play-pause-btn" title="再生/一時停止">▶</button>
      <button class="bar-btn" id="next-btn" title="次へ">⏭</button>
      <button class="bar-btn danger" id="stop-btn" title="停止">⏹</button>
    `;
    this.shadow.appendChild(container);

    this.elems = {
      container: container,
      dragHandle: container.querySelector('#drag-handle'),
      clipPanel: container.querySelector('#clip-panel'),
      textDisplay: container.querySelector('#text-display'),
      speedPanel: container.querySelector('#speed-panel'),
      speedSlider: container.querySelector('#speed-slider'),
      speedLabel: container.querySelector('#speed-label'),
      prevBtn: container.querySelector('#prev-btn'),
      playPauseBtn: container.querySelector('#play-pause-btn'),
      nextBtn: container.querySelector('#next-btn'),
      stopBtn: container.querySelector('#stop-btn'),
      clipBtn: container.querySelector('#clip-btn'),
      speedBtn: container.querySelector('#speed-btn'),
      speedBarLabel: container.querySelector('#speed-bar-label'),
      clickToReadBtn: container.querySelector('#click-to-read-btn'),
    };

    // Make the bar draggable via the handle
    this._setupDrag(container, container.querySelector('#drag-handle'));

    this.hide();
  }

  _setupDrag(container, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      container.style.left = rect.left + 'px';
      container.style.top = rect.top + 'px';
      container.style.bottom = 'auto';
      container.style.right = 'auto';
      container.style.transition = 'none';
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      container.style.left = (initialLeft + e.clientX - startX) + 'px';
      container.style.top = (initialTop + e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      }
    });
  }

  setupListeners() {
    const { prevBtn, playPauseBtn, nextBtn, stopBtn, clipBtn, clickToReadBtn, speedBtn, speedSlider, speedLabel } = this.elems;

    // Click-to-read toggle
    clickToReadBtn.addEventListener('click', () => {
      this.isClickToRead = !this.isClickToRead;
      if (this.isClickToRead) {
        clickToReadBtn.classList.add('active');
        document.addEventListener('click', this._handleDocClick, true);
      } else {
        clickToReadBtn.classList.remove('active');
        document.removeEventListener('click', this._handleDocClick, true);
      }
    });

    // Clipboard button — read clipboard and expand panel
    clipBtn.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          throw new Error('Clipboard API not supported.');
        }
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          this._showClipPanel();
          this.showError('クリップボードが空です。');
          return;
        }
        this._showClipPanel();
        this._hideSpeedPanel();
        chrome.runtime.sendMessage({ type: 'COMMAND_PLAY_DIRECT', text: text });
      } catch (err) {
        console.error('Clipboard sync error:', err);
        this._showClipPanel();
        this.showError('クリップボードの取得に失敗しました。(HTTPS/フォーカスが必要)');
      }
    });

    // Speed button toggle
    speedBtn.addEventListener('click', () => {
      if (this.elems.speedPanel.classList.contains('visible')) {
        this._hideSpeedPanel();
      } else {
        this._hideClipPanel();
        this._showSpeedPanel();
      }
    });

    // Speed slider input
    speedSlider.addEventListener('input', () => {
      const rate = parseFloat(speedSlider.value);
      speedLabel.textContent = `×${rate.toFixed(1)}`;
      this.elems.speedBarLabel.textContent = `×${rate.toFixed(1)}`;
      chrome.runtime.sendMessage({ type: 'COMMAND_SET_RATE', rate: rate });
    });

    prevBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'COMMAND_PREV' }));
    nextBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'COMMAND_NEXT' }));

    playPauseBtn.addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        chrome.runtime.sendMessage({ type: 'COMMAND_PAUSE' });
      } else {
        const rawText = this.currentDocText || this.elems.textDisplay.innerText;
        chrome.runtime.sendMessage({ type: 'COMMAND_RESUME', fallbackText: rawText });
      }
    });

    stopBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'COMMAND_STOP' });
      this._hideClipPanel();
    });
  }

  _showClipPanel() {
    this.isClipMode = true;
    this.elems.clipPanel.classList.add('visible');
    this.elems.clipBtn.classList.add('clip-active');
  }

  _hideClipPanel() {
    this.isClipMode = false;
    this.elems.clipPanel.classList.remove('visible');
    this.elems.clipBtn.classList.remove('clip-active');
  }

  _showSpeedPanel() {
    this.elems.speedPanel.classList.add('visible');
    this.elems.speedBtn.classList.add('speed-active');
  }

  _hideSpeedPanel() {
    this.elems.speedPanel.classList.remove('visible');
    this.elems.speedBtn.classList.remove('speed-active');
  }

  updateState(state) {
    this.state = state;
    const { playPauseBtn } = this.elems;

    if (state === 'PLAYING') {
      playPauseBtn.textContent = '⏸';
    } else if (state === 'PAUSED') {
      playPauseBtn.textContent = '▶';
    } else if (state === 'STOPPED') {
      playPauseBtn.textContent = '▶';
      this.clearHighlight();
    }
  }

  // 画面内選択モードの処理
  handleDocClick(e) {
    if (!this.isClickToRead) return;
    if (e.composedPath().includes(this.host)) return;

    e.preventDefault();
    e.stopPropagation();

    let target = e.target;
    while (target && target !== document.body && !target.innerText?.trim()) {
      target = target.parentElement;
    }

    if (target && target.innerText) {
      let collectedText = target.innerText.trim();

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG'].includes(node.tagName)) return NodeFilter.FILTER_REJECT;
            if (node.innerText && node.innerText.trim().length > 0) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      walker.currentNode = target;
      let blocksCollected = 0;
      let nextNode;
      while ((nextNode = walker.nextNode()) && blocksCollected < 15) {
        if (target.contains(nextNode)) continue;
        const text = nextNode.innerText.trim();
        if (text && !collectedText.includes(text) && !text.includes(collectedText)) {
          collectedText += "\n\n" + text;
          blocksCollected++;
        }
      }

      this.currentDocText = collectedText;
      this._hideClipPanel();
      chrome.runtime.sendMessage({ type: 'COMMAND_PLAY_DIRECT', text: this.currentDocText });
      this.clearHighlight();
    }
  }

  // 画面内選択モードのハイライト処理
  highlightTextOnPage(searchText) {
    this.clearHighlight();
    if (!searchText || !searchText.trim() || !CSS.highlights) return;

    // Remove all whitespace from search target
    const searchTarget = searchText.replace(/\s+/g, '').toLowerCase();
    if (!searchTarget) return;

    // Collect all valid text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      nodes.push(n);
    }

    // Build a flat map of all non-whitespace characters in the document
    const charMap = [];
    for (const node of nodes) {
      const text = node.nodeValue.toLowerCase();
      for (let i = 0; i < text.length; i++) {
        if (!/\s/.test(text[i])) {
          charMap.push({ node, offset: i, char: text[i] });
        }
      }
    }

    if (charMap.length === 0) return;

    // Find the substring in the charMap
    const targetLen = searchTarget.length;
    let matchStartIndex = -1;

    for (let i = 0; i <= charMap.length - targetLen; i++) {
      let isMatch = true;
      for (let j = 0; j < targetLen; j++) {
        if (charMap[i + j].char !== searchTarget[j]) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        matchStartIndex = i;
        break;
      }
    }

    // Build Ranges for the matched sequence spanning across multiple nodes
    if (matchStartIndex !== -1) {
      const ranges = [];
      let currentNode = null;
      let currentStartOffset = -1;
      let lastOffset = -1;

      for (let k = 0; k < targetLen; k++) {
        const point = charMap[matchStartIndex + k];

        if (point.node !== currentNode) {
          if (currentNode) {
            const range = new Range();
            range.setStart(currentNode, currentStartOffset);
            range.setEnd(currentNode, lastOffset + 1);
            ranges.push(range);
          }
          currentNode = point.node;
          currentStartOffset = point.offset;
        }
        lastOffset = point.offset;
      }

      // Close final range
      if (currentNode) {
        const range = new Range();
        range.setStart(currentNode, currentStartOffset);
        range.setEnd(currentNode, lastOffset + 1); // +1 effectively includes whitespace up to the end char
        ranges.push(range);
      }

      CSS.highlights.set('tts-reading', new Highlight(...ranges));
    }
  }

  clearHighlight() {
    if (CSS.highlights) CSS.highlights.delete('tts-reading');
  }

  // クリップボードから読み上げ時のハイライト処理
  updatePopupTextWithHighlight(fullContent, playingChunk) {
    if (!fullContent || !playingChunk) return;
    const safeChunk = playingChunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeContent = fullContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const parts = safeContent.split(safeChunk);
    if (parts.length > 1) {
      this.elems.textDisplay.innerHTML =
        `${parts[0]}<span class="highlight-chunk">${safeChunk}</span>${parts.slice(1).join(safeChunk)}`
          .replace(/\n/g, '<br>');
      const el = this.elems.textDisplay.querySelector('.highlight-chunk');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.elems.textDisplay.innerHTML = safeContent.replace(/\n/g, '<br>');
    }
  }

  showError(msg) {
    const span = document.createElement('span');
    span.className = 'error-text';
    span.textContent = msg;
    this.elems.textDisplay.replaceChildren(span);
  }

  ensureAppended() {
    if (document.body && !document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
  }

  show() {
    this.ensureAppended();
    this.elems.container.classList.remove('hidden');
  }

  hide() {
    this.ensureAppended();
    this.elems.container.classList.add('hidden');
  }

  toggle() {
    this.ensureAppended();
    this.elems.container.classList.toggle('hidden');
  }
}

// Injected only once
if (!window._smartTtsUI) {
  window._smartTtsUI = new SmartTTSUI();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PING') {
      sendResponse({ status: 'ok' });
    } else if (request.type === 'UI_SHOW') {
      window._smartTtsUI.show();
    } else if (request.type === 'UI_TOGGLE') {
      window._smartTtsUI.toggle();
    } else if (request.type === 'STATE_UPDATE') {
      window._smartTtsUI.show();

      if (request.fullText) {
        window._smartTtsUI.currentDocText = request.fullText;
      }

      window._smartTtsUI.updateState(request.state);

      // 読み上げの状態に応じてハイライト、ハイライトの解除をする
      if (request.state === 'PLAYING' && request.text) {
        window._smartTtsUI.highlightTextOnPage(request.text);

        // Only update text-display if clipboard panel is visible
        if (window._smartTtsUI.isClipMode) {
          const docText = window._smartTtsUI.currentDocText;
          if (docText) {
            window._smartTtsUI.updatePopupTextWithHighlight(docText, request.text);
          }
        }
      } else if (request.state === 'STOPPED' || request.state === 'PAUSED') {
        window._smartTtsUI.clearHighlight();
      }
    }
  });
}
