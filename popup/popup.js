document.getElementById("applyBtn").addEventListener("click", async () => {
    let jobCount = document.getElementById("jobCount").value;
    let autoRun = document.getElementById("autoRun").checked;

    // Save settings
    chrome.storage.sync.set({
        jobCount: parseInt(jobCount),
        autoRun: autoRun
    });

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, {
        action: 'apply',
        jobCount: parseInt(jobCount)
    });
});

// Load saved settings
chrome.storage.sync.get(["jobCount", "autoRun"], (data) => {
    if (data.jobCount) document.getElementById("jobCount").value = data.jobCount;
    if (data.autoRun !== undefined) document.getElementById("autoRun").checked = data.autoRun;
});

// Listen for updates from content script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateCounter') {
        document.getElementById("counter").textContent = message.applied;
    }
});
