// Options page script
let settings = {};

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    setupTabs();
    setupLinkedInSettings();
});

// Load all settings from storage
async function loadSettings() {
    settings = await chrome.storage.local.get(null);

    // General settings
    // General settings
    const setElementValue = (id, value, defaultValue) => {
        const element = document.getElementById(id);
        if (element) {
            element.value = value || defaultValue;
        }
    };

    const setElementChecked = (id, checked, defaultChecked) => {
        const element = document.getElementById(id);
        if (element) {
            element.checked = checked !== undefined ? checked : defaultChecked;
        }
    };

    setElementValue('defaultPlatform', settings.defaultPlatform, 'linkedin');
    setElementValue('theme', settings.theme, 'light');
    setElementChecked('notifications', settings.notifications, true);
    setElementChecked('soundEffects', settings.soundEffects, false);
    setElementChecked('autoStart', settings.autoStart, false);

    // Schedule settings
    setElementChecked('enableSchedule', settings.enableSchedule, false);
    setElementValue('startTime', settings.startTime, '09:00');
    setElementValue('endTime', settings.endTime, '17:00');

    // Load active days
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const defaultChecked = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day);
        setElementChecked(day, settings.activeDays ? settings.activeDays[day] : defaultChecked, defaultChecked);
    });

    // LinkedIn settings
    setElementValue('linkedinDailyLimit', settings.linkedinDailyLimit, 50);

    // Load LinkedIn config
    await loadLinkedInSettings();

    // Instagram settings
    setElementValue('instagramDailyLimit', settings.instagramDailyLimit, 30);
    setElementChecked('igPosts', settings.igPosts, true);
    setElementChecked('igReels', settings.igReels, true);
    setElementChecked('igStories', settings.igStories, false);
    setElementChecked('igHome', settings.igHome, true);
    setElementChecked('igExplore', settings.igExplore, false);
    setElementChecked('igSkipVerified', settings.igSkipVerified, false);

    // Advanced settings
    setElementValue('userAgent', settings.userAgent, 'default');
    setElementChecked('debugMode', settings.debugMode, false);
    setElementChecked('experimentalFeatures', settings.experimentalFeatures, false);
}

// Load LinkedIn specific settings
async function loadLinkedInSettings() {
    const stored = await chrome.storage.local.get(['linkedinConfig']);
    const config = stored.linkedinConfig || {};

    // Helper function to safely set values
    const setElementChecked = (id, value, defaultValue) => {
        const element = document.getElementById(id);
        if (element) {
            element.checked = value !== undefined ? value : defaultValue;
        }
    };

    const setElementValue = (id, value, defaultValue) => {
        const element = document.getElementById(id);
        if (element) {
            element.value = value || defaultValue;
        }
    };

    // Apply settings to UI
    setElementChecked('likePostsOnly', config.likePostsOnly, true);
    setElementChecked('skipSponsored', config.skipSponsored, false);
    setElementChecked('followPostAuthors', config.followPostAuthors, false);
    setElementValue('dailyFollowLimit', config.dailyFollowLimit, 20);
    setElementChecked('humanizeActions', config.humanizeActions, true);
    setElementChecked('randomScroll', config.randomScroll, true);

    // Select speed preset
    const speedPreset = config.speedPreset || 'balanced';
    document.querySelectorAll('#linkedin .preset-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.speed === speedPreset);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Save button
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    // Cancel button
    document.getElementById('cancelSettings').addEventListener('click', () => {
        window.close();
    });

    // Export settings
    document.getElementById('exportSettings').addEventListener('click', exportSettings);

    // Import settings
    document.getElementById('importSettings').addEventListener('click', importSettings);

    // Reset statistics
    document.getElementById('resetStats').addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all statistics?')) {
            await chrome.storage.local.set({
                totalLikes: 0,
                todayLikes: 0,
                todayFollows: 0,
                todayConnects: 0,
                todayComments: 0
            });
            showSuccessMessage('Statistics reset successfully!');
        }
    });

    // Reset all settings
    document.getElementById('resetAll').addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset ALL settings? This cannot be undone.')) {
            await chrome.storage.local.clear();
            await loadSettings();
            showSuccessMessage('All settings reset to defaults!');
        }
    });
}

// Setup LinkedIn specific handlers
function setupLinkedInSettings() {
    // Speed preset handlers
    document.querySelectorAll('#linkedin .preset-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('#linkedin .preset-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

// Setup tab functionality
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

// Save settings
async function saveSettings() {
    const getElementValue = (id, defaultValue) => {
        const element = document.getElementById(id);
        return element ? element.value : defaultValue;
    };

    const getElementChecked = (id, defaultChecked) => {
        const element = document.getElementById(id);
        return element ? element.checked : defaultChecked;
    };

    const newSettings = {
        // General
        defaultPlatform: getElementValue('defaultPlatform', 'linkedin'),
        theme: getElementValue('theme', 'light'),
        notifications: getElementChecked('notifications', true),
        soundEffects: getElementChecked('soundEffects', false),
        autoStart: getElementChecked('autoStart', false),

        // Schedule
        enableSchedule: getElementChecked('enableSchedule', false),
        startTime: getElementValue('startTime', '09:00'),
        endTime: getElementValue('endTime', '17:00'),
        activeDays: {
            monday: getElementChecked('monday', true),
            tuesday: getElementChecked('tuesday', true),
            wednesday: getElementChecked('wednesday', true),
            thursday: getElementChecked('thursday', true),
            friday: getElementChecked('friday', true),
            saturday: getElementChecked('saturday', false),
            sunday: getElementChecked('sunday', false)
        },

        // LinkedIn general
        linkedinDailyLimit: parseInt(getElementValue('linkedinDailyLimit', 50)),

        // Instagram
        instagramDailyLimit: parseInt(getElementValue('instagramDailyLimit', 30)),
        igPosts: getElementChecked('igPosts', true),
        igReels: getElementChecked('igReels', true),
        igStories: getElementChecked('igStories', false),
        igHome: getElementChecked('igHome', true),
        igExplore: getElementChecked('igExplore', false),
        igSkipVerified: getElementChecked('igSkipVerified', false),

        // Advanced
        userAgent: getElementValue('userAgent', 'default'),
        debugMode: getElementChecked('debugMode', false),
        experimentalFeatures: getElementChecked('experimentalFeatures', false)
    };

    await chrome.storage.local.set(newSettings);
    await saveLinkedInSettings();

    showSuccessMessage('Settings saved successfully!');
}

// Save LinkedIn specific settings
async function saveLinkedInSettings() {
    const getElementChecked = (id, defaultValue) => {
        const element = document.getElementById(id);
        return element ? element.checked : defaultValue;
    };

    const getElementValue = (id, defaultValue) => {
        const element = document.getElementById(id);
        return element ? element.value : defaultValue;
    };

    const linkedinConfig = {
        likePostsOnly: getElementChecked('likePostsOnly', true),
        skipSponsored: getElementChecked('skipSponsored', false),
        followPostAuthors: getElementChecked('followPostAuthors', false),
        dailyFollowLimit: parseInt(getElementValue('dailyFollowLimit', 20)),
        humanizeActions: getElementChecked('humanizeActions', true),
        randomScroll: getElementChecked('randomScroll', true),
        speedPreset: document.querySelector('#linkedin .preset-card.selected')?.dataset.speed || 'balanced'
    };

    await chrome.storage.local.set({ linkedinConfig });
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = `✅ ${message}`;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Export settings
function exportSettings() {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `social-auto-liker-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    showSuccessMessage('Settings exported successfully!');
}

// Import settings
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedSettings = JSON.parse(text);

            // Validate settings
            if (typeof importedSettings !== 'object') {
                throw new Error('Invalid settings file');
            }

            // Save imported settings
            await chrome.storage.local.set(importedSettings);
            await loadSettings();

            showSuccessMessage('Settings imported successfully!');
        } catch (error) {
            alert('Error importing settings: ' + error.message);
        }
    };

    input.click();
}