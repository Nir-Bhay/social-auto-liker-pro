// LinkedIn Content Script - Fixed version
class LinkedInAutoLiker {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.config = {
            dailyLimit: 50,
            delays: { min: 3000, max: 8000 },
            likeEnabled: true,
            followEnabled: false,
            connectEnabled: false,
            commentEnabled: false,
            likeComments: false  // Add this line
        };
        this.stats = {
            todayLikes: 0,
            todayFollows: 0,
            todayConnects: 0,
            todayComments: 0,
            sessionLikes: 0,
            sessionFollows: 0,
            sessionConnects: 0,
            sessionComments: 0
        };
        this.panel = null;
        this.processedPosts = new Set();
        this.init();
    }

    async init() {
        await this.loadStats();
        await this.loadConfig();
        this.createPanel();
        this.listenForMessages();
    }

    async loadStats() {
        const stored = await chrome.storage.local.get([
            'todayLikes', 'todayFollows', 'todayConnects', 'todayComments'
        ]);
        this.stats.todayLikes = stored.todayLikes || 0;
        this.stats.todayFollows = stored.todayFollows || 0;
        this.stats.todayConnects = stored.todayConnects || 0;
        this.stats.todayComments = stored.todayComments || 0;
    }

    async loadConfig() {
        const stored = await chrome.storage.local.get(['linkedinConfig']);
        if (stored.linkedinConfig) {
            this.config = { ...this.config, ...stored.linkedinConfig };
        }
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'sal-panel sal-linkedin';
        this.panel.innerHTML = `
            <div class="sal-header">
                <img src="${chrome.runtime.getURL('assets/linkedin-logo.svg')}" width="20">
                <span>Auto-Engagement</span>
            </div>
            <div class="sal-status">Status: <span class="sal-status-text">Ready</span></div>
            <div class="sal-count">
                👍 Likes: ${this.stats.sessionLikes} | 
                👥 Follows: ${this.stats.sessionFollows}
            </div>
        `;
        document.body.appendChild(this.panel);
    }

    updatePanel() {
        if (!this.panel) return;

        this.panel.querySelector('.sal-status-text').textContent =
            this.isPaused ? 'Paused' : (this.isRunning ? 'Running' : 'Stopped');

        this.panel.querySelector('.sal-count').innerHTML = `
            👍 Likes: ${this.stats.sessionLikes} | 
            👥 Follows: ${this.stats.sessionFollows}
        `;
    }

    getRandomDelay() {
        const { min, max } = this.config.delays;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async findLikeButton() {
        // Wait a bit for content to load
        await this.sleep(500);

        // Get all posts in the feed
        const posts = document.querySelectorAll('[data-id]');

        for (const post of posts) {
            const postId = post.getAttribute('data-id');

            // Skip if already processed
            if (this.processedPosts.has(postId)) continue;

            // Find the reactions button in this post
            const likeButton = post.querySelector('button[aria-label*="React"][aria-pressed="false"]') ||
                post.querySelector('button[aria-label*="react"][aria-pressed="false"]') ||
                post.querySelector('.reactions-react-button[aria-pressed="false"]') ||
                post.querySelector('button.react-button__trigger[aria-pressed="false"]');

            if (likeButton) {
                // IMPORTANT: Check if button is in main post actions, not in comments
                const isInComments = likeButton.closest('.comments-comment-item') !== null ||
                    likeButton.closest('.comments-comment-box') !== null ||
                    likeButton.closest('.comments-comments-list') !== null;

                const isInMainActions = likeButton.closest('.feed-shared-social-action-bar') !== null ||
                    likeButton.closest('.social-details-social-action-bar') !== null;

                // Only like if it's in main post actions OR if likeComments is enabled
                if (!isInComments || (this.config.likeComments && isInComments)) {
                    console.log('Found like button for post:', postId);
                    return { button: likeButton, postId };
                }
            }
        }
        // Alternative approach - find by button structure
        const allButtons = document.querySelectorAll('button[aria-pressed="false"]');
        for (const button of allButtons) {
            // Check if button has like/reaction icon
            const hasLikeIcon = button.querySelector('use[href*="#reaction-thumbs-up"]') ||
                button.querySelector('li-icon[type="thumbs-up-outline"]') ||
                button.querySelector('svg[data-test-icon="thumbs-up-outline-small"]');

            if (hasLikeIcon) {
                const post = button.closest('[data-id]');
                if (post) {
                    const postId = post.getAttribute('data-id');
                    if (!this.processedPosts.has(postId)) {
                        console.log('Found like button (alternative method):', button);
                        return { button, postId };
                    }
                }
            }
        }

        console.log('No like button found');
        return null;
    }

    async findConnectButton() {
        if (!this.config.connectEnabled) return null;

        const connectButtonSelectors = [
            'button[aria-label*="Connect"]',
            'button:has(span:contains("Connect"))',
            'button.artdeco-button--secondary:contains("Connect")'
        ];

        for (const selector of connectButtonSelectors) {
            const buttons = document.querySelectorAll(selector);

            for (const button of buttons) {
                const buttonText = button.textContent.trim();
                // Make sure it's not "Connected" or "Pending"
                if (buttonText === 'Connect' || buttonText.includes('Connect')) {
                    if (!buttonText.includes('Connected') && !buttonText.includes('Pending')) {
                        console.log('Found connect button:', button);
                        return button;
                    }
                }
            }
        }

        return null;
    }
    async clickButton(button) {
        try {
            // Scroll into view if needed
            const rect = button.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
                button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(1000);
            }

            // Focus the button first
            button.focus();
            await this.sleep(100);

            // Click the button
            button.click();

            console.log('Clicked button successfully');
            return true;
        } catch (error) {
            console.error('Error clicking button:', error);
            return false;
        }
    }

    async processActions() {
        if (!this.isRunning || this.isPaused) return;

        // Check daily limit
        if (this.stats.todayLikes >= this.config.dailyLimit) {
            this.updateStatus('Daily limit reached');
            this.stop();
            return;
        }

        let actionPerformed = false;

        // Try to like a post
        if (this.config.likeEnabled) {
            const likeData = await this.findLikeButton();
            if (likeData) {
                const success = await this.clickButton(likeData.button);
                if (success) {
                    this.processedPosts.add(likeData.postId);
                    this.stats.todayLikes++;
                    this.stats.sessionLikes++;
                    this.updatePanel();
                    this.sendStatsUpdate();
                    actionPerformed = true;

                    // Wait after action
                    await this.sleep(this.getRandomDelay());
                }
            }
        }

        // Try to follow if enabled and no like was performed
        // Add this after the follow section and before the "If no action performed, scroll" part

        // Try to connect if enabled
        if (!actionPerformed && this.config.connectEnabled) {
            const connectButton = await this.findConnectButton();
            if (connectButton) {
                const success = await this.clickButton(connectButton);
                if (success) {
                    this.stats.todayConnects++;
                    this.stats.sessionConnects++;
                    this.updatePanel();
                    this.sendStatsUpdate();
                    actionPerformed = true;

                    // Wait after action
                    await this.sleep(this.getRandomDelay());
                }
            }
        }

        // If no action performed, scroll
        if (!actionPerformed) {
            console.log('No action performed, scrolling...');
            window.scrollBy({ top: 400, behavior: 'smooth' });
            await this.sleep(2000);
        }

        // Continue processing
        if (this.isRunning && !this.isPaused) {
            setTimeout(() => this.processActions(), 500);
        }
    }

    async start(config) {
        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.isRunning = true;
        this.isPaused = false;
        this.stats.sessionLikes = 0;
        this.stats.sessionFollows = 0;
        this.stats.sessionConnects = 0;
        this.stats.sessionComments = 0;

        this.updateStatus('Starting...');
        console.log('Starting automation with config:', this.config);
        this.processActions();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.updateStatus('Stopped');
        this.sendStatusUpdate();
    }

    pause() {
        this.isPaused = true;
        this.updateStatus('Paused');
        this.sendStatusUpdate();
    }

    resume() {
        this.isPaused = false;
        this.updateStatus('Running');
        this.processActions();
        this.sendStatusUpdate();
    }

    updateStatus(status) {
        if (this.panel) {
            this.panel.querySelector('.sal-status-text').textContent = status;
        }
    }

    sendStatsUpdate() {
        chrome.runtime.sendMessage({
            action: 'updateStats',
            todayLikes: this.stats.todayLikes,
            totalLikes: this.stats.todayLikes,
            sessionLikes: this.stats.sessionLikes
        });
    }

    sendStatusUpdate() {
        chrome.runtime.sendMessage({
            action: 'statusUpdate',
            isRunning: this.isRunning,
            isPaused: this.isPaused
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    listenForMessages() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'start':
                    this.start(request.config || {
                        dailyLimit: request.dailyLimit,
                        delays: request.delays
                    });
                    break;
                case 'stop':
                    this.stop();
                    break;
                case 'pause':
                    this.pause();
                    break;
                case 'resume':
                    this.resume();
                    break;
                case 'getStatus':
                    sendResponse({
                        isRunning: this.isRunning,
                        isPaused: this.isPaused
                    });
                    break;
                case 'updateConfig':
                    this.config = { ...this.config, ...request.config };
                    break;
            }
        });
    }
}

// Initialize when page loads
if (window.location.href.includes('linkedin.com')) {
    // Wait for page to load before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new LinkedInAutoLiker();
        });
    } else {
        new LinkedInAutoLiker();
    }
}