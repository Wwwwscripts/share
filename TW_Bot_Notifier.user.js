// ==UserScript==
// @name         TW Bot Notifier
// @author       Wwww
// @version      1.0
// @updateURL    https://raw.githubusercontent.com/Wwwwscripts/share/main/TW_Bot_Notifier.meta.js
// @downloadURL  https://raw.githubusercontent.com/Wwwwscripts/share/main/TW_Bot_Notifier.user.js
// @match        https://*/game.php?*
// @icon         https://raw.githubusercontent.com/Wwwwscripts/share/refs/heads/main/W.png
// @grant        GM_xmlhttpRequest
// @connect      151.242.59.109
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // KONFIGURACE
    const BOT_API_URL = "http://151.242.59.109";
    const CHECK_INTERVAL = 10 * 1000;
    const RETRY_ATTEMPTS = 3;
    const RETRY_DELAY = 2000;

    // Globální proměnné
    let currentPlayerId = null;
    let playerName = null;
    let world = null;
    let isInitialized = false;

    // Získání jména hráče z DOM
    function getPlayerName() {
        try {
            const playerElement = document.querySelector('td.menu-column-item > a[href*="info_player"]');
            if (playerElement) {
                return playerElement.textContent.trim();
            }

            const altElement = document.querySelector('a[href*="info_player"]');
            if (altElement) {
                return altElement.textContent.trim();
            }

            return "Neznámý hráč";
        } catch (error) {
            return "Neznámý hráč";
        }
    }

    // Odeslání notifikace
    function sendNotificationToBot(messageType, currentState, attempt = 1) {
        return new Promise((resolve, reject) => {
            const payload = {
                world: world,
                playerId: currentPlayerId,
                playerName: playerName,
                messageType: messageType,
                currentState: currentState,
                timestamp: Date.now()
            };

            if (typeof GM_xmlhttpRequest === 'undefined') {
                return reject(new Error('GM_xmlhttpRequest not available'));
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: `${BOT_API_URL}/notify`,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                timeout: 5000,

                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);
                        resolve(result);
                    } catch (e) {
                        resolve({ success: true });
                    }
                },

                onerror: function(error) {
                    if (attempt < RETRY_ATTEMPTS) {
                        setTimeout(() => {
                            sendNotificationToBot(messageType, currentState, attempt + 1)
                                .then(resolve)
                                .catch(reject);
                        }, RETRY_DELAY);
                    } else {
                        reject(error);
                    }
                },

                ontimeout: function() {
                    if (attempt < RETRY_ATTEMPTS) {
                        setTimeout(() => {
                            sendNotificationToBot(messageType, currentState, attempt + 1)
                                .then(resolve)
                                .catch(reject);
                        }, RETRY_DELAY);
                    } else {
                        reject(new Error('Timeout after all retries'));
                    }
                }
            });
        });
    }

    // Kontrola CAPTCHA
    function checkForCAPTCHA() {
        try {
            const captchaElements = document.getElementsByClassName('captcha');
            const captchaPresent = captchaElements.length > 0;
            sendNotificationToBot('captcha', captchaPresent).catch(() => {});
        } catch (error) {
            // Ticho
        }
    }

    // Kontrola útoků
    function checkForAttacks() {
        try {
            const attackCountElement = document.querySelector('#incomings_amount');
            if (!attackCountElement) return;

            const attackCount = parseInt(attackCountElement.textContent.trim(), 10) || 0;

            if (attackCount > 0) {
                sendNotificationToBot('attack', attackCount).catch(() => {});
            }
        } catch (error) {
            // Ticho
        }
    }

    // Získání Player ID z village.txt
    function getPlayerId(callback) {
        try {
            const villageMenuElement = document.querySelector('#menu_row2_village');
            if (!villageMenuElement || !villageMenuElement.children[0]) {
                return callback(null);
            }

            const href = villageMenuElement.children[0].getAttribute('href');
            if (!href) {
                return callback(null);
            }

            const params = href.split("?")[1];
            if (!params) {
                return callback(null);
            }

            const urlParams = new URLSearchParams(params);
            const villageId = urlParams.get("village");

            if (!villageId) {
                return callback(null);
            }

            const base_url = window.location.origin;
            const url = `${base_url}/map/village.txt`;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.text();
                })
                .then(result => {
                    const villagesList = result.split("\n");

                    for (const line of villagesList) {
                        if (!line.trim()) continue;

                        const split = line.split(",");
                        if (split.length >= 5 && split[0] === villageId) {
                            const playerId = split[4];
                            return callback(playerId);
                        }
                    }

                    callback(null);
                })
                .catch(() => {
                    callback(null);
                });
        } catch (e) {
            callback(null);
        }
    }

    // Hlavní inicializační funkce
    function initializeScript() {
        if (isInitialized) return;

        playerName = getPlayerName();
        world = window.location.hostname.split('.')[0];

        getPlayerId(function (playerId) {
            if (!playerId) return;

            currentPlayerId = playerId;
            isInitialized = true;

            const monitoringInterval = setInterval(() => {
                try {
                    checkForAttacks();
                    checkForCAPTCHA();
                } catch (error) {
                    // Ticho
                }
            }, CHECK_INTERVAL);

            window.addEventListener('beforeunload', () => {
                clearInterval(monitoringInterval);
            });
        });
    }

    // Spuštění scriptu
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeScript, 1000);
        });
    } else {
        setTimeout(initializeScript, 1000);
    }

    setTimeout(() => {
        if (!isInitialized) {
            initializeScript();
        }
    }, 5000);
})();
