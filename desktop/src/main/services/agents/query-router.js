import logger from '../../utils/logger.js';

/**
 * Query Router - Classifies queries as simple (RAG) or complex (Agent)
 */
class QueryRouter {
    constructor() {
        // Keywords that suggest complex queries requiring agent
        this.complexKeywords = [
            'find', 'search', 'where', 'locate', 'show me',
            'what is the', 'which file', 'list all',
            'compare', 'analyze', 'extract', 'get me',
            'need', 'want', 'help me find',
        ];

        // Keywords that suggest simple queries (direct RAG)
        this.simpleKeywords = [
            'what', 'how', 'explain', 'tell me about',
            'describe', 'what does', 'what is',
        ];

        // Intent patterns
        this.intentPatterns = {
            fileSearch: /(find|search|where|locate|show me).*(file|document|image|pdf|image)/i,
            dataExtraction: /(extract|get|what is the|percentage|score|grade|result)/i,
            comparison: /(compare|difference|vs|versus)/i,
            listing: /(list|show all|what are all)/i,
        };
    }

    /**
     * Classify query complexity
     */
    classifyQuery(query) {
        try {
            const normalizedQuery = query.toLowerCase().trim();
            const queryLength = normalizedQuery.split(/\s+/).length;

            // Check for complex intent patterns
            const hasComplexIntent = Object.values(this.intentPatterns).some(pattern =>
                pattern.test(normalizedQuery)
            );

            // Check for complex keywords
            const hasComplexKeywords = this.complexKeywords.some(keyword =>
                normalizedQuery.includes(keyword)
            );

            // Heuristics for classification
            const isComplex =
                hasComplexIntent ||
                hasComplexKeywords ||
                queryLength > 15 || // Long queries often need multi-step
                normalizedQuery.includes('?') && normalizedQuery.split('?').length > 2; // Multiple questions

            // Check for file system operations
            const isFileOperation =
                this.intentPatterns.fileSearch.test(normalizedQuery) ||
                normalizedQuery.includes('file') && (normalizedQuery.includes('where') || normalizedQuery.includes('find'));

            // Check for data extraction needs
            const needsExtraction =
                this.intentPatterns.dataExtraction.test(normalizedQuery) ||
                normalizedQuery.match(/\d+%/); // Contains percentage

            const classification = {
                isComplex,
                isSimple: !isComplex,
                isFileOperation,
                needsExtraction,
                intent: this.detectIntent(normalizedQuery),
                confidence: this.calculateConfidence(normalizedQuery, isComplex),
            };

            logger.debug(`Query classified: ${JSON.stringify(classification)}`);
            return classification;
        } catch (error) {
            logger.error('Error classifying query:', error);
            // Default to simple query on error
            return {
                isComplex: false,
                isSimple: true,
                isFileOperation: false,
                needsExtraction: false,
                intent: 'general',
                confidence: 0.5,
            };
        }
    }

    /**
     * Detect query intent
     */
    detectIntent(query) {
        for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
            if (pattern.test(query)) {
                return intent;
            }
        }
        return 'general';
    }

    /**
     * Calculate classification confidence
     */
    calculateConfidence(query, isComplex) {
        let confidence = 0.5;

        // Increase confidence based on keyword matches
        const complexMatches = this.complexKeywords.filter(kw => query.includes(kw)).length;
        const simpleMatches = this.simpleKeywords.filter(kw => query.includes(kw)).length;

        if (isComplex && complexMatches > 0) {
            confidence = Math.min(0.5 + (complexMatches * 0.15), 0.95);
        } else if (!isComplex && simpleMatches > 0) {
            confidence = Math.min(0.5 + (simpleMatches * 0.15), 0.95);
        }

        // Pattern matches increase confidence
        const hasPattern = Object.values(this.intentPatterns).some(p => p.test(query));
        if (hasPattern) {
            confidence = Math.min(confidence + 0.2, 0.95);
        }

        return confidence;
    }

    /**
     * Route query to appropriate handler
     */
    async routeQuery(query, options = {}) {
        const classification = this.classifyQuery(query);

        return {
            query,
            classification,
            shouldUseAgent: classification.isComplex,
            shouldUseRAG: classification.isSimple,
            options: {
                ...options,
                intent: classification.intent,
                needsExtraction: classification.needsExtraction,
                isFileOperation: classification.isFileOperation,
            },
        };
    }
}

// Singleton instance
let queryRouterInstance = null;

export function getQueryRouter() {
    if (!queryRouterInstance) {
        queryRouterInstance = new QueryRouter();
    }
    return queryRouterInstance;
}