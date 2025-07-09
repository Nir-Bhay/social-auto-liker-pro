// Instagram Content Script
class InstagramAutoLiker {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.config = {
            dailyLimit: 30,
            delays: { min: 3000, max: 8000 }
        };
        this.stats = {
            todayLikes: 0,
            totalLikes: 0,
            sessionLikes: 0
        };
        this.panel = null;
        this.processedPosts = new Set();
        this.init();
    }

    async init() {
        await this.loadStats();
        this.createPanel();
        this.listenForMessages();
    }

    async loadStats() {
        const stored = await chrome.storage.local.get(['todayLikes', 'totalLikes']);
        this.stats.todayLikes = stored.todayLikes || 0;
        this.stats.totalLikes = stored.totalLikes || 0;
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'sal-panel sal-instagram';
        this.panel.innerHTML = `
            <div class="sal-header">
                <img src="${chrome.runtime.getURL('assets/instagram-logo.svg')}" width="20">
                <span>Auto-Liker</span>
            </div>
            <div class="sal-status">Status: <span class="sal-status-text">Ready</span></div>
            <div class="sal-count">Today: ${this.stats.todayLikes}/${this.config.dailyLimit}</div>
            <div class="sal-session">Session: ${this.stats.sessionLikes}</div>
        `;
        document.body.appendChild(this.panel);
    }

    updatePanel() {
        if (!this.panel) return;

        this.panel.querySelector('.sal-status-text').textContent =
            this.isPaused ? 'Paused' : (this.isRunning ? 'Running' : 'Stopped');
        this.panel.querySelector('.sal-count').textContent =
            `Today: ${this.stats.todayLikes}/${this.config.dailyLimit}`;
        this.panel.querySelector('.sal-session').textContent =
            `Session: ${this.stats.sessionLikes}`;
    }

    getRandomDelay() {
        const { min, max } = this.config.delays;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    findLikeButtons() {
        const selectors = [
            'svg[aria-label="Like"][height="24"]',
            'svg[aria-label="Like"]',
            'button:has(svg[aria-label="Like"])',
            '[role="button"]:has(svg[aria-label="Like"])'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements).filter(el => {
                    const svg = el.tagName === 'svg' ? el : el.querySelector('svg');
                    return svg && svg.getAttribute('fill') !== '#ff3040';
                });
            }
        }
        return [];
    }

    async clickLikeButton(element) {
        let button = element;

        if (element.tagName === 'svg') {
            button = element.closest('button') || element.closest('[role="button"]');
        }

        if (!button) return false;

        try {
            const rect = button.getBoundingClientRect();

            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                // Simulate human-like interaction
                button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                await this.sleep(100 + Math.random() * 200);

                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                await this.sleep(50 + Math.random() * 100);

                button.click();

                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                return true;
            } else {
                button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(1000);
                return this.clickLikeButton(button);
            }
        } catch (error) {
            console.error('Error clicking button:', error);
            return false;
        }
    }

    async processLikes() {
        if (!this.isRunning || this.isPaused || this.stats.todayLikes >= this.config.dailyLimit) {
            if (this.stats.todayLikes >= this.config.dailyLimit) {
                this.updateStatus('Daily limit reached');
                this.stop();
            }
            return;
        }

        const likeButtons = this.findLikeButtons();

        if (likeButtons.length > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(likeButtons.length, 3));
            const targetButton = likeButtons[randomIndex];

            const success = await this.clickLikeButton(targetButton);

            if (success) {
                this.stats.todayLikes++;
                this.stats.totalLikes++;
                this.stats.sessionLikes++;

                this.updatePanel();
                this.sendStatsUpdate();

                await this.sleep(this.getRandomDelay());
            }
        } else {
            // Scroll for more content
            const scrollDistance = 400 + Math.floor(Math.random() * 200);
            window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
            await this.sleep(1500);
        }

        // Continue processing
        if (this.isRunning && !this.isPaused) {
            setTimeout(() => this.processLikes(), this.getRandomDelay());
        }
    }

    async start(config) {
        this.config = { ...this.config, ...config };
        this.isRunning = true;
        this.isPaused = false;
        this.stats.sessionLikes = 0;
        this.updateStatus('Starting...');
        this.processLikes();
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
        this.processLikes();
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
            totalLikes: this.stats.totalLikes,
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
                    this.start({
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
            }
        });
    }
}

// Initialize when page loads
if (window.location.href.includes('instagram.com')) {
    new InstagramAutoLiker();
}