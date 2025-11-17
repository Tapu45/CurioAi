import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { processFile } from './file-processor.js';
import { insertFile, getFileByHash, getFileByPath, insertFileChunk } from '../storage/sqlite-db.js';
import { storeEmbedding } from '../storage/lancedb-client.js';
import { generateEmbedding } from './ai-service-client.js';
import logger from '../utils/logger.js';

// Chunking configuration
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

/**
 * Calculate SHA-256 hash of file for deduplication
 */
async function calculateFileHash(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (error) {
        logger.error('Error calculating file hash:', error);
        return null;
    }
}

/**
 * Split text into chunks with overlap
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    if (!text || text.length === 0) {
        return [];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.slice(start, end);

        chunks.push({
            content: chunk,
            index: chunks.length,
            start,
            end,
        });

        // Move start forward, accounting for overlap
        start = end - overlap;
        if (start >= text.length) break;
    }

    return chunks;
}

/**
 * Index a single file
 */
async function indexFile(filePath, options = {}) {
    try {
        const { forceReindex = false, generateEmbeddings = true } = options;

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            logger.warn(`File not found: ${filePath}`);
            return { success: false, reason: 'file_not_found' };
        }

        // Get file stats
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const modifiedTime = stats.mtime.toISOString();

        // Calculate hash
        const hash = await calculateFileHash(filePath);
        if (!hash) {
            return { success: false, reason: 'hash_calculation_failed' };
        }

        // Check if file already indexed (deduplication)
        if (!forceReindex) {
            const existingFile = await getFileByHash(hash);
            if (existingFile) {
                // Check if file was modified
                if (existingFile.processedAt && new Date(existingFile.processedAt) >= stats.mtime) {
                    logger.debug(`File already indexed (unchanged): ${path.basename(filePath)}`);
                    return {
                        success: true,
                        fileId: existingFile.id,
                        skipped: true,
                        reason: 'already_indexed',
                    };
                }
            }
        }

        // Process file to extract content
        logger.info(`Indexing file: ${path.basename(filePath)}`);
        const extracted = await processFile({ path: filePath, name: path.basename(filePath) });

        if (!extracted || !extracted.content || extracted.content.trim().length === 0) {
            logger.debug(`No content extracted from: ${path.basename(filePath)}`);
            // Still store file metadata even if no content
        }

        // Determine file type
        const fileType = extracted.extension || path.extname(filePath).replace('.', '') || 'unknown';
        const mimeType = extracted.fileType || 'application/octet-stream';

        // Store file in database
        const fileId = await insertFile({
            path: filePath,
            name: path.basename(filePath),
            type: fileType,
            mimeType,
            size: fileSize,
            hash,
            extractedText: extracted.content || '',
            metadata: JSON.stringify(extracted.metadata || {}),
            processedAt: new Date().toISOString(),
        });

        logger.info(`File indexed: ${path.basename(filePath)} (ID: ${fileId})`);

        // Chunk and process content if available
        let chunksProcessed = 0;
        if (extracted.content && extracted.content.trim().length > 0) {
            const chunks = chunkText(extracted.content);

            for (const chunk of chunks) {
                try {
                    // Store chunk
                    const chunkId = await insertFileChunk({
                        fileId,
                        chunkIndex: chunk.index,
                        content: chunk.content,
                        metadata: JSON.stringify({
                            start: chunk.start,
                            end: chunk.end,
                        }),
                    });

                    // Generate embedding if enabled
                    if (generateEmbeddings) {
                        try {
                            const embeddingResult = await generateEmbedding(chunk.content);
                            if (embeddingResult && embeddingResult.embedding) {
                                // Store embedding in LanceDB
                                await storeEmbedding({
                                    id: `file_${fileId}_chunk_${chunk.index}`,
                                    embedding: embeddingResult.embedding,
                                    document: chunk.content,
                                    metadata: {
                                        file_id: fileId,
                                        chunk_index: chunk.index,
                                        file_path: filePath,
                                        file_name: path.basename(filePath),
                                        file_type: fileType,
                                        title: extracted.title || path.basename(filePath),
                                    },
                                });
                            }
                        } catch (embedError) {
                            logger.warn(`Failed to generate embedding for chunk ${chunk.index}:`, embedError.message);
                        }
                    }

                    chunksProcessed++;
                } catch (chunkError) {
                    logger.error(`Error processing chunk ${chunk.index}:`, chunkError);
                }
            }
        }

        return {
            success: true,
            fileId,
            chunksProcessed,
            contentLength: extracted.content?.length || 0,
        };
    } catch (error) {
        logger.error(`Error indexing file ${filePath}:`, error instanceof Error ? error : new Error(String(error)));
        return {
            success: false,
            reason: 'indexing_error',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Index multiple files (batch processing)
 */
async function indexFiles(filePaths, options = {}) {
    const { batchSize = 10, onProgress } = options;
    const results = {
        successful: 0,
        failed: 0,
        skipped: 0,
        total: filePaths.length,
    };

    for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
            batch.map(filePath => indexFile(filePath, options))
        );

        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (data.success) {
                    if (data.skipped) {
                        results.skipped++;
                    } else {
                        results.successful++;
                    }
                } else {
                    results.failed++;
                }
            } else {
                results.failed++;
                logger.error(`Batch indexing failed for ${batch[index]}:`, result.reason);
            }
        });

        // Report progress
        if (onProgress) {
            onProgress({
                processed: Math.min(i + batchSize, filePaths.length),
                total: filePaths.length,
                results,
            });
        }
    }

    return results;
}

export { indexFile, indexFiles, chunkText, calculateFileHash };