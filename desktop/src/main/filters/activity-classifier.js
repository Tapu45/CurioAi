import logger from '../utils/logger.js';
import { classifyActivityML } from '../services/activity-classifier-ml.js';

// Learning activity indicators
const LEARNING_KEYWORDS = [
    // Educational platforms
    'tutorial', 'course', 'lesson', 'learn', 'study', 'education',
    'academy', 'university', 'college', 'school',

    // Technical learning
    'documentation', 'docs', 'api', 'guide', 'how-to', 'tutorial',
    'stackoverflow', 'github', 'git', 'code', 'programming',

    // Research & knowledge
    'wikipedia', 'research', 'paper', 'article', 'blog', 'medium',
    'arxiv', 'journal', 'publication',

    // Video learning
    'youtube', 'video', 'lecture', 'webinar', 'training',

    // Reading
    'book', 'ebook', 'pdf', 'read', 'reading',
];

// Entertainment keywords (to filter out)
const ENTERTAINMENT_KEYWORDS = [
    'netflix', 'spotify', 'music', 'game', 'gaming', 'twitch',
    'instagram', 'facebook', 'twitter', 'social media',
    'entertainment', 'movie', 'tv', 'streaming',
];

// Learning domains
const LEARNING_DOMAINS = [
    'youtube.com', 'medium.com', 'dev.to', 'wikipedia.org',
    'arxiv.org', 'github.com', 'stackoverflow.com',
    'coursera.org', 'udemy.com', 'khanacademy.org',
    'freecodecamp.org', 'codecademy.com', 'edx.org',
    'pluralsight.com', 'linkedin.com/learning',
];

// Use ML classifier by default
let useMLClassifier = true;

/**
 * Toggle ML classifier use.
 * @param {boolean} useML
 */
export function setUseMLClassifier(useML) {
    useMLClassifier = !!useML;
    logger.info(`ML classifier ${useMLClassifier ? 'enabled' : 'disabled'}`);
}

/**
 * Async classify wrapper - prefer ML classifier if enabled, fallback to rule-based.
 * @param {Object} activity
 * @returns {Promise<Object>}
 */
export async function classifyActivity(activity) {
    if (useMLClassifier) {
        try {
            const mlResult = await classifyActivityML(activity);

            if (mlResult && typeof mlResult.confidence === 'number' && mlResult.confidence >= 0.6) {
                logger.debug('ML classifier used', { activity, mlResult });
                return mlResult;
            }

            logger.debug('ML classification confidence low or invalid, falling back to rule-based', {
                activity,
                mlResult,
            });
        } catch (err) {
            logger.debug('ML classifier error, using rule-based:', err?.message || err);
        }
    }

    return classifyActivityRuleBased(activity);
}

/**
 * Rule-based activity classification (original implementation).
 * Kept synchronous so callers can use it deterministically.
 * @param {Object} activity
 * @returns {Object}
 */
export function classifyActivityRuleBased(activity) {
    const appName = (activity.app_name || '').toLowerCase();
    const title = (activity.window_title || '').toLowerCase();
    const url = (activity.url || '').toLowerCase();

    const combinedText = `${appName} ${title} ${url}`;

    // Check for entertainment indicators
    const hasEntertainment = ENTERTAINMENT_KEYWORDS.some(keyword =>
        combinedText.includes(keyword)
    );

    if (hasEntertainment) {
        logger.info('Activity classified as entertainment', { activity });
        return {
            type: 'entertainment',
            confidence: 0.8,
            reason: 'Contains entertainment keywords',
        };
    }

    // Check for learning indicators
    const learningMatches = LEARNING_KEYWORDS.filter(keyword =>
        combinedText.includes(keyword)
    ).length;

    const hasLearningDomain = LEARNING_DOMAINS.some(domain =>
        url.includes(domain)
    );

    // Calculate confidence
    let confidence = 0.5; // Base confidence

    if (hasLearningDomain) {
        confidence += 0.3;
    }

    if (learningMatches > 0) {
        confidence += Math.min(learningMatches * 0.1, 0.3);
    }

    // Check for code-related apps
    if (isCodeApp(appName)) {
        confidence += 0.2;
    }

    // Check for document/note apps
    if (isDocumentApp(appName)) {
        confidence += 0.1;
    }

    confidence = Math.min(confidence, 1.0);

    if (confidence >= 0.6) {
        logger.info('Activity classified as learning', {
            activity,
            confidence,
            learningMatches,
            hasLearningDomain,
        });
        return {
            type: 'learning',
            confidence,
            reason: `Learning indicators found (${learningMatches} keywords, domain: ${hasLearningDomain})`,
        };
    }

    logger.info('Activity classified as unknown', {
        activity,
        confidence,
        learningMatches,
        hasLearningDomain,
    });
    return {
        type: 'unknown',
        confidence,
        reason: 'Insufficient learning indicators',
    };
}

// Check if activity is learning-related
export function isLearningActivity(classification) {
    return classification?.type === 'learning' && classification?.confidence >= 0.6;
}

// Check if app is code-related
export function isCodeApp(appName) {
    appName = (appName || '').toLowerCase();
    const codeApps = [
        'code', 'visual studio', 'intellij', 'pycharm', 'webstorm',
        'sublime', 'atom', 'vim', 'emacs', 'terminal', 'iterm',
    ];
    return codeApps.some(app => appName.includes(app));
}

// Check if app is document/note-related
export function isDocumentApp(appName) {
    appName = (appName || '').toLowerCase();
    const docApps = [
        'notion', 'obsidian', 'word', 'pages', 'notes',
        'evernote', 'onenote', 'bear',
    ];
    return docApps.some(app => appName.includes(app));
}

export {
    // Async ML-enabled classifier
    classifyActivity as classifyActivityAsync,
    // Synchronous rule-based classifier
    classifyActivityRuleBased,
};