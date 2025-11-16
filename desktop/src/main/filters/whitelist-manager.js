import logger from '../utils/logger.js';

// Check if activity matches whitelist
function checkWhitelist(activity, whitelist) {
    if (!whitelist || !activity) {
        return false;
    }

    const { domains = [], apps = [] } = whitelist;

    // Check app name
    const appName = (activity.app_name || '').toLowerCase();
    const appMatch = apps.some(whitelistedApp => {
        const whitelisted = whitelistedApp.toLowerCase();
        return appName.includes(whitelisted) || whitelisted.includes(appName);
    });

    if (appMatch) {
        logger.debug(`App matched whitelist: ${activity.app_name}`);
        return true;
    }

    // Check URL/domain
    const url = activity.url || '';
    if (url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            const domainMatch = domains.some(whitelistedDomain => {
                const whitelisted = whitelistedDomain.toLowerCase();
                return hostname === whitelisted || hostname.endsWith('.' + whitelisted);
            });

            if (domainMatch) {
                logger.debug(`Domain matched whitelist: ${hostname}`);
                return true;
            }
        } catch (error) {
            // Invalid URL, skip domain check
            logger.debug('Invalid URL format:', url);
        }
    }

    // Check window title for domain patterns
    const title = (activity.window_title || '').toLowerCase();
    const titleMatch = domains.some(whitelistedDomain => {
        const whitelisted = whitelistedDomain.toLowerCase();
        return title.includes(whitelisted);
    });

    if (titleMatch) {
        logger.debug(`Title matched whitelist: ${activity.window_title}`);
        return true;
    }

    return false;
}

// Add domain to whitelist
function addDomain(whitelist, domain) {
    if (!whitelist.domains) {
        whitelist.domains = [];
    }

    const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    if (!whitelist.domains.includes(normalizedDomain)) {
        whitelist.domains.push(normalizedDomain);
        logger.info(`Added domain to whitelist: ${normalizedDomain}`);
        return true;
    }

    return false;
}

// Remove domain from whitelist
function removeDomain(whitelist, domain) {
    if (!whitelist.domains) {
        return false;
    }

    const normalizedDomain = domain.toLowerCase();
    const index = whitelist.domains.findIndex(d => d.toLowerCase() === normalizedDomain);

    if (index !== -1) {
        whitelist.domains.splice(index, 1);
        logger.info(`Removed domain from whitelist: ${normalizedDomain}`);
        return true;
    }

    return false;
}

// Add app to whitelist
function addApp(whitelist, appName) {
    if (!whitelist.apps) {
        whitelist.apps = [];
    }

    if (!whitelist.apps.includes(appName)) {
        whitelist.apps.push(appName);
        logger.info(`Added app to whitelist: ${appName}`);
        return true;
    }

    return false;
}

// Remove app from whitelist
function removeApp(whitelist, appName) {
    if (!whitelist.apps) {
        return false;
    }

    const index = whitelist.apps.findIndex(a => a === appName);

    if (index !== -1) {
        whitelist.apps.splice(index, 1);
        logger.info(`Removed app from whitelist: ${appName}`);
        return true;
    }

    return false;
}

export {
    checkWhitelist,
    addDomain,
    removeDomain,
    addApp,
    removeApp,
};