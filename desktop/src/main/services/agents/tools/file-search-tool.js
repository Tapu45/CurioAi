import { BaseTool } from './base-tool.js';
import { getClient } from '../../../storage/sqlite-db.js';
import { semanticSearch } from '../../search-service.js';
import logger from '../../../utils/logger.js';

/**
 * File Search Tool - Search files by name, path, metadata
 */
export class FileSearchTool extends BaseTool {
    constructor() {
        super(
            'file_search',
            'Search for files in the indexed file system. Use this to find specific files, documents, or images by name, path, or content. Returns file information including path, type, and metadata.',
            {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query - can be filename, path, or content search',
                    },
                    fileType: {
                        type: 'string',
                        description: 'Filter by file type (pdf, image, docx, xlsx, code, all)',
                        enum: ['pdf', 'image', 'docx', 'xlsx', 'code', 'all'],
                        default: 'all',
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 10)',
                        default: 10,
                    },
                },
                required: ['query'],
            }
        );
    }

    /**
     * Execute file search
     */
    async execute(params) {
        try {
            const {
                query,
                fileType = 'all',
                maxResults = 10,
            } = params;

            const client = getClient();

            // Build SQL query
            let sql = `
                SELECT id, path, name, type, mime_type, size, metadata, processed_at
                FROM files
                WHERE 1=1
            `;
            const conditions = [];
            const values = [];

            // Search by name or path
            if (query) {
                conditions.push(`(name LIKE ? OR path LIKE ?)`);
                values.push(`%${query}%`, `%${query}%`);
            }

            // Filter by file type
            if (fileType && fileType !== 'all') {
                if (fileType === 'image') {
                    conditions.push(`(mime_type LIKE 'image/%' OR type LIKE 'image%')`);
                } else if (fileType === 'code') {
                    conditions.push(`type IN ('js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs')`);
                } else {
                    conditions.push(`(type = ? OR mime_type LIKE ?)`);
                    values.push(fileType, `%/${fileType}%`);
                }
            }

            if (conditions.length > 0) {
                sql += ` AND ${conditions.join(' AND ')}`;
            }

            sql += ` ORDER BY processed_at DESC LIMIT ?`;
            values.push(maxResults);

            // Execute query
            const result = await client.execute(sql, values);
            const files = result.rows || [];

            // Also try semantic search for content-based search
            let semanticResults = [];
            if (query && query.length > 3) {
                try {
                    const semanticSearchResults = await semanticSearch(query, {
                        limit: Math.min(maxResults, 5),
                        filters: fileType !== 'all' ? { source_type: 'workspace' } : {},
                    });

                    semanticResults = semanticSearchResults
                        .filter(r => r.fileId)
                        .map(r => ({
                            id: r.fileId,
                            matchedBy: 'content',
                            similarity: r.similarity,
                        }));
                } catch (error) {
                    logger.debug('Semantic search failed in file search tool:', error.message);
                }
            }

            // Format results
            const formattedFiles = files.map(file => ({
                id: file.id,
                name: file.name,
                path: file.path,
                type: file.type,
                mimeType: file.mime_type,
                size: file.size,
                metadata: file.metadata ? JSON.parse(file.metadata) : {},
                processedAt: file.processed_at,
                matchedBy: 'filename',
            }));

            // Merge with semantic results
            const allFiles = formattedFiles.map(file => {
                const semanticMatch = semanticResults.find(s => s.id === file.id);
                return {
                    ...file,
                    matchedBy: semanticMatch ? 'both' : file.matchedBy,
                    similarity: semanticMatch?.similarity,
                };
            });

            return {
                files: allFiles,
                count: allFiles.length,
                query,
                fileType,
            };
        } catch (error) {
            logger.error('Error in file search tool:', error);
            throw error;
        }
    }
}