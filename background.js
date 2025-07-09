// Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
    // Set default values
    chrome.storage.local.set({
        currentPlatform: 'linkedin',
        dailyLimit: 50,
        speedMode: 'medium',
        totalLikes: 0,
        todayLikes: 0,
        lastResetDate: new Date().toDateString()
    });
});

// Reset daily counter at midnight
// Reset daily counter at midnight
chrome.alarms.create('resetDailyCounter', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60 // 24 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'resetDailyCounter') {
        chrome.storage.local.set({
            todayLikes: 0,
            lastResetDate: new Date().toDateString()
        });
    }
});

function getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.action.openPopup();
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Check if it's LinkedIn or Instagram
        if (tab.url && (tab.url.includes('linkedin.com') || tab.url.includes('instagram.com'))) {
            // Enable the extension icon
            chrome.action.enable(tabId);
        }
    }
});