import { EventEmitter } from 'events';
import logger from '../../utils/logger.js';

/**
 * Agent Status Tracker - Tracks agent reasoning steps and progress
 */
class AgentStatusTracker extends EventEmitter {
    constructor() {
        super();
        this.currentQuery = null;
        this.reasoningSteps = [];
        this.toolCalls = [];
        this.progress = 0;
        this.status = 'idle'; // idle, thinking, executing, completed, error
    }

    /**
     * Start tracking a query
     */
    startQuery(query) {
        this.currentQuery = query;
        this.reasoningSteps = [];
        this.toolCalls = [];
        this.progress = 0;
        this.status = 'thinking';
        this.emit('status', {
            status: this.status,
            query,
            progress: 0,
        });
    }

    /**
     * Add reasoning step
     */
    addReasoningStep(step) {
        this.reasoningSteps.push({
            ...step,
            timestamp: new Date().toISOString(),
            stepNumber: this.reasoningSteps.length + 1,
        });
        this.emit('reasoning', {
            step: this.reasoningSteps[this.reasoningSteps.length - 1],
            allSteps: this.reasoningSteps,
        });
    }

    /**
     * Add tool call
     */
    addToolCall(toolCall) {
        this.toolCalls.push({
            ...toolCall,
            timestamp: new Date().toISOString(),
            callNumber: this.toolCalls.length + 1,
        });
        this.emit('toolCall', {
            toolCall: this.toolCalls[this.toolCalls.length - 1],
            allCalls: this.toolCalls,
        });
    }

    /**
     * Update progress
     */
    updateProgress(progress, status = null) {
        this.progress = Math.min(100, Math.max(0, progress));
        if (status) {
            this.status = status;
        }
        this.emit('progress', {
            progress: this.progress,
            status: this.status,
        });
    }

    /**
     * Complete query
     */
    completeQuery(result) {
        this.status = 'completed';
        this.progress = 100;
        this.emit('complete', {
            status: this.status,
            result,
            reasoningSteps: this.reasoningSteps,
            toolCalls: this.toolCalls,
        });
        this.reset();
    }

    /**
     * Error occurred
     */
    error(error) {
        this.status = 'error';
        this.emit('error', {
            status: this.status,
            error: error.message || String(error),
            reasoningSteps: this.reasoningSteps,
            toolCalls: this.toolCalls,
        });
        this.reset();
    }

    /**
     * Reset tracker
     */
    reset() {
        setTimeout(() => {
            this.currentQuery = null;
            this.reasoningSteps = [];
            this.toolCalls = [];
            this.progress = 0;
            this.status = 'idle';
        }, 5000); // Keep data for 5 seconds after completion
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            status: this.status,
            query: this.currentQuery,
            progress: this.progress,
            reasoningSteps: this.reasoningSteps,
            toolCalls: this.toolCalls,
        };
    }
}

// Singleton instance
let agentStatusTrackerInstance = null;

export function getAgentStatusTracker() {
    if (!agentStatusTrackerInstance) {
        agentStatusTrackerInstance = new AgentStatusTracker();
    }
    return agentStatusTrackerInstance;
}