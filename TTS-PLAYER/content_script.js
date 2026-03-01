// content_script.js

// CSS inside Shadow DOM
const cssStles = `
  #smart-tts-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    background: rgba(30, 30, 30, 0.95);
    color: white;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    z-index: 2147483647; /* Max z-index */
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  #smart-tts-container.hidden {
    opacity: 0;
    transform: translateY(20px);
    pointer-events: none;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 5px;
    cursor: grab;
  }
  .header:active {
    cursor: grabbing;
  }
  .title {
    font-size: 12px;
    font-weight: bold;
    color: #4A90E2;
  }
  .close-btn {
    cursor: pointer;
    font-size: 24px;
    color: #888;
  }
  .close-btn:hover { color: white; }
  .text-display {
    font-size: 14px;
    line-height: 1.4;
    min-height: 80px;
    max-height: 200px;
    overflow-y: auto;
    word-break: break-word;
    color: #ddd;
    padding-right: 4px;
  }
  .text-display::-webkit-scrollbar {
    width: 6px;
  }
  .text-display::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
  .text-display::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }
  .text-display::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 5px;
  }
  button {
    background: #333;
    border: none;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    flex: 1;
    transition: background 0.2s;
  }
  button:hover {
    background: #444;
  }
  button.primary {
    background: #4A90E2;
  }
  button.primary:hover {
    background: #357ABD;
  }
  button.danger {
    background: #D0021B;
  }
  button.danger:hover {
    background: #A00115;
  }
  .error-text {
    color: #FF6B6B;
    font-size: 12px;
  }
  .toggle-btn {
    background: #333;
    border: 1px solid #555;
    color: #aaa;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .toggle-btn.active {
    background: #4A90E2;
    color: white;
    border-color: #4A90E2;
  }
  .highlight-chunk {
    background-color: rgba(74, 144, 226, 0.4);
    border-radius: 2px;
    padding: 0 2px;
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
    this.highlightRanges = [];
    this._handleDocClick = this.handleDocClick.bind(this);
    this.currentDocText = '';

    this.render();
    this.setupListeners();
  }

  render() {
    const style = document.createElement('style');
    style.textContent = cssStles;
    this.shadow.appendChild(style);

    const container = document.createElement('div');
    container.id = 'smart-tts-container';
    container.innerHTML = `
      <div class="header">
        <span class="title">TTS PLAYER</span>
        <span class="close-btn" id="close-btn">&times;</span>
      </div>
      <div class="text-display" id="text-display">読み上げ対象のテキストがここに表示されます。</div>
      <div class="controls" style="margin-bottom: 5px;">
        <button id="click-to-read-btn" class="toggle-btn" title="ページ上のテキストをクリックして読上"><span class="icon">🎯</span> 読取モード: オフ</button>
      </div>
      <div class="controls" style="margin-bottom: 5px;">
        <button id="prev-btn">⏮</button>
        <button id="play-pause-btn" class="primary">▶</button>
        <button id="next-btn">⏭</button>
        <button id="stop-btn" class="danger">⏹</button>
      </div>
      <div class="controls">
        <button id="sync-btn" style="width: 100%;">クリップボード</button>
      </div>
    `;
    this.shadow.appendChild(container);

    // Cache elements to avoid querying the shadow DOM later and to bypass any getElementById issues.
    this.elems = {
      container: container,
      header: container.querySelector('.header'),
      textDisplay: container.querySelector('#text-display'),
      prevBtn: container.querySelector('#prev-btn'),
      playPauseBtn: container.querySelector('#play-pause-btn'),
      nextBtn: container.querySelector('#next-btn'),
      stopBtn: container.querySelector('#stop-btn'),
      syncBtn: container.querySelector('#sync-btn'),
      closeBtn: container.querySelector('#close-btn'),
      clickToReadBtn: container.querySelector('#click-to-read-btn'),
    };

    this.hide(); // default hidden until triggered
  }

  setupListeners() {
    const { prevBtn, playPauseBtn, nextBtn, stopBtn, syncBtn, closeBtn, container, header, clickToReadBtn } = this.elems;

    // Click to Read Toggle
    clickToReadBtn.addEventListener('click', () => {
      this.isClickToRead = !this.isClickToRead;
      if (this.isClickToRead) {
        clickToReadBtn.classList.add('active');
        clickToReadBtn.innerHTML = '<span class="icon">🎯</span> 画面内選択: オン';
        document.addEventListener('click', this._handleDocClick, true);
      } else {
        clickToReadBtn.classList.remove('active');
        clickToReadBtn.innerHTML = '<span class="icon">🎯</span> 画面内選択: オフ';
        document.removeEventListener('click', this._handleDocClick, true);
      }
    });

    // Drag and drop logic
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      // Prevent drag if clicking on the close button
      if (e.target === closeBtn) return;

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
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = (initialLeft + dx) + 'px';
      container.style.top = (initialTop + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      }
    });

    prevBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'COMMAND_PREV' });
    });

    nextBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'COMMAND_NEXT' });
    });

    playPauseBtn.addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        chrome.runtime.sendMessage({ type: 'COMMAND_PAUSE' });
      } else {
        // Pass fallback text in case the background script cleared chunks
        // We strip out the <span class="highlight-chunk"> markup before sending back
        let rawText = this.currentDocText || this.elems.textDisplay.innerText;
        chrome.runtime.sendMessage({ type: 'COMMAND_RESUME', fallbackText: rawText });
      }
    });

    stopBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'COMMAND_STOP' });
    });

    closeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'COMMAND_STOP' });
      this.hide();
    });

    syncBtn.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          throw new Error('Clipboard API not supported in this context (requires HTTPS and active focus).');
        }
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          this.showError('クリップボードが空です。');
          return;
        }
        chrome.runtime.sendMessage({ type: 'COMMAND_PLAY_DIRECT', text: text });
      } catch (err) {
        console.error('Clipboard sync error:', err);
        this.showError('クリップボードの取得に失敗しました。(HTTPS/フォーカスが必要)');
      }
    });
  }

  updateState(state, text) {
    this.state = state;
    const { playPauseBtn, textDisplay } = this.elems;

    if (state === 'PLAYING') {
      playPauseBtn.textContent = '⏸';
      // Text display is updated by updatePopupTextWithHighlight; only fall back if no fullText
      if (text && !this.currentDocText) {
        textDisplay.innerHTML = text.replace(/\n/g, '<br>');
      }
    } else if (state === 'PAUSED') {
      playPauseBtn.textContent = '▶';
    } else if (state === 'STOPPED') {
      playPauseBtn.textContent = '▶';
      this.clearHighlight();
      // 停止しても textDisplay は上書きせず残す
    }
  }

  handleDocClick(e) {
    if (!this.isClickToRead) return;

    // Ignore clicks inside our own shadow DOM
    if (e.composedPath().includes(this.host)) return;

    // Stop default behavior (e.g. following links)
    e.preventDefault();
    e.stopPropagation();

    // Try to get text from clicked element
    let target = e.target;
    // Walk up if empty element clicked
    while (target && target !== document.body && !target.innerText?.trim()) {
      target = target.parentElement;
    }

    if (target && target.innerText) {
      // Gather text from the target and its subsequent siblings/elements to allow continuous reading
      let collectedText = target.innerText.trim();

      // Use a TreeWalker to find following text nodes or blocks
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            // Skip hidden elements, scripts, styles
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG'].includes(node.tagName)) return NodeFilter.FILTER_REJECT;
            // Only accept block-level or significant text containers to avoid duplicating inner inline texts
            if (node.innerText && node.innerText.trim().length > 0) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        },
        false
      );

      // Start the walker at our target
      walker.currentNode = target;

      // Collect up to 10 subsequent blocks to form a good continuous reading chunk
      let blocksCollected = 0;
      let nextNode;

      // To prevent duplicated text (since parent contains child text), 
      // we only append if the text is not already inside our collectedText.
      while ((nextNode = walker.nextNode()) && blocksCollected < 15) {
        // If this next node is a descendant of the target we already clicked, skip it
        if (target.contains(nextNode)) continue;

        const text = nextNode.innerText.trim();
        // Basic heuristics to avoid adding same text blocks multiple times from nested wrappers
        if (text && !collectedText.includes(text) && !text.includes(collectedText)) {
          collectedText += "\n\n" + text;
          blocksCollected++;
        }
      }

      this.currentDocText = collectedText;
      chrome.runtime.sendMessage({ type: 'COMMAND_PLAY_DIRECT', text: this.currentDocText });
      this.clearHighlight(); // Clear old highlights before starting new
    }
  }

  // Uses the modern CSS Custom Highlight API to highlight text without mutating DOM heavily
  highlightTextOnPage(searchText) {
    this.clearHighlight();
    if (!searchText || !searchText.trim() || !CSS.highlights) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const ranges = [];
    const searchTarget = searchText.trim().toLowerCase();

    let node;
    while ((node = walker.nextNode())) {
      // Skip script/style tags or empty nodes
      if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) continue;

      const nodeText = node.nodeValue.toLowerCase();
      const index = nodeText.indexOf(searchTarget);

      if (index !== -1) {
        const range = new Range();
        range.setStart(node, index);
        range.setEnd(node, index + searchTarget.length);
        ranges.push(range);
        // We only highlight first match to avoid highlighting everything blindly
        break;
      }
    }

    if (ranges.length > 0) {
      const highlight = new Highlight(...ranges);
      CSS.highlights.set('tts-reading', highlight);
    }
  }

  clearHighlight() {
    if (CSS.highlights) {
      CSS.highlights.delete('tts-reading');
    }
  }

  updatePopupTextWithHighlight(fullContent, playingChunk) {
    if (!fullContent || !playingChunk) return;
    // simple replace-once to wrap in a highlight span
    const safeChunk = playingChunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeContent = fullContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const parts = safeContent.split(safeChunk);
    if (parts.length > 1) {
      const htmlText = `${parts[0]}<span class="highlight-chunk">${safeChunk}</span>${parts.slice(1).join(safeChunk)}`;
      this.elems.textDisplay.innerHTML = htmlText.replace(/\n/g, '<br>');

      // scroll the highlighted chunk into view
      const highlightEl = this.elems.textDisplay.querySelector('.highlight-chunk');
      if (highlightEl) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      this.elems.textDisplay.innerHTML = safeContent.replace(/\n/g, '<br>');
    }
  }

  showError(msg) {
    this.elems.textDisplay.innerHTML = `<span class="error-text">${msg}</span>`;
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

  // Listen from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PING') {
      sendResponse({ status: 'ok' });
    } else if (request.type === 'UI_SHOW') {
      window._smartTtsUI.show();
    } else if (request.type === 'UI_TOGGLE') {
      window._smartTtsUI.toggle();
    } else if (request.type === 'STATE_UPDATE') {
      window._smartTtsUI.show();

      // Always sync fullText from background so currentDocText is up to date
      if (request.fullText) {
        window._smartTtsUI.currentDocText = request.fullText;
      }

      window._smartTtsUI.updateState(request.state, request.text);

      if (request.state === 'PLAYING' && request.text) {
        // Highlight the chunk on the page itself
        window._smartTtsUI.highlightTextOnPage(request.text);

        // Update the popup text display with the highlighted chunk
        const docText = window._smartTtsUI.currentDocText;
        if (docText) {
          window._smartTtsUI.updatePopupTextWithHighlight(docText, request.text);
        }
      } else if (request.state === 'STOPPED' || request.state === 'PAUSED') {
        window._smartTtsUI.clearHighlight();
      }
    }
  });
}
