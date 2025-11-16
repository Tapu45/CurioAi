import logger from '../utils/logger.js';

// Clean text: remove extra whitespace, normalize line breaks
function cleanText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let cleaned = text;

    // Normalize line breaks
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');

    // Remove excessive line breaks (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove excessive spaces
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

    // Remove leading/trailing whitespace from each line
    cleaned = cleaned
        .split('\n')
        .map(line => line.trim())
        .join('\n');

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

// Normalize text: unicode normalization, character fixes
function normalizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let normalized = text;

    // Unicode normalization (NFKC form)
    normalized = normalized.normalize('NFKC');

    // Replace common problematic characters
    const replacements = {
        '\u2018': "'", // Left single quotation mark
        '\u2019': "'", // Right single quotation mark
        '\u201C': '"', // Left double quotation mark
        '\u201D': '"', // Right double quotation mark
        '\u2013': '-', // En dash
        '\u2014': '--', // Em dash
        '\u2026': '...', // Horizontal ellipsis
        '\u00A0': ' ', // Non-breaking space
        '\u200B': '', // Zero-width space
        '\uFEFF': '', // Zero-width no-break space
    };

    for (const [char, replacement] of Object.entries(replacements)) {
        normalized = normalized.replace(new RegExp(char, 'g'), replacement);
    }

    return normalized;
}

// Extract sentences from text
function extractSentences(text) {
    if (!text) return [];

    // Simple sentence extraction (splitting on . ! ?)
    const sentences = text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    return sentences;
}

// Extract paragraphs from text
function extractParagraphs(text) {
    if (!text) return [];

    const paragraphs = text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    return paragraphs;
}

// Calculate reading time (average reading speed: 200 words per minute)
function calculateReadingTime(text) {
    if (!text) return 0;

    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const readingSpeed = 200; // words per minute
    const minutes = Math.ceil(wordCount / readingSpeed);

    return minutes;
}

// Extract keywords (simple frequency-based)
function extractKeywords(text, limit = 10) {
    if (!text) return [];

    // Remove common stop words
    const stopWords = new Set([
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    ]);

    // Extract words (alphanumeric, at least 3 characters)
    const words = text
        .toLowerCase()
        .match(/\b[a-z]{3,}\b/g) || [];

    // Count word frequencies
    const wordFreq = {};
    words.forEach(word => {
        if (!stopWords.has(word)) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });

    // Sort by frequency and return top keywords
    const keywords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);

    return keywords;
}

// Summarize text (simple truncation-based summary)
function createSimpleSummary(text, maxLength = 500) {
    if (!text) return '';

    if (text.length <= maxLength) {
        return text;
    }

    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');

    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > maxLength * 0.7) {
        return truncated.substring(0, cutPoint + 1) + '...';
    }

    return truncated + '...';
}

export {
    cleanText,
    normalizeText,
    extractSentences,
    extractParagraphs,
    calculateReadingTime,
    extractKeywords,
    createSimpleSummary,
};