import logger from '../../../utils/logger.js';

/**
 * Base Tool class for agent tools
 */
export class BaseTool {
    constructor(name, description, schema) {
        this.name = name;
        this.description = description;
        this.schema = schema;
    }

    /**
     * Execute the tool
     */
    async execute(params) {
        throw new Error('execute() must be implemented by subclass');
    }

    /**
     * Validate parameters
     */
    validateParams(params) {
        if (!this.schema || !this.schema.properties) {
            return { valid: true };
        }

        const errors = [];
        const required = this.schema.required || [];

        // Check required fields
        for (const field of required) {
            if (params[field] === undefined || params[field] === null) {
                errors.push(`Missing required parameter: ${field}`);
            }
        }

        // Validate types
        for (const [key, value] of Object.entries(params)) {
            const prop = this.schema.properties[key];
            if (prop) {
                if (prop.type === 'string' && typeof value !== 'string') {
                    errors.push(`Parameter ${key} must be a string`);
                } else if (prop.type === 'number' && typeof value !== 'number') {
                    errors.push(`Parameter ${key} must be a number`);
                } else if (prop.type === 'array' && !Array.isArray(value)) {
                    errors.push(`Parameter ${key} must be an array`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Format result for agent
     */
    formatResult(result, error = null) {
        if (error) {
            return {
                success: false,
                error: error.message || String(error),
                tool: this.name,
            };
        }

        return {
            success: true,
            result,
            tool: this.name,
        };
    }

    /**
     * Get tool definition for LangChain
     */
    toLangChainTool() {
        return {
            name: this.name,
            description: this.description,
            schema: this.schema,
            func: async (params) => {
                try {
                    const validation = this.validateParams(params);
                    if (!validation.valid) {
                        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
                    }

                    const result = await this.execute(params);
                    return JSON.stringify(this.formatResult(result));
                } catch (error) {
                    logger.error(`Error executing tool ${this.name}:`, error);
                    return JSON.stringify(this.formatResult(null, error));
                }
            },
        };
    }
}