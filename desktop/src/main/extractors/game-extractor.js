import logger from '../utils/logger.js';

// Detect game name from window title
function extractGameName(activity) {
    const title = activity.window_title || '';
    const appName = activity.app_name || '';

    // Common patterns:
    // "Game Name - Steam"
    // "Game Name - Epic Games Launcher"
    // "Game Name"
    const patterns = [
        /^([^-]+)\s*-\s*(?:Steam|Epic Games|Epic Games Launcher|Origin|Uplay|Battle\.net)/i,
        /^([^-]+)\s*-\s*([^-]+)/, // Generic pattern
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    // If no pattern, use title as game name
    if (title && !title.includes('Steam') && !title.includes('Epic')) {
        return title.split(' - ')[0].trim();
    }

    return appName || 'Unknown Game';
}

// Detect gaming platform
function detectGamingPlatform(activity) {
    const title = (activity.window_title || '').toLowerCase();
    const appName = (activity.app_name || '').toLowerCase();

    if (title.includes('steam') || appName.includes('steam')) {
        return 'Steam';
    }
    if (title.includes('epic') || appName.includes('epic')) {
        return 'Epic Games';
    }
    if (title.includes('origin') || appName.includes('origin')) {
        return 'Origin';
    }
    if (title.includes('uplay') || appName.includes('uplay')) {
        return 'Uplay';
    }
    if (title.includes('battle.net') || appName.includes('battle.net')) {
        return 'Battle.net';
    }
    if (title.includes('gog') || appName.includes('gog')) {
        return 'GOG';
    }

    return 'Unknown';
}

// Extract game content
async function extractGameContent(activity) {
    try {
        const gameName = extractGameName(activity);
        const platform = detectGamingPlatform(activity);

        logger.info(`Game activity detected: ${gameName} (${platform})`);

        return {
            title: gameName,
            content: `Playing ${gameName} on ${platform}`,
            url: null,
            metadata: {
                app: activity.app_name,
                gameName,
                platform,
                sourceType: 'gaming',
                extractionMethod: 'metadata',
            },
        };
    } catch (error) {
        logger.error('Error extracting game content:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {
                app: activity.app_name,
                error: error.message,
            },
        };
    }
}

export { extractGameContent, extractGameName, detectGamingPlatform };