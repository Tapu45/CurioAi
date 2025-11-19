import logger from '../utils/logger.js';

// Detect e-commerce site
function detectEcommerceSite(url) {
    if (!url) return null;

    const domain = url.toLowerCase();

    const sites = {
        amazon: ['amazon.com', 'amazon.co.uk', 'amazon.in'],
        ebay: ['ebay.com', 'ebay.co.uk'],
        alibaba: ['alibaba.com', 'aliexpress.com'],
        shopify: ['myshopify.com'],
        etsy: ['etsy.com'],
        walmart: ['walmart.com'],
        target: ['target.com'],
        flipkart: ['flipkart.com'],
    };

    for (const [site, domains] of Object.entries(sites)) {
        if (domains.some(d => domain.includes(d))) {
            return site;
        }
    }

    return 'other';
}

// Extract product categories from URL
function extractProductCategories(url, title) {
    const categories = [];
    const text = `${url} ${title}`.toLowerCase();

    const categoryKeywords = {
        electronics: ['electronics', 'phone', 'laptop', 'tablet', 'computer', 'tv', 'headphone'],
        clothing: ['clothing', 'shirt', 'dress', 'pants', 'shoes', 'fashion', 'apparel'],
        books: ['book', 'ebook', 'kindle'],
        home: ['home', 'furniture', 'kitchen', 'bedroom', 'living'],
        sports: ['sports', 'fitness', 'gym', 'outdoor'],
        beauty: ['beauty', 'cosmetic', 'makeup', 'skincare'],
        toys: ['toy', 'games', 'kids'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            categories.push(category);
        }
    }

    return categories;
}

// Extract shopping content (privacy-focused - no individual products)
async function extractShoppingContent(activity) {
    try {
        const url = activity.url || '';
        const title = activity.window_title || '';
        const site = detectEcommerceSite(url);
        const categories = extractProductCategories(url, title);

        // Don't extract individual product details for privacy
        // Just track browsing activity
        logger.info(`Shopping activity detected: ${site}`);

        return {
            title: site ? `${site.charAt(0).toUpperCase() + site.slice(1)} Shopping` : 'Shopping',
            content: `Browsing ${site || 'e-commerce'} site${categories.length > 0 ? ` - Categories: ${categories.join(', ')}` : ''}`,
            url,
            metadata: {
                app: activity.app_name,
                site,
                categories,
                sourceType: 'shopping',
                extractionMethod: 'metadata-only',
                note: 'Individual products not tracked for privacy',
            },
        };
    } catch (error) {
        logger.error('Error extracting shopping content:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url: activity.url || null,
            metadata: {
                app: activity.app_name,
                error: error.message,
            },
        };
    }
}

export { extractShoppingContent, detectEcommerceSite, extractProductCategories };