import { getReActAgent } from './react-agent.js';
import { RAGSearchTool } from './tools/rag-search-tool.js';
import { FileSearchTool } from './tools/file-search-tool.js';
import logger from '../../utils/logger.js';

/**
 * Agent Manager - Orchestrates agent initialization and tool registration
 */
class AgentManager {
    constructor() {
        this.agent = null;
        this.tools = new Map();
        this.initialized = false;
    }

    /**
     * Initialize agent manager
     */
    async initialize(options = {}) {
        try {
            if (this.initialized) {
                return;
            }

            // Get ReAct agent
            this.agent = getReActAgent(options);

            // Register basic tools
            await this.registerBasicTools();

            // Initialize agent
            await this.agent.initialize();

            this.initialized = true;
            logger.info('Agent manager initialized');
        } catch (error) {
            logger.error('Error initializing agent manager:', error);
            throw error;
        }
    }

    /**
     * Register basic tools
     */
    async registerBasicTools() {
        // RAG Search Tool
        const ragSearchTool = new RAGSearchTool();
        await ragSearchTool.initialize();
        this.registerTool(ragSearchTool);

        // File Search Tool
        const fileSearchTool = new FileSearchTool();
        this.registerTool(fileSearchTool);

        logger.info('Basic tools registered');
    }

    /**
     * Register a tool
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        if (this.agent) {
            this.agent.registerTool(tool);
        }
    }

    /**
     * Get a tool by name
     */
    getTool(name) {
        return this.tools.get(name);
    }

    /**
     * Get all tools
     */
    getAllTools() {
        return Array.from(this.tools.values());
    }

    /**
     * Process query with agent
     */
    async processQuery(query, options = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            return await this.agent.processQuery(query, options);
        } catch (error) {
            logger.error('Error processing query with agent:', error);
            throw error;
        }
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            toolCount: this.tools.size,
            tools: Array.from(this.tools.keys()),
        };
    }
}

// Singleton instance
let agentManagerInstance = null;

export function getAgentManager(options = {}) {
    if (!agentManagerInstance) {
        agentManagerInstance = new AgentManager();
    }
    return agentManagerInstance;
}