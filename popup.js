// State management
let currentPlatform = 'linkedin';
let isRunning = false;
let isPaused = false;
let sessionStartTime = null;
let sessionLikes = 0;

// Platform configurations
const platformConfigs = {
    linkedin: {
        name: 'LinkedIn',
        color: '#0077b5',
        defaultLimit: 50,
        url: 'linkedin.com/feed'
    },
    instagram: {
        name: 'Instagram',
        color: '#E4405F',
        defaultLimit: 30,
        url: 'instagram.com'
    }
};

// Speed presets
const speedPresets = {
    slow: { min: 3000, max: 8000, name: 'Slow (Safe)' },
    medium: { min: 1500, max: 4000, name: 'Medium' },
    fast: { min: 500, max: 1500, name: 'Fast (Risky)' },
    custom: { min: null, max: null, name: 'Custom' }
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    updateUI();
    checkCurrentTab();
    startStatsUpdater();
});

// Load saved settings
async function loadSettings() {
    const settings = await chrome.storage.local.get([
        'currentPlatform',
        'dailyLimit',
        'speedMode',
        'customMinDelay',
        'customMaxDelay',
        'totalLikes',
        'todayLikes',
        'lastResetDate',
        'linkedinConfig'
    ]);
    // Reset daily counter if new day
    const today = new Date().toDateString();
    if (settings.lastResetDate !== today) {
        await chrome.storage.local.set({
            todayLikes: 0,
            lastResetDate: today
        });
        settings.todayLikes = 0;
    }

    // Apply settings
    currentPlatform = settings.currentPlatform || 'linkedin';
    document.getElementById('dailyLimit').value = settings.dailyLimit || 50;
    document.getElementById('dailyLimitValue').textContent = settings.dailyLimit || 50;
    document.getElementById('totalLikes').textContent = settings.totalLikes || 0;
    document.getElementById('likesToday').textContent = settings.todayLikes || 0;

    // Set active platform
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === currentPlatform);
    });

    // Set speed mode
    const speedMode = settings.speedMode || 'medium';
    document.querySelectorAll('.speed-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.speed === speedMode);
    });

    if (speedMode === 'custom') {
        document.getElementById('customSpeedControls').style.display = 'block';
        document.getElementById('minDelay').value = (settings.customMinDelay || 3000) / 1000;
        document.getElementById('maxDelay').value = (settings.customMaxDelay || 8000) / 1000;
        updateSliderValues();
    }

    // Load LinkedIn settings
    await loadLinkedInSettings();
}

// Load LinkedIn settings
async function loadLinkedInSettings() {
    const stored = await chrome.storage.local.get(['linkedinConfig']);
    const config = stored.linkedinConfig || {};

    if (document.getElementById('likeEnabled')) {
        document.getElementById('likeEnabled').checked = config.likeEnabled !== false;
    }
    if (document.getElementById('followEnabled')) {
        document.getElementById('followEnabled').checked = config.followEnabled || false;
    } if (document.getElementById('likeComments')) {
        document.getElementById('likeComments').checked = config.likeComments || false;
    }
    // Add this after the followEnabled handler
   
}

// Setup event listeners
function setupEventListeners() {
    // Platform selection
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => selectPlatform(btn.dataset.platform));
    });

    // Speed selection
    document.querySelectorAll('.speed-option').forEach(btn => {
        btn.addEventListener('click', () => selectSpeed(btn.dataset.speed));
    });

    // Sliders
    document.getElementById('dailyLimit').addEventListener('input', updateSliderValues);
    document.getElementById('minDelay').addEventListener('input', updateSliderValues);
    document.getElementById('maxDelay').addEventListener('input', updateSliderValues);

    // Buttons
    document.getElementById('startBtn').addEventListener('click', startAutomation);
    document.getElementById('stopBtn').addEventListener('click', stopAutomation);
    document.getElementById('pauseBtn').addEventListener('click', pauseAutomation);
    document.getElementById('settingsBtn').addEventListener('click', openOptions);

    // Advanced settings link
    document.getElementById('advancedSettings')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    // LinkedIn feature toggles
    document.getElementById('likeEnabled')?.addEventListener('change', async (e) => {
        await updateLinkedInFeature('likeEnabled', e.target.checked);
    });

    document.getElementById('followEnabled')?.addEventListener('change', async (e) => {
        await updateLinkedInFeature('followEnabled', e.target.checked);
    });
    document.getElementById('likeComments')?.addEventListener('change', async (e) => {
        await updateLinkedInFeature('likeComments', e.target.checked);
    });
    document.getElementById('connectEnabled')?.addEventListener('change', async (e) => {
        await updateLinkedInFeature('connectEnabled', e.target.checked);
    });
}

// Update LinkedIn feature configuration
async function updateLinkedInFeature(feature, value) {
    const stored = await chrome.storage.local.get(['linkedinConfig']);
    const config = stored.linkedinConfig || {};
    config[feature] = value;

    await chrome.storage.local.set({ linkedinConfig: config });

    // Send update to content script if running
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'updateConfig',
            config: { [feature]: value }
        });
    }
}

// Platform selection
async function selectPlatform(platform) {
    currentPlatform = platform;
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === platform);
    });
    document.getElementById('currentPlatform').textContent = platformConfigs[platform].name;
    await chrome.storage.local.set({ currentPlatform: platform });
    checkCurrentTab();
    updateUI();
}

// Speed selection
async function selectSpeed(speed) {
    document.querySelectorAll('.speed-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.speed === speed);
    });

    document.getElementById('customSpeedControls').style.display =
        speed === 'custom' ? 'block' : 'none';

    await chrome.storage.local.set({ speedMode: speed });
}

// Update slider values
function updateSliderValues() {
    document.getElementById('dailyLimitValue').textContent =
        document.getElementById('dailyLimit').value;
    document.getElementById('minDelayValue').textContent =
        document.getElementById('minDelay').value;
    document.getElementById('maxDelayValue').textContent =
        document.getElementById('maxDelay').value;

    // Save values
    chrome.storage.local.set({
        dailyLimit: parseInt(document.getElementById('dailyLimit').value),
        customMinDelay: parseFloat(document.getElementById('minDelay').value) * 1000,
        customMaxDelay: parseFloat(document.getElementById('maxDelay').value) * 1000
    });
}

// Check current tab
async function checkCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const config = platformConfigs[currentPlatform];

    if (!tab.url.includes(config.url)) {
        document.getElementById('startBtn').disabled = true;
        document.getElementById('status').textContent = `Please open ${config.name}`;
        document.querySelector('.status-indicator').className = 'status-indicator status-inactive';
    } else {
        document.getElementById('startBtn').disabled = false;
        // Check if already running
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }).catch(() => null);
        if (response && response.isRunning) {
            isRunning = true;
            updateUI();
        }
    }
}

// Start automation
async function startAutomation() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const speedMode = document.querySelector('.speed-option.active').dataset.speed;

    let delays;
    if (speedMode === 'custom') {
        delays = {
            min: parseFloat(document.getElementById('minDelay').value) * 1000,
            max: parseFloat(document.getElementById('maxDelay').value) * 1000
        };
    } else {
        delays = speedPresets[speedMode];
    }

    // Get LinkedIn config if on LinkedIn
    let config = {};
    if (currentPlatform === 'linkedin') {
        const stored = await chrome.storage.local.get(['linkedinConfig']);
        config = stored.linkedinConfig || {};
    }

    const settings = {
        action: 'start',
        platform: currentPlatform,
        dailyLimit: parseInt(document.getElementById('dailyLimit').value),
        delays: delays,
        config: config
    };

    await chrome.tabs.sendMessage(tab.id, settings);

    isRunning = true;
    isPaused = false;
    sessionStartTime = Date.now();
    sessionLikes = 0;
    updateUI();
}

// Stop automation
async function stopAutomation() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'stop' });

    isRunning = false;
    isPaused = false;
    sessionStartTime = null;
    updateUI();
}

// Pause automation
async function pauseAutomation() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (isPaused) {
        await chrome.tabs.sendMessage(tab.id, { action: 'resume' });
        isPaused = false;
    } else {
        await chrome.tabs.sendMessage(tab.id, { action: 'pause' });
        isPaused = true;
    }

    updateUI();
}

// Update UI based on state
function updateUI() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const statusEl = document.getElementById('status');
    const indicator = document.querySelector('.status-indicator');
    const linkedinFeatures = document.getElementById('linkedinFeatures');

    // Show/hide LinkedIn features based on platform
    if (linkedinFeatures) {
        linkedinFeatures.style.display = currentPlatform === 'linkedin' ? 'block' : 'none';
    }

    if (isRunning) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        pauseBtn.style.display = 'block';
        pauseBtn.innerHTML = isPaused ? '<span>▶️ Resume</span>' : '<span>⏸️ Pause</span>';
        statusEl.textContent = isPaused ? 'Paused' : 'Active';
        indicator.className = `status-indicator ${isPaused ? 'status-inactive' : 'status-active'}`;
    } else {
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        statusEl.textContent = 'Inactive';
        indicator.className = 'status-indicator status-inactive';
    }

    // Update max likes display based on platform
    const maxLikesEl = document.getElementById('maxLikes');
    if (maxLikesEl) {
        maxLikesEl.textContent = document.getElementById('dailyLimit').value;
    }
}

// Update statistics
function startStatsUpdater() {
    setInterval(() => {
        if (isRunning && !isPaused && sessionStartTime) {
            const elapsed = Date.now() - sessionStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const hours = minutes / 60;

            document.getElementById('timeActive').textContent =
                minutes < 60 ? `${minutes}m` : `${Math.floor(hours)}h ${minutes % 60}m`;

            if (hours > 0) {
                document.getElementById('avgSpeed').textContent =
                    Math.round(sessionLikes / hours);
            }
        }
    }, 1000);
}

// Open options page
function openOptions() {
    chrome.runtime.openOptionsPage();
}

// Listen for updates from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        document.getElementById('likesToday').textContent = request.todayLikes;
        document.getElementById('totalLikes').textContent = request.totalLikes;
        document.getElementById('sessionLikes').textContent = request.sessionLikes;
        sessionLikes = request.sessionLikes;

        // Save to storage
        chrome.storage.local.set({
            todayLikes: request.todayLikes,
            totalLikes: request.totalLikes
        });
    } else if (request.action === 'statusUpdate') {
        isRunning = request.isRunning;
        isPaused = request.isPaused;
        updateUI();
    }
});

