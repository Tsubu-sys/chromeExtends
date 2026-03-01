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
                const textWithNewlines = results[0].result;
                injectAndPlay(tab.id, textWithNewlines);
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
// TTS Logic
// -------------------------
let currentChunks = [];
let currentChunkIndex = 0;
let currentFullText = '';
let isPlaying = false;
let activeTabId = null;

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

    currentFullText = text;
    currentChunks = processText(text);
    currentChunkIndex = 0;
    activeTabId = tabId;
    playNextChunk();
}

function playNextChunk() {
    if (currentChunkIndex >= currentChunks.length) {
        isPlaying = false;
        notifyUIState("STOPPED");
        return;
    }

    isPlaying = true;
    const chunk = currentChunks[currentChunkIndex];
    const cleanText = chunk.replace(/[#`";:*_+~\(){}[\]]/g, " ");
    const lang = detectLanguage(cleanText);

    notifyUIState("PLAYING", chunk);

    chrome.tts.speak(cleanText, {
        lang: lang,
        enqueue: false,
        onEvent: function (event) {
            if (event.type === 'end') {
                currentChunkIndex++;
                playNextChunk();
            } else if (event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
                isPlaying = false;
                notifyUIState("STOPPED");
            }
        }
    });
}

function notifyUIState(state, chunk = "") {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, {
        type: "STATE_UPDATE",
        state: state,
        text: chunk,
        fullText: currentFullText
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
        isPlaying = false;
        notifyUIState("PAUSED");
    } else if (request.type === "COMMAND_RESUME") {
        if (currentChunks.length > 0 && currentChunkIndex < currentChunks.length) {
            if (activeTabId !== sender.tab?.id) activeTabId = sender.tab?.id;

            if (isPlaying === false && currentChunkIndex > 0) {
                chrome.tts.isSpeaking((speaking) => {
                    if (speaking) {
                        chrome.tts.resume();
                        isPlaying = true;
                        notifyUIState("PLAYING", currentChunks[currentChunkIndex] || "");
                    } else {
                        playNextChunk();
                    }
                });
            } else {
                chrome.tts.resume();
                isPlaying = true;
                notifyUIState("PLAYING", currentChunks[currentChunkIndex] || "");
            }
        } else if (request.fallbackText) {
            playText(request.fallbackText, sender.tab?.id);
        }
    } else if (request.type === "COMMAND_STOP") {
        chrome.tts.stop();
        isPlaying = false;
        notifyUIState("STOPPED");
    } else if (request.type === "COMMAND_PLAY_DIRECT") {
        playText(request.text, sender.tab?.id);
    } else if (request.type === "COMMAND_PREV") {
        if (currentChunks.length > 0) {
            chrome.tts.stop();
            currentChunkIndex = Math.max(0, currentChunkIndex - 1);
            playNextChunk();
        }
    } else if (request.type === "COMMAND_NEXT") {
        if (currentChunks.length > 0 && currentChunkIndex < currentChunks.length - 1) {
            chrome.tts.stop();
            currentChunkIndex++;
            playNextChunk();
        } else {
            chrome.tts.stop();
            currentChunkIndex = currentChunks.length;
            isPlaying = false;
            notifyUIState("STOPPED");
        }
    }
});
