import logger from '../utils/logger.js';

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

// Classify activity type
function classifyActivity(activity) {
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
function isLearningActivity(classification) {
    return classification.type === 'learning' && classification.confidence >= 0.6;
}

// Check if app is code-related
function isCodeApp(appName) {
    const codeApps = [
        'code', 'visual studio', 'intellij', 'pycharm', 'webstorm',
        'sublime', 'atom', 'vim', 'emacs', 'terminal', 'iterm',
    ];
    return codeApps.some(app => appName.includes(app));
}

// Check if app is document/note-related
function isDocumentApp(appName) {
    const docApps = [
        'notion', 'obsidian', 'word', 'pages', 'notes',
        'evernote', 'onenote', 'bear',
    ];
    return docApps.some(app => appName.includes(app));
}

export {
    classifyActivity,
    isLearningActivity,
    isCodeApp,
    isDocumentApp,
};