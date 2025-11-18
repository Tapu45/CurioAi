// import { ConversationSummaryMemory } from '@langchain/community/memory/conversation_summary';
// import { VectorStoreRetrieverMemory } from '@langchain/community/memory/vectorstore';
import { createLanceDBVectorStore } from './rag-service.js';
import { generateEmbedding } from './ai-service-client.js';
import logger from '../utils/logger.js';

/**
 * Memory Manager for managing different types of conversation memory
 */
class MemoryManager {
    constructor() {
        this.bufferMemory = null;
        this.summaryMemory = null;
        this.vectorMemory = null;
        this.entityMemory = new Map(); // Simple entity tracking
    }

    /**
     * Initialize buffer memory (short-term, last N messages)
     */
    initializeBufferMemory(maxTokenLimit = 2000) {
        // Use ChatMessageHistory instead of BufferMemory
        this.bufferMemory = {
            chatHistory: new ChatMessageHistory(),
            maxTokenLimit,
            async loadMemoryVariables() {
                const messages = await this.chatHistory.getMessages();
                return {
                    history: messages.map(msg => ({
                        role: msg instanceof HumanMessage ? 'user' : 'assistant',
                        content: msg.content,
                    })),
                };
            },
            async saveContext({ input }, { output }) {
                await this.chatHistory.addUserMessage(input);
                await this.chatHistory.addAIMessage(output);

                // Trim if too many messages (simple token limit approximation)
                const messages = await this.chatHistory.getMessages();
                if (messages.length > 20) {
                    // Keep only last 20 messages
                    const recentMessages = messages.slice(-20);
                    await this.chatHistory.clear();
                    for (const msg of recentMessages) {
                        if (msg instanceof HumanMessage) {
                            await this.chatHistory.addUserMessage(msg.content);
                        } else {
                            await this.chatHistory.addAIMessage(msg.content);
                        }
                    }
                }
            },
        };
        return this.bufferMemory;
    }

    /**
     * Initialize summary memory (long-term, compressed)
     * Note: Requires LLM, so we'll use a simple approach for now
     */
    async initializeSummaryMemory(llm = null) {
        // For now, we'll use a simple buffer with manual summarization
        // Full ConversationSummaryMemory requires LLM which we call via API
        this.summaryMemory = {
            summary: '',
            messages: [],
            async addMessage(input, output) {
                this.messages.push({ input, output, timestamp: new Date().toISOString() });
                // Keep only last 20 messages
                if (this.messages.length > 20) {
                    this.messages = this.messages.slice(-20);
                }
            },
            async getSummary() {
                return this.summary || 'No summary available yet.';
            },
        };
        return this.summaryMemory;
    }

    /**
     * Initialize vector store memory (semantic memory retrieval)
     */
    async initializeVectorMemory() {
        try {
            const vectorStore = await createLanceDBVectorStore();

            this.vectorMemory = {
                vectorStore,
                async addMessage(input, output) {
                    // Store conversation as embedding
                    const conversationText = `User: ${input}\nAssistant: ${output}`;
                    try {
                        const embeddingResult = await generateEmbedding(conversationText);
                        await vectorStore.addDocuments(
                            [new (await import('@langchain/core/documents')).Document({
                                pageContent: conversationText,
                                metadata: {
                                    type: 'conversation',
                                    timestamp: new Date().toISOString(),
                                    input,
                                    output,
                                },
                            })],
                            [embeddingResult.embedding]
                        );
                    } catch (error) {
                        logger.debug('Error storing conversation in vector memory:', error.message);
                    }
                },
                async searchRelevant(queryEmbedding, k = 3) {
                    try {
                        const results = await vectorStore.similaritySearch(queryEmbedding, k);
                        return results.map(doc => doc.pageContent);
                    } catch (error) {
                        logger.debug('Error searching vector memory:', error.message);
                        return [];
                    }
                },
            };
            return this.vectorMemory;
        } catch (error) {
            logger.error('Error initializing vector memory:', error);
            return null;
        }
    }

    /**
     * Track entities (user preferences, important facts)
     */
    trackEntity(entityType, entityValue, metadata = {}) {
        if (!this.entityMemory.has(entityType)) {
            this.entityMemory.set(entityType, new Map());
        }
        const typeMap = this.entityMemory.get(entityType);
        typeMap.set(entityValue, {
            ...metadata,
            lastSeen: new Date().toISOString(),
            count: (typeMap.get(entityValue)?.count || 0) + 1,
        });
    }

    /**
     * Get entity information
     */
    getEntity(entityType, entityValue) {
        return this.entityMemory.get(entityType)?.get(entityValue) || null;
    }

    /**
     * Get all entities of a type
     */
    getAllEntities(entityType) {
        const typeMap = this.entityMemory.get(entityType);
        if (!typeMap) return [];
        return Array.from(typeMap.entries()).map(([value, data]) => ({
            value,
            ...data,
        }));
    }

    /**
     * Track entities mentioned in conversation
     */
    trackEntity(entity, context) {
        if (!this.entityMemory.has(entity)) {
            this.entityMemory.set(entity, []);
        }
        this.entityMemory.get(entity).push({
            context,
            timestamp: new Date().toISOString(),
        });

        // Keep only last 10 mentions per entity
        const mentions = this.entityMemory.get(entity);
        if (mentions.length > 10) {
            this.entityMemory.set(entity, mentions.slice(-10));
        }
    }

    /**
     * Get entity context
     */
    getEntityContext(entity) {
        const mentions = this.entityMemory.get(entity) || [];
        return mentions.map(m => m.context).join('\n');
    }

    /**
     * Extract entities from text (simple implementation)
     */
    extractEntities(text) {
        // Simple entity extraction - can be enhanced with NER
        const entities = [];
        const patterns = [
            /\b\d+(?:th|st|nd|rd)\s+class\b/gi,
            /\b\d+%\b/g,
            /\b(?:result|grade|score|exam|test)\b/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                entities.push(...matches);
            }
        }

        return [...new Set(entities)];
    }

    /**
     * Get memory context for a query
     */
    async getMemoryContext(query, options = {}) {
        const {
            useBuffer = true,
            useSummary = false,
            useVector = true,
            useEntities = true,
            maxContextLength = 2000,
        } = options;

        const contextParts = [];

        // Buffer memory (recent messages)
        if (useBuffer && this.bufferMemory) {
            try {
                const history = await this.bufferMemory.loadMemoryVariables({});
                if (history.history && history.history.length > 0) {
                    const recentMessages = history.history
                        .slice(-5) // Last 5 messages
                        .map(msg => `${msg.role || 'user'}: ${msg.content || ''}`)
                        .join('\n');
                    contextParts.push(`Recent conversation:\n${recentMessages}`);
                }
            } catch (error) {
                logger.debug('Error loading buffer memory:', error.message);
            }
        }

        // Summary memory
        if (useSummary && this.summaryMemory) {
            try {
                const summary = await this.summaryMemory.getSummary();
                if (summary) {
                    contextParts.push(`Conversation summary: ${summary}`);
                }
            } catch (error) {
                logger.debug('Error loading summary memory:', error.message);
            }
        }

        // Vector memory (semantic search)
        if (useVector && this.vectorMemory) {
            try {
                const embeddingResult = await generateEmbedding(query);
                const relevantMemories = await this.vectorMemory.searchRelevant(
                    embeddingResult.embedding,
                    3
                );
                if (relevantMemories.length > 0) {
                    contextParts.push(`Relevant past conversations:\n${relevantMemories.join('\n\n')}`);
                }
            } catch (error) {
                logger.debug('Error searching vector memory:', error.message);
            }
        }

        // Entity memory (user preferences)
        if (useEntities) {
            const preferences = this.getAllEntities('preference');
            const facts = this.getAllEntities('fact');
            if (preferences.length > 0 || facts.length > 0) {
                const entityInfo = [];
                if (preferences.length > 0) {
                    entityInfo.push(`User preferences: ${preferences.map(p => p.value).join(', ')}`);
                }
                if (facts.length > 0) {
                    entityInfo.push(`Known facts: ${facts.map(f => f.value).join(', ')}`);
                }
                contextParts.push(entityInfo.join('\n'));
            }
        }

        const fullContext = contextParts.join('\n\n');

        // Truncate if too long
        if (fullContext.length > maxContextLength) {
            return fullContext.substring(0, maxContextLength) + '...';
        }

        return fullContext;
    }

    /**
     * Save message to all active memories
     */
    async saveMessage(input, output) {
        // Buffer memory
        if (this.bufferMemory) {
            try {
                await this.bufferMemory.saveContext({ input }, { output });
            } catch (error) {
                logger.debug('Error saving to buffer memory:', error.message);
            }
        }

        // Summary memory
        if (this.summaryMemory) {
            try {
                await this.summaryMemory.addMessage(input, output);
            } catch (error) {
                logger.debug('Error saving to summary memory:', error.message);
            }
        }

        // Vector memory
        if (this.vectorMemory) {
            try {
                await this.vectorMemory.addMessage(input, output);
            } catch (error) {
                logger.debug('Error saving to vector memory:', error.message);
            }
        }
    }

    /**
     * Clear all memories
     */
    clear() {
        this.bufferMemory = null;
        this.summaryMemory = null;
        this.vectorMemory = null;
        this.entityMemory.clear();
    }
}

// Singleton instance
let memoryManagerInstance = null;

/**
 * Get memory manager instance
 */
async function getMemoryManager() {
    if (!memoryManagerInstance) {
        memoryManagerInstance = new MemoryManager();

        // Initialize memories
        memoryManagerInstance.initializeBufferMemory();
        await memoryManagerInstance.initializeSummaryMemory();
        await memoryManagerInstance.initializeVectorMemory();

        logger.info('Memory manager initialized');
    }
    return memoryManagerInstance;
}

export { getMemoryManager, MemoryManager };