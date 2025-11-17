import { getAllEmbeddings as getAllChromaEmbeddings } from './chromadb-client.js';
import { storeEmbedding as storeLanceEmbedding, initializeLanceDB } from './lancedb-client.js';
import logger from '../utils/logger.js';

/**
 * Migrate all embeddings from ChromaDB to LanceDB
 * This script should be run once during the migration phase
 */
async function migrateChromaToLance() {
    try {
        logger.info('Starting migration from ChromaDB to LanceDB...');

        // Initialize LanceDB
        await initializeLanceDB();
        logger.info('LanceDB initialized for migration');

        // Get all embeddings from ChromaDB
        logger.info('Fetching embeddings from ChromaDB...');
        let allEmbeddings = null;
        let offset = 0;
        const batchSize = 100;
        let totalMigrated = 0;
        let totalFailed = 0;

        try {
            // Try to get all embeddings
            allEmbeddings = await getAllChromaEmbeddings(10000, 0); // Large limit

            if (!allEmbeddings || !allEmbeddings.ids || allEmbeddings.ids.length === 0) {
                logger.info('No embeddings found in ChromaDB. Migration complete (empty).');
                return {
                    success: true,
                    migrated: 0,
                    failed: 0,
                    message: 'No embeddings to migrate',
                };
            }

            logger.info(`Found ${allEmbeddings.ids.length} embeddings in ChromaDB`);

            // Migrate each embedding
            for (let i = 0; i < allEmbeddings.ids.length; i++) {
                try {
                    const id = allEmbeddings.ids[i];
                    const embedding = allEmbeddings.embeddings[i];
                    const document = allEmbeddings.documents[i] || '';
                    const metadata = allEmbeddings.metadatas[i] || {};

                    await storeLanceEmbedding({
                        id,
                        embedding,
                        document,
                        metadata,
                    });

                    totalMigrated++;

                    // Log progress every 10 items
                    if ((i + 1) % 10 === 0) {
                        logger.info(`Migration progress: ${i + 1}/${allEmbeddings.ids.length} (${totalMigrated} migrated, ${totalFailed} failed)`);
                    }
                } catch (error) {
                    totalFailed++;
                    logger.error(`Failed to migrate embedding ${allEmbeddings.ids[i]}:`, error instanceof Error ? error.message : String(error));
                    // Continue with next embedding
                }
            }

            logger.info(`Migration completed: ${totalMigrated} migrated, ${totalFailed} failed`);

            return {
                success: totalFailed === 0,
                migrated: totalMigrated,
                failed: totalFailed,
                total: allEmbeddings.ids.length,
            };
        } catch (chromaError) {
            // ChromaDB might not be available or empty
            if (chromaError.message && chromaError.message.includes('not available')) {
                logger.warn('ChromaDB not available. Starting fresh with LanceDB.');
                return {
                    success: true,
                    migrated: 0,
                    failed: 0,
                    message: 'ChromaDB not available, starting fresh',
                };
            }
            throw chromaError;
        }
    } catch (error) {
        logger.error('Migration failed:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

/**
 * Verify migration by comparing counts
 */
async function verifyMigration() {
    try {
        const { countEmbeddings: countLance } = await import('./lancedb-client.js');
        const { countEmbeddings: countChroma } = await import('./chromadb-client.js');

        let chromaCount = 0;
        let lanceCount = 0;

        try {
            chromaCount = await countChroma();
        } catch (error) {
            logger.debug('Could not count ChromaDB embeddings (may not be available):', error.message);
        }

        try {
            lanceCount = await countLance();
        } catch (error) {
            logger.error('Could not count LanceDB embeddings:', error);
            throw error;
        }

        logger.info(`Migration verification: ChromaDB=${chromaCount}, LanceDB=${lanceCount}`);

        return {
            chromaCount,
            lanceCount,
            match: chromaCount === lanceCount,
        };
    } catch (error) {
        logger.error('Verification failed:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

export { migrateChromaToLance, verifyMigration };