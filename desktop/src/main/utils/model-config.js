/**
 * Model Configuration for different system tiers
 * Optimized for low-end to high-end systems
 */

export const MODEL_TIERS = {
    LOW_END: {
        name: 'Low-End',
        description: 'Optimized for systems with 4GB+ RAM',
        minRAM: 4, // GB
        minCPU: 2, // cores
        embedding: {
            model: 'all-MiniLM-L6-v2',
            dimension: 384,
            size: 22, // MB
            description: 'Fast, lightweight embedding model',
        },
        llm: {
            model: 'phi3:mini',
            size: 2.3, // GB
            params: '3.8B',
            description: 'Microsoft Phi-3 Mini - Fast and efficient',
            speed: 'fast',
            quality: 'good',
        },
        nlp: {
            model: 'en_core_web_sm',
            size: 12, // MB
            description: 'Small spaCy model for NER',
        },
        classifier: {
            model: 'rule-based',
            method: 'rule-based',
            description: 'Fast rule-based classification',
        },
        recommended: true, // Recommended for most users
    },
    MID_RANGE: {
        name: 'Mid-Range',
        description: 'Optimized for systems with 8GB+ RAM',
        minRAM: 8,
        minCPU: 4,
        embedding: {
            model: 'all-MiniLM-L6-v2',
            dimension: 384,
            size: 22,
            description: 'Fast, lightweight embedding model',
        },
        llm: {
            model: 'llama3.2:1b',
            size: 1.3, // GB
            params: '1B',
            description: 'Meta Llama 3.2 1B - Very fast, good quality',
            speed: 'very-fast',
            quality: 'good',
        },
        nlp: {
            model: 'en_core_web_sm',
            size: 12,
            description: 'Small spaCy model for NER',
        },
        classifier: {
            model: 'rule-based',
            method: 'rule-based',
            description: 'Fast rule-based classification',
        },
        recommended: true,
    },
    HIGH_END: {
        name: 'High-End',
        description: 'Optimized for systems with 16GB+ RAM',
        minRAM: 16,
        minCPU: 4,
        embedding: {
            model: 'all-MiniLM-L6-v2', // Can upgrade to all-mpnet-base-v2 if needed
            dimension: 384,
            size: 22,
            description: 'Fast embedding model (can upgrade to mpnet for better quality)',
        },
        llm: {
            model: 'llama3.2:3b',
            size: 2.0, // GB
            params: '3B',
            description: 'Meta Llama 3.2 3B - Balanced performance and quality',
            speed: 'fast',
            quality: 'very-good',
        },
        nlp: {
            model: 'en_core_web_sm', // Can upgrade to en_core_web_md
            size: 12,
            description: 'Small spaCy model (can upgrade to medium for better NER)',
        },
        classifier: {
            model: 'distilbert-base-uncased',
            method: 'ml',
            description: 'ML-based classification using DistilBERT',
        },
        recommended: false,
    },
    PREMIUM: {
        name: 'Premium',
        description: 'Best quality, requires 16GB+ RAM and good GPU',
        minRAM: 16,
        minCPU: 6,
        embedding: {
            model: 'all-mpnet-base-v2',
            dimension: 768,
            size: 420, // MB
            description: 'High-quality embedding model',
        },
        llm: {
            model: 'mistral:7b',
            size: 4.1, // GB
            params: '7B',
            description: 'Mistral 7B - Best quality, slower',
            speed: 'moderate',
            quality: 'excellent',
        },
        nlp: {
            model: 'en_core_web_md',
            size: 40, // MB
            description: 'Medium spaCy model with better NER',
        },
        classifier: {
            model: 'distilbert-base-uncased',
            method: 'ml',
            description: 'ML-based classification using DistilBERT',
        },
        recommended: false,
    },
};

/**
 * Get model tier based on system resources
 */
export function getRecommendedTier(systemInfo) {
    const { totalRAM, cpuCores } = systemInfo;

    // Check from highest to lowest
    if (totalRAM >= MODEL_TIERS.PREMIUM.minRAM && cpuCores >= MODEL_TIERS.PREMIUM.minCPU) {
        return 'PREMIUM';
    }
    if (totalRAM >= MODEL_TIERS.HIGH_END.minRAM && cpuCores >= MODEL_TIERS.HIGH_END.minCPU) {
        return 'HIGH_END';
    }
    if (totalRAM >= MODEL_TIERS.MID_RANGE.minRAM && cpuCores >= MODEL_TIERS.MID_RANGE.minCPU) {
        return 'MID_RANGE';
    }
    return 'LOW_END';
}

/**
 * Get model configuration for a tier
 */
export function getModelConfig(tier) {
    return MODEL_TIERS[tier] || MODEL_TIERS.MID_RANGE;
}

/**
 * Get all available LLM models
 */
export function getAvailableLLMModels() {
    return Object.values(MODEL_TIERS).map(tier => ({
        id: tier.llm.model,
        name: tier.llm.model,
        size: tier.llm.size,
        params: tier.llm.params,
        description: tier.llm.description,
        speed: tier.llm.speed,
        quality: tier.llm.quality,
        tier: tier.name,
    }));
}

/**
 * Get all available embedding models
 */
export function getAvailableEmbeddingModels() {
    const models = new Map();
    Object.values(MODEL_TIERS).forEach(tier => {
        if (!models.has(tier.embedding.model)) {
            models.set(tier.embedding.model, {
                id: tier.embedding.model,
                name: tier.embedding.model,
                dimension: tier.embedding.dimension,
                size: tier.embedding.size,
                description: tier.embedding.description,
            });
        }
    });
    return Array.from(models.values());
}