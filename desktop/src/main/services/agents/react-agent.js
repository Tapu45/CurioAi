import { ChatOllama } from '@langchain/ollama';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getMemoryManager } from '../../memory-manager.js';
import logger from '../../utils/logger.js';
import { getAIServiceURL } from '../ai-service-client.js';

/**
 * ReAct Agent Implementation using LangChain
 */
class ReActAgent {
    constructor(options = {}) {
        this.options = {
            model: options.model || 'llama3.2',
            temperature: options.temperature || 0.1,
            maxIterations: options.maxIterations || 10,
            verbose: options.verbose !== false,
        };
        this.tools = [];
        this.agent = null;
        this.executor = null;
        this.memoryManager = null;
    }

    /**
     * Initialize the agent
     */
    async initialize() {
        try {
            // Initialize LLM
            const llm = new ChatOllama({
                model: this.options.model,
                baseUrl: getAIServiceURL().replace('/api/v1', '') || 'http://127.0.0.1:11434',
                temperature: this.options.temperature,
            });

            // Initialize memory
            this.memoryManager = await getMemoryManager();

            // Create agent prompt
            const prompt = await this.createAgentPrompt();

            // Create ReAct agent
            this.agent = await createReactAgent({
                llm,
                tools: this.tools.map(tool => tool.toLangChainTool()),
                prompt,
            });

            // Create executor
            this.executor = new AgentExecutor({
                agent: this.agent,
                tools: this.tools.map(tool => tool.toLangChainTool()),
                maxIterations: this.options.maxIterations,
                verbose: this.options.verbose,
            });

            logger.info('ReAct agent initialized');
        } catch (error) {
            logger.error('Error initializing ReAct agent:', error);
            throw error;
        }
    }

    /**
     * Create agent prompt
     */
    async createAgentPrompt() {
        const promptTemplate = `You are CurioAI, a helpful personal learning assistant. You have access to tools to help answer user questions.

You can use the following tools:
{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Previous conversation:
{chat_history}

Question: {input}
Thought: {agent_scratchpad}`;

        return ChatPromptTemplate.fromTemplate(promptTemplate);
    }

    /**
     * Register a tool
     */
    registerTool(tool) {
        this.tools.push(tool);
        logger.debug(`Tool registered: ${tool.name}`);
    }

    /**
     * Register multiple tools
     */
    registerTools(tools) {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }

    /**
     * Process a query with the agent
     */
    async processQuery(query, options = {}) {
        try {
            if (!this.executor) {
                await this.initialize();
            }

            // Get memory context
            let memoryContext = '';
            if (this.memoryManager && options.useMemory !== false) {
                try {
                    memoryContext = await this.memoryManager.getMemoryContext(query, {
                        useBuffer: true,
                        useVector: false, // Don't use vector memory in agent (tools handle retrieval)
                    });
                } catch (error) {
                    logger.debug('Error getting memory context:', error.message);
                }
            }

            // Build input with memory context
            const input = memoryContext
                ? `${memoryContext}\n\nUser Question: ${query}`
                : query;

            // Execute agent
            const result = await this.executor.invoke({
                input,
                chat_history: options.chatHistory || '',
            });

            // Save to memory
            if (this.memoryManager && options.useMemory !== false) {
                try {
                    await this.memoryManager.saveMessage(query, result.output);
                } catch (error) {
                    logger.debug('Error saving to memory:', error.message);
                }
            }

            // Extract tool usage from intermediate steps
            const toolCalls = [];
            if (result.intermediateSteps) {
                for (const step of result.intermediateSteps) {
                    if (step[0]?.tool) {
                        toolCalls.push({
                            tool: step[0].tool,
                            input: step[0].toolInput,
                            output: step[1],
                        });
                    }
                }
            }

            return {
                answer: result.output,
                toolCalls,
                iterations: result.intermediateSteps?.length || 0,
            };
        } catch (error) {
            logger.error('Error processing query with agent:', error);
            throw error;
        }
    }
}

// Singleton instance
let reactAgentInstance = null;

export function getReActAgent(options = {}) {
    if (!reactAgentInstance) {
        reactAgentInstance = new ReActAgent(options);
    }
    return reactAgentInstance;
}