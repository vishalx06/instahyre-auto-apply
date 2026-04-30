// Content script - auto-apply on page load ONLY if user explicitly enabled it

chrome.storage.sync.get(["autoRun", "jobCount"], (data) => {
    if (data.autoRun === true) {
        console.log("[InstaHyre] Auto Run enabled — waiting for page to settle...");
        setTimeout(() => {
            autoApply(data.jobCount || 10);
        }, 3000);
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'apply') {
        autoApply(message.jobCount);
    }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApplyButtons() {
    return Array.from(document.querySelectorAll("button, a")).filter(el => {
        const text = el.innerText.toLowerCase().trim();
        // More flexible matching - includes any of these keywords
        return text.includes("apply") || text.includes("interested");
    });
}

// Wait up to `timeout` ms for a condition fn to be true, polling every `interval` ms
function waitFor(conditionFn, timeout = 4000, interval = 200) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (conditionFn()) return resolve();
            if (Date.now() - start > timeout) return reject(new Error("waitFor timed out"));
            setTimeout(check, interval);
        };
        check();
    });
}

// Dismiss any open modal by looking for a close/cancel/skip button
function dismissModal() {
    const closers = Array.from(document.querySelectorAll("button, a")).filter(el => {
        const text = el.innerText.toLowerCase().trim();
        return ["close", "cancel", "skip", "×", "✕", "dismiss", "not interested"].includes(text);
    });
    if (closers.length > 0) {
        console.log("[InstaHyre] Dismissing modal:", closers[0].innerText);
        closers[0].click();
        return true;
    }
    return false;
}

// ── Core sequential apply logic ───────────────────────────────────────────────

async function autoApply(limit) {
    console.log("[InstaHyre] Starting auto-apply, limit:", limit);

    let applied = 0;
    let attemptCount = 0;
    const maxAttempts = limit * 5; // Prevent infinite loops

    while (applied < limit && attemptCount < maxAttempts) {
        attemptCount++;
        console.log(`[InstaHyre] Attempt ${attemptCount}/${maxAttempts}, Applied: ${applied}/${limit}`);

        // Get fresh list of buttons each time
        const buttons = getApplyButtons();
        console.log("[InstaHyre] Found", buttons.length, "apply buttons");

        if (buttons.length === 0) {
            console.log("[InstaHyre] No apply buttons found, stopping");
            break;
        }

        // Always click the first button
        const btn = buttons[0];

        if (!document.body.contains(btn)) {
            console.log("[InstaHyre] First button not in DOM, skipping");
            await sleep(500);
            continue;
        }

        console.log(`[InstaHyre] Clicking apply button (${applied + 1}/${limit})`);
        console.log("[InstaHyre] Button text:", btn.innerText.trim());

        try {
            btn.click();
            applied++; // Increment immediately after click
            chrome.runtime.sendMessage({ action: 'updateCounter', applied });
            console.log("[InstaHyre] Applied count:", applied);
        } catch (e) {
            console.log("[InstaHyre] Error clicking button:", e);
            await sleep(500);
            continue;
        }

        // If we've reached the limit, stop
        if (applied >= limit) {
            console.log("[InstaHyre] Reached limit, stopping");
            break;
        }

        // Wait a moment for any modal/dialog to appear
        await sleep(800);

        // If a modal opened, try to dismiss it
        const dismissed = dismissModal();
        if (dismissed) {
            await sleep(1000);
        }

        // Wait for page to update (button disappear or state change)
        try {
            await waitFor(() => !document.body.contains(btn) || btn.disabled, 4000);
            console.log("[InstaHyre] Button changed state");
        } catch (e) {
            console.log("[InstaHyre] Button still exists, continuing anyway");
        }

        // Longer gap between applies to avoid issues
        await sleep(2000);
    }

    console.log(`[InstaHyre] Finished. Applied to ${applied}/${limit} jobs.`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}