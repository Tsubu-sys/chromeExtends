// offscreen.js

/**
 * @file offscreen.js
 * @description Service Worker のスリープを防ぐための Offscreen ドキュメント。
 * 定期的にハートビートメッセージを Service Worker へ送信することで、
 * TTS 再生中に Service Worker が終了しないようにする。
 */

/** @const {number} ハートビートの送信間隔（ミリ秒） */
const HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds

/**
 * Service Worker へハートビートメッセージを送信する。
 * Service Worker が応答しない場合でも無視する（次回の送信で起床する）。
 */
function sendHeartbeat() {
    chrome.runtime.sendMessage({ type: 'HEARTBEAT' }).catch(() => {
        // It's OK if the service worker doesn't respond — it will wake up on next send
    });
}

setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
// Send immediately on load as well
sendHeartbeat();
