import puppeteer from 'puppeteer-core';
import logger from '../utils/logger.js';

let browser = null;

// Initialize browser instance (reusable)
async function initBrowser() {
    if (browser && browser.isConnected()) {
        return browser;
    }

    try {
        // Try to find Chrome/Chromium executable
        const chromePaths = [
            // Windows
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // macOS
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            // Linux
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ];

        let executablePath = null;
        for (const path of chromePaths) {
            const fs = await import('fs');
            try {
                if (fs.existsSync(path)) {
                    executablePath = path;
                    break;
                }
            } catch (e) {
                // Continue searching
            }
        }

        if (!executablePath) {
            logger.warn('Chrome/Chromium not found, browser extraction may not work');
            return null;
        }

        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
            ],
        });

        logger.info('Browser instance initialized');
        return browser;
    } catch (error) {
        logger.error('Error initializing browser:', error);
        return null;
    }
}

// Extract content from browser URL
async function extractBrowserContent(activity) {
    const url = activity.url;
    if (!url) {
        logger.debug('No URL provided for browser extraction');
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {},
        };
    }

    try {
        const browserInstance = await initBrowser();
        if (!browserInstance) {
            logger.warn('Browser not available for extraction');
            return {
                title: activity.window_title || '',
                content: '',
                url,
                metadata: { error: 'Browser not available' },
            };
        }

        const page = await browserInstance.newPage();

        // Set timeout
        page.setDefaultNavigationTimeout(10000);

        // Navigate to URL
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 10000,
        });

        // Extract content
        const extracted = await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript, iframe');
            scripts.forEach(el => el.remove());

            // Get main content
            const selectors = [
                'article',
                'main',
                '[role="main"]',
                '.content',
                '.post-content',
                '.entry-content',
                '.article-content',
                '#content',
                'body',
            ];

            let content = '';
            let title = document.title || '';

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    content = element.innerText || element.textContent || '';
                    if (content.length > 100) {
                        break;
                    }
                }
            }

            // If no content found, try body
            if (!content || content.length < 100) {
                content = document.body?.innerText || document.body?.textContent || '';
            }

            // Get meta description if available
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

            return {
                title,
                content: content.trim(),
                metaDescription: metaDesc,
                url: window.location.href,
            };
        });

        await page.close();

        logger.info(`Browser content extracted: ${extracted.content.length} characters`);

        return {
            title: extracted.title || activity.window_title || '',
            content: extracted.content,
            url: extracted.url || url,
            metadata: {
                metaDescription: extracted.metaDescription,
                extractionMethod: 'puppeteer',
            },
        };
    } catch (error) {
        logger.error(`Error extracting browser content from ${url}:`, error);
        return {
            title: activity.window_title || '',
            content: '',
            url,
            metadata: { error: error.message },
        };
    }
}

// Close browser instance
async function closeBrowser() {
    if (browser) {
        try {
            await browser.close();
            browser = null;
            logger.info('Browser instance closed');
        } catch (error) {
            logger.error('Error closing browser:', error);
        }
    }
}

export { extractBrowserContent, closeBrowser };