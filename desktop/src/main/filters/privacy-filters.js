import logger from '../utils/logger.js';

// Remove PII from text
function removePII(text) {
    if (!text) return text;

    let cleaned = text;

    // Remove email addresses
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

    // Remove phone numbers (various formats)
    cleaned = cleaned.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');

    // Remove credit card numbers (basic pattern)
    cleaned = cleaned.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

    // Remove SSN (basic pattern)
    cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

    if (cleaned !== text) {
        logger.info('PII removed from text');
    }

    return cleaned;
}

// Anonymize activity data
function anonymizeActivity(activity) {
    const anonymized = { ...activity };

    let changed = false;

    if (anonymized.content) {
        const cleaned = removePII(anonymized.content);
        if (cleaned !== anonymized.content) changed = true;
        anonymized.content = cleaned;
    }

    if (anonymized.title) {
        const cleaned = removePII(anonymized.title);
        if (cleaned !== anonymized.title) changed = true;
        anonymized.title = cleaned;
    }

    if (anonymized.window_title) {
        const cleaned = removePII(anonymized.window_title);
        if (cleaned !== anonymized.window_title) changed = true;
        anonymized.window_title = cleaned;
    }

    if (changed) {
        logger.info('Activity anonymized');
    }

    return anonymized;
}

export {
    removePII,
    anonymizeActivity,
};