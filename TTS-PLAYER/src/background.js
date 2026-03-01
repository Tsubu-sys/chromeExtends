// background.js

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "read-aloud",
        title: "読み上げ",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "read-aloud" && tab?.id) {
        try {
            // Chrome's info.selectionText strips newlines automatically.
            // Executing window.getSelection() directly in the tab preserves newlines.
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            });

            if (results && results[0] && results[0].result) {
                injectAndPlay(tab.id, results[0].result);
            } else if (info.selectionText) {
                injectAndPlay(tab.id, info.selectionText);
            }
        } catch (error) {
            console.error("Failed to get raw selection:", error);
            if (info.selectionText) {
                injectAndPlay(tab.id, info.selectionText);
            }
        }
    }
});

chrome.action.onClicked.addListener((tab) => {
    if (tab?.id) {
        injectUI(tab.id).then(() => {
            chrome.tabs.sendMessage(tab.id, { type: "UI_TOGGLE" }).catch(e => console.log(e));
        });
    }
});

async function injectUI(tabId) {
    try {
        const res = await chrome.tabs.sendMessage(tabId, { type: "PING" });
        if (res && res.status === "ok") return;
    } catch (e) {
        // Content script not present, inject it
    }

    await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content_script.js"]
    });
}

async function injectAndPlay(tabId, text) {
    await injectUI(tabId);
    chrome.tabs.sendMessage(tabId, { type: "UI_SHOW" }).catch(e => console.log(e));
    playText(text, tabId);
}

// -------------------------
// Offscreen document (heartbeat keepalive)
// -------------------------
async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Keep service worker alive during TTS playback'
    });
}

// -------------------------
// TTS State (一元管理)
// -------------------------
let ttsState = {
    chunks: [],
    chunkIndex: 0,
    fullText: '',
    isPlaying: false,
    activeTabId: null,
    rate: 1.0,
};

function resetTtsState() {
    ttsState = {
        chunks: [],
        chunkIndex: 0,
        fullText: '',
        isPlaying: false,
        activeTabId: null,
        rate: 1.0,
    };
}

// -------------------------
// TTS Logic
// -------------------------
function detectLanguage(text) {
    const jpRegex = /[\u3040-\u309F]|[\u30A0-\u30FF]|[\u4E00-\u9FAF]/;
    return jpRegex.test(text) ? "ja-JP" : "en-US";
}

function processText(text) {
    return text.split(/\n+/).filter(line => line.trim().length > 0);
}

function playText(text, tabId) {
    // Ensure offscreen document exists to keep service worker alive
    ensureOffscreenDocument().catch(e => console.warn("Offscreen creation failed:", e));

    // Stop any current reading
    chrome.tts.stop();

    ttsState.fullText = text;
    ttsState.chunks = processText(text);
    ttsState.chunkIndex = 0;
    ttsState.activeTabId = tabId;
    playNextChunk();
}

function playNextChunk() {
    if (ttsState.chunkIndex >= ttsState.chunks.length) {
        ttsState.isPlaying = false;
        notifyUIState("STOPPED");
        return;
    }

    ttsState.isPlaying = true;
    const chunk = ttsState.chunks[ttsState.chunkIndex];
    // Fix: 文字クラス内のエスケープを修正（() {} は不要、[] は \[ \] でエスケープ）
    const cleanText = chunk.replace(/[#`";:*_+~(){}[\]]/g, " ");
    const lang = detectLanguage(cleanText);

    notifyUIState("PLAYING", chunk);

    chrome.tts.speak(cleanText, {
        lang: lang,
        rate: ttsState.rate,
        enqueue: false,
        onEvent: function (event) {
            if (event.type === 'end') {
                ttsState.chunkIndex++;
                playNextChunk();
            } else if (event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
                ttsState.isPlaying = false;
                notifyUIState("STOPPED");
            }
        }
    });
}

function notifyUIState(state, chunk = "") {
    if (!ttsState.activeTabId) return;
    chrome.tabs.sendMessage(ttsState.activeTabId, {
        type: "STATE_UPDATE",
        state: state,
        text: chunk,
        fullText: ttsState.fullText
    }).catch(e => console.error("Failed to notify UI:", e));
}

// -------------------------
// Message handlers
// -------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Heartbeat from offscreen document — just receiving this wakes the service worker
    if (request.type === 'HEARTBEAT') {
        return;
    }

    if (request.type === "COMMAND_PAUSE") {
        chrome.tts.pause();
        ttsState.isPlaying = false;
        notifyUIState("PAUSED");

    } else if (request.type === "COMMAND_RESUME") {
        // fallback: チャンクがない場合はテキストから再生
        if (ttsState.chunks.length === 0 && request.fallbackText) {
            playText(request.fallbackText, sender.tab?.id);
            return;
        }
        if (ttsState.chunks.length === 0 || ttsState.chunkIndex >= ttsState.chunks.length) return;

        if (ttsState.activeTabId !== sender.tab?.id) ttsState.activeTabId = sender.tab?.id;

        // isSpeaking を確認して resume か playNextChunk を選択
        chrome.tts.isSpeaking((speaking) => {
            if (speaking) {
                chrome.tts.resume();
            } else {
                playNextChunk();
            }
            ttsState.isPlaying = true;
            notifyUIState("PLAYING", ttsState.chunks[ttsState.chunkIndex] || "");
        });

    } else if (request.type === "COMMAND_STOP") {
        chrome.tts.stop();
        ttsState.isPlaying = false;
        notifyUIState("STOPPED");

    } else if (request.type === "COMMAND_PLAY_DIRECT") {
        playText(request.text, sender.tab?.id);

    } else if (request.type === "COMMAND_PREV") {
        if (ttsState.chunks.length > 0) {
            chrome.tts.stop();
            ttsState.chunkIndex = Math.max(0, ttsState.chunkIndex - 1);
            playNextChunk();
        }

    } else if (request.type === "COMMAND_NEXT") {
        if (ttsState.chunks.length > 0 && ttsState.chunkIndex < ttsState.chunks.length - 1) {
            chrome.tts.stop();
            ttsState.chunkIndex++;
            playNextChunk();
        } else {
            chrome.tts.stop();
            ttsState.chunkIndex = ttsState.chunks.length;
            ttsState.isPlaying = false;
            notifyUIState("STOPPED");
        }

    } else if (request.type === "COMMAND_SET_RATE") {
        ttsState.rate = Math.min(2.0, Math.max(0.5, parseFloat(request.rate) || 1.0));
        // If currently playing, restart current chunk at new rate immediately
        if (ttsState.isPlaying && ttsState.chunks.length > 0) {
            chrome.tts.stop();
            playNextChunk();
        }
    }
});
