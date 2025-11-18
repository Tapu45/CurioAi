import { BaseTool } from './base-tool.js';
import { getDeepExtractor } from '../../extraction/deep-extractor.js';
import { getFileById } from '../../../storage/sqlite-db.js';
import { FileSearchTool } from './file-search-tool.js';
import logger from '../../../utils/logger.js';

/**
 * Deep Extraction Tool - Trigger comprehensive extraction on files
 */
export class DeepExtractionTool extends BaseTool {
    constructor() {
        super(
            'deep_extraction',
            'Perform comprehensive deep extraction on a file including structured data, image analysis, and table extraction. Use this when the user needs complete information extraction from a document or when previous extractions were insufficient. This tool coordinates multiple extraction methods.',
            {
                type: 'object',
                properties: {
                    fileId: {
                        type: 'number',
                        description: 'File ID to extract from (optional if using filePath or searchQuery)',
                    },
                    filePath: {
                        type: 'string',
                        description: 'Path to file to extract from (optional if using fileId or searchQuery)',
                    },
                    searchQuery: {
                        type: 'string',
                        description: 'Search query to find file to extract from (optional if fileId or filePath provided)',
                    },
                    extractStructured: {
                        type: 'boolean',
                        description: 'Extract structured data (forms, key-value pairs) (default: true)',
                        default: true,
                    },
                    analyzeImages: {
                        type: 'boolean',
                        description: 'Analyze images with OCR and vision (default: true)',
                        default: true,
                    },
                    extractTables: {
                        type: 'boolean',
                        description: 'Extract tables (default: true)',
                        default: true,
                    },
                    forceReextract: {
                        type: 'boolean',
                        description: 'Force re-extraction even if already extracted (default: false)',
                        default: false,
                    },
                },
                required: [],
            }
        );
        this.fileSearchTool = new FileSearchTool();
    }

    /**
     * Execute deep extraction
     */
    async execute(params) {
        try {
            const {
                fileId,
                filePath,
                searchQuery,
                extractStructured = true,
                analyzeImages = true,
                extractTables = true,
                forceReextract = false,
            } = params;

            let targetFileId = fileId;
            let targetFilePath = filePath;
            let targetFileType = null;

            // If search query provided, search for files first
            if (searchQuery && !filePath && !fileId) {
                const searchResults = await this.fileSearchTool.execute({
                    query: searchQuery,
                    fileType: 'all',
                    maxResults: 5,
                });

                if (!searchResults.files || searchResults.files.length === 0) {
                    return {
                        success: false,
                        error: `No files found matching "${searchQuery}"`,
                        suggestions: 'Try a different search query or provide a specific file path',
                    };
                }

                // Use first result
                targetFileId = searchResults.files[0].id;
                targetFilePath = searchResults.files[0].path;
                targetFileType = searchResults.files[0].mimeType || searchResults.files[0].type;
            }

            // Get file info if we have fileId
            if (targetFileId && !targetFilePath) {
                const file = await getFileById(targetFileId);
                if (!file) {
                    return {
                        success: false,
                        error: `File with ID ${targetFileId} not found`,
                    };
                }
                targetFilePath = file.path;
                targetFileType = file.mime_type || file.type;
            }

            if (!targetFilePath) {
                return {
                    success: false,
                    error: 'Either filePath, fileId, or searchQuery must be provided',
                };
            }

            // Get file info if we don't have it
            if (!targetFileId) {
                const { getClient } = await import('../../../storage/sqlite-db.js');
                const client = getClient();
                const fileResult = await client.execute(
                    'SELECT id, mime_type, type FROM files WHERE path = ? LIMIT 1',
                    [targetFilePath]
                );
                if (fileResult.rows.length > 0) {
                    targetFileId = fileResult.rows[0].id;
                    targetFileType = targetFileType || fileResult.rows[0].mime_type || fileResult.rows[0].type;
                }
            }

            // Perform deep extraction
            const deepExtractor = getDeepExtractor();
            const extractionResult = await deepExtractor.extract(
                targetFileId || 0,
                targetFilePath,
                targetFileType || 'application/octet-stream',
                {
                    extractStructured,
                    analyzeImages,
                    extractTables,
                    forceReextract,
                }
            );

            // Format results
            const result = {
                success: true,
                file: {
                    id: targetFileId,
                    path: targetFilePath,
                    type: targetFileType,
                },
                extraction: {
                    structuredData: extractionResult.structuredData ? {
                        count: extractionResult.structuredData.data?.length || 0,
                        data: extractionResult.structuredData.data || [],
                    } : null,
                    imageAnalysis: extractionResult.imageAnalysis ? {
                        ocrText: extractionResult.imageAnalysis.ocr_text || '',
                        sceneDescription: extractionResult.imageAnalysis.scene_description || '',
                        objectsDetected: extractionResult.imageAnalysis.objects_detected || [],
                    } : null,
                    tables: extractionResult.tables ? {
                        count: extractionResult.tables.table_count || 0,
                        tables: extractionResult.tables.tables || [],
                    } : null,
                },
            };

            return result;
        } catch (error) {
            logger.error('Error in deep extraction tool:', error);
            throw error;
        }
    }
}