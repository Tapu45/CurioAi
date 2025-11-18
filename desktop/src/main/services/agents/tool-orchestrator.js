import logger from '../../utils/logger.js';

/**
 * Tool Orchestrator - Coordinates multiple tool executions
 */
class ToolOrchestrator {
    constructor() {
        this.toolCache = new Map();
    }

    /**
     * Execute tools in parallel where possible
     */
    async executeParallel(tools, params) {
        try {
            const results = await Promise.allSettled(
                tools.map(tool => tool.execute(params))
            );

            return results.map((result, index) => ({
                tool: tools[index].name,
                success: result.status === 'fulfilled',
                result: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason.message : null,
            }));
        } catch (error) {
            logger.error('Error executing tools in parallel:', error);
            throw error;
        }
    }

    /**
     * Execute tools sequentially
     */
    async executeSequential(tools, params, usePreviousResult = false) {
        try {
            const results = [];
            let previousResult = null;

            for (const tool of tools) {
                try {
                    const toolParams = usePreviousResult && previousResult
                        ? { ...params, previousResult }
                        : params;

                    const result = await tool.execute(toolParams);
                    results.push({
                        tool: tool.name,
                        success: true,
                        result,
                    });

                    previousResult = result;
                } catch (error) {
                    results.push({
                        tool: tool.name,
                        success: false,
                        error: error.message || String(error),
                    });
                    // Continue with next tool even if one fails
                    logger.warn(`Tool ${tool.name} failed, continuing:`, error.message);
                }
            }

            return results;
        } catch (error) {
            logger.error('Error executing tools sequentially:', error);
            throw error;
        }
    }

    /**
     * Merge results from multiple tools
     */
    mergeResults(toolResults) {
        const merged = {
            success: true,
            results: [],
            errors: [],
            sources: [],
        };

        for (const toolResult of toolResults) {
            if (toolResult.success) {
                merged.results.push(toolResult.result);

                // Extract sources if available
                if (toolResult.result?.sources) {
                    merged.sources.push(...toolResult.result.sources);
                } else if (toolResult.result?.files) {
                    merged.sources.push(...toolResult.result.files);
                } else if (toolResult.result?.data) {
                    merged.sources.push(...toolResult.result.data);
                }
            } else {
                merged.errors.push({
                    tool: toolResult.tool,
                    error: toolResult.error,
                });
                merged.success = false;
            }
        }

        return merged;
    }

    /**
     * Cache tool result
     */
    cacheResult(cacheKey, result, ttl = 3600000) { // 1 hour default
        this.toolCache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * Get cached result
     */
    getCachedResult(cacheKey) {
        const cached = this.toolCache.get(cacheKey);
        if (!cached) {
            return null;
        }

        if (Date.now() - cached.timestamp > cached.ttl) {
            this.toolCache.delete(cacheKey);
            return null;
        }

        return cached.result;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.toolCache.clear();
    }
}

// Singleton instance
let toolOrchestratorInstance = null;

export function getToolOrchestrator() {
    if (!toolOrchestratorInstance) {
        toolOrchestratorInstance = new ToolOrchestrator();
    }
    return toolOrchestratorInstance;
}