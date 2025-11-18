import logger from '../../utils/logger.js';

/**
 * Enhanced Error Handler - Graceful failures, fallbacks, retry logic
 */
class ErrorHandler {
    constructor() {
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Handle error with fallback
     */
    async handleWithFallback(primaryFn, fallbackFn, errorMessage = 'Operation failed') {
        try {
            return await primaryFn();
        } catch (error) {
            logger.warn(`${errorMessage}, trying fallback:`, error.message);
            try {
                return await fallbackFn();
            } catch (fallbackError) {
                logger.error('Fallback also failed:', fallbackError);
                throw new Error(`${errorMessage}: ${error.message}. Fallback failed: ${fallbackError.message}`);
            }
        }
    }

    /**
     * Retry with exponential backoff
     */
    async retryWithBackoff(fn, maxRetries = this.maxRetries, delay = this.retryDelay) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    const backoffDelay = delay * Math.pow(2, attempt);
                    logger.debug(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Format user-friendly error message
     */
    formatUserError(error, context = {}) {
        const errorMessages = {
            'timeout': 'The operation took too long. Please try again with a simpler query.',
            'network': 'Unable to connect to the AI service. Please check your connection.',
            'not_found': 'The requested information was not found in your knowledge base.',
            'permission': 'Permission denied. Please check file access permissions.',
            'invalid_input': 'Invalid input provided. Please check your query.',
        };

        // Check for known error patterns
        const errorMessage = error.message || String(error);
        for (const [key, message] of Object.entries(errorMessages)) {
            if (errorMessage.toLowerCase().includes(key)) {
                return message;
            }
        }

        // Generic error with context
        if (context.operation) {
            return `Error during ${context.operation}: ${errorMessage}`;
        }

        return `An error occurred: ${errorMessage}`;
    }

    /**
     * Handle tool execution error
     */
    handleToolError(toolName, error, input) {
        const userMessage = this.formatUserError(error, {
            operation: `tool execution (${toolName})`,
        });

        logger.error(`Tool ${toolName} failed:`, {
            error: error.message,
            input,
        });

        return {
            success: false,
            tool: toolName,
            error: userMessage,
            technicalError: error.message,
        };
    }

    /**
     * Wrap function with error handling
     */
    wrapWithErrorHandling(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                const userMessage = this.formatUserError(error, context);
                logger.error('Error in wrapped function:', {
                    context,
                    error: error.message,
                    stack: error.stack,
                });
                throw new Error(userMessage);
            }
        };
    }
}

// Singleton instance
let errorHandlerInstance = null;

export function getErrorHandler() {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler();
    }
    return errorHandlerInstance;
}