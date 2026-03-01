// offscreen.js
// This offscreen document acts as a heartbeat sender to keep the service worker alive.
// It sends a periodic ping so the service worker doesn't go to sleep during TTS playback.

const HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds

function sendHeartbeat() {
    chrome.runtime.sendMessage({ type: 'HEARTBEAT' }).catch(() => {
        // It's OK if the service worker doesn't respond — it will wake up on next send
    });
}

setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
// Send immediately on load as well
sendHeartbeat();
