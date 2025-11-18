import { BaseTool } from './base-tool.js';
import { getRAGChain } from '../../rag-chain.js';
import logger from '../../../utils/logger.js';

/**
 * RAG Search Tool - Wraps existing RAG chain for agent use
 */
export class RAGSearchTool extends BaseTool {
    constructor() {
        super(
            'rag_search',
            'Search the knowledge base using semantic search. Use this to find information about topics, concepts, or content the user has learned about. Returns relevant documents and summaries.',
            {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query to find relevant information',
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 5)',
                        default: 5,
                    },
                    sourceType: {
                        type: 'string',
                        description: 'Filter by source type (workspace, activities, documents, images, code, all)',
                        enum: ['workspace', 'activities', 'documents', 'images', 'code', 'all'],
                        default: 'all',
                    },
                },
                required: ['query'],
            }
        );
        this.ragChain = null;
    }

    /**
     * Initialize RAG chain
     */
    async initialize() {
        if (!this.ragChain) {
            this.ragChain = await getRAGChain();
        }
    }

    /**
     * Execute RAG search
     */
    async execute(params) {
        try {
            await this.initialize();

            const {
                query,
                maxResults = 5,
                sourceType = 'all', // Add source type parameter
            } = params;

            // Build filters
            const filters = {};
            if (sourceType && sourceType !== 'all') {
                filters.source_type = sourceType;
            }

            // Invoke RAG chain with source filter
            const result = await this.ragChain.invoke(query, {
                filters,
                maxContextItems: maxResults,
                sourceType, // Pass source type
            });

            // Format for agent
            return {
                answer: result.answer,
                sources: result.sources || [],
                contextUsed: result.contextUsed || 0,
                confidence: result.confidence || 0,
                summary: `Found ${result.contextUsed || 0} relevant sources with ${result.confidence || 0}% confidence`,
            };
        } catch (error) {
            logger.error('Error in RAG search tool:', error);
            throw error;
        }
    }
}