import logger from '../../utils/logger.js';

/**
 * Performance Optimizer - Caching, parallel execution, lazy loading
 */
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.defaultTTL = 3600000; // 1 hour
        this.maxCacheSize = 1000;
    }

    /**
     * Cache result with TTL
     */
    cache(key, value, ttl = this.defaultTTL) {
        try {
            // Evict old entries if cache is full
            if (this.cache.size >= this.maxCacheSize) {
                this.evictOldest();
            }

            this.cache.set(key, value);
            this.cacheTimestamps.set(key, Date.now() + ttl);
        } catch (error) {
            logger.debug('Error caching result:', error);
        }
    }

    /**
     * Get cached result
     */
    get(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (!timestamp || Date.now() > timestamp) {
            // Expired or not found
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
            return null;
        }
        return this.cache.get(key);
    }

    /**
     * Evict oldest cache entries
     */
    evictOldest() {
        const entries = Array.from(this.cacheTimestamps.entries())
            .sort((a, b) => a[1] - b[1]); // Sort by timestamp

        // Remove oldest 10%
        const toRemove = Math.ceil(this.cache.size * 0.1);
        for (let i = 0; i < toRemove; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
        }
    }

    /**
     * Clear cache
     */
    clear() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Execute functions in parallel with concurrency limit
     */
    async executeParallel(functions, concurrency = 3) {
        const results = [];
        const executing = [];

        for (const fn of functions) {
            const promise = Promise.resolve(fn()).then(result => {
                executing.splice(executing.indexOf(promise), 1);
                return result;
            });

            executing.push(promise);
            results.push(promise);

            if (executing.length >= concurrency) {
                await Promise.race(executing);
            }
        }

        return Promise.allSettled(results);
    }

    /**
     * Execute with timeout
     */
    async executeWithTimeout(fn, timeout = 30000, errorMessage = 'Operation timeout') {
        return Promise.race([
            Promise.resolve(fn()),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(errorMessage)), timeout)
            ),
        ]);
    }

    /**
     * Batch process items
     */
    async batchProcess(items, processor, batchSize = 10) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(item => processor(item))
            );
            results.push(...batchResults);
        }
        return results;
    }

    /**
     * Lazy load function (memoized)
     */
    lazyLoad(key, loader) {
        return async () => {
            const cached = this.get(key);
            if (cached) {
                return cached;
            }

            const value = await loader();
            this.cache(key, value);
            return value;
        };
    }
}

// Singleton instance
let performanceOptimizerInstance = null;

export function getPerformanceOptimizer() {
    if (!performanceOptimizerInstance) {
        performanceOptimizerInstance = new PerformanceOptimizer();
    }
    return performanceOptimizerInstance;
}