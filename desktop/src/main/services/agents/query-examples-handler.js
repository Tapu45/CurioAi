import { getAgentManager } from './agent-manager.js';
import logger from '../../utils/logger.js';

/**
 * Query Examples Handler - Handles specific complex query patterns
 */
class QueryExamplesHandler {
    constructor() {
        this.patterns = {
            findImage: /(where|find|show me|locate).*(image|picture|photo|result|certificate|document).*(10th|class|grade|result|exam)/i,
            extractPercentage: /(what|extract|get|find).*(percentage|%|percent|grade|score|result).*(10th|class|document|according|according to)/i,
        };
    }

    /**
     * Check if query matches a known pattern
     */
    matchesPattern(query) {
        for (const [name, pattern] of Object.entries(this.patterns)) {
            if (pattern.test(query)) {
                return name;
            }
        }
        return null;
    }

    /**
     * Handle "find image" query
     * Example: "where is my 10th class result image?"
     */
    async handleFindImage(query) {
        try {
            const agentManager = getAgentManager();

            // Agent will use: File Search Tool → Image Analysis Tool
            const result = await agentManager.processQuery(query, {
                useMemory: true,
            });

            return {
                ...result,
                pattern: 'findImage',
                strategy: 'file_search_then_image_analysis',
            };
        } catch (error) {
            logger.error('Error handling find image query:', error);
            throw error;
        }
    }

    /**
     * Handle "extract percentage" query
     * Example: "what is the % in my 10th according to document?"
     */
    async handleExtractPercentage(query) {
        try {
            const agentManager = getAgentManager();

            // Agent will use: RAG Search → Structured Extraction Tool
            const result = await agentManager.processQuery(query, {
                useMemory: true,
            });

            return {
                ...result,
                pattern: 'extractPercentage',
                strategy: 'rag_search_then_structured_extraction',
            };
        } catch (error) {
            logger.error('Error handling extract percentage query:', error);
            throw error;
        }
    }

    /**
     * Process query with pattern matching
     */
    async processQuery(query) {
        const pattern = this.matchesPattern(query);

        if (!pattern) {
            return null; // No pattern match, use default handler
        }

        logger.info(`Matched query pattern: ${pattern}`);

        switch (pattern) {
            case 'findImage':
                return await this.handleFindImage(query);
            case 'extractPercentage':
                return await this.handleExtractPercentage(query);
            default:
                return null;
        }
    }
}

// Singleton instance
let queryExamplesHandlerInstance = null;

export function getQueryExamplesHandler() {
    if (!queryExamplesHandlerInstance) {
        queryExamplesHandlerInstance = new QueryExamplesHandler();
    }
    return queryExamplesHandlerInstance;
}