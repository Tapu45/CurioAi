import { BaseTool } from './base-tool.js';
import { extractStructuredData, getStructuredData } from '../../extraction/structured-extractor.js';
import { getFileById } from '../../../storage/sqlite-db.js';
import { FileSearchTool } from './file-search-tool.js';
import logger from '../../../utils/logger.js';

/**
 * Structured Extraction Tool - Extract structured data (tables, forms, percentages, key-value pairs)
 */
export class StructuredExtractionTool extends BaseTool {
    constructor() {
        super(
            'structured_extraction',
            'Extract structured data from documents such as percentages, grades, scores, key-value pairs, forms, and tables. Use this when the user asks for specific data points like "what percentage did I get" or "extract the grade from this document". Can search for documents and extract data from them.',
            {
                type: 'object',
                properties: {
                    fileId: {
                        type: 'number',
                        description: 'File ID of the document to extract from (optional if using searchQuery)',
                    },
                    filePath: {
                        type: 'string',
                        description: 'Path to the document file (optional if using fileId or searchQuery)',
                    },
                    searchQuery: {
                        type: 'string',
                        description: 'Search query to find documents containing the data (optional if fileId or filePath provided)',
                    },
                    dataType: {
                        type: 'string',
                        description: 'Type of data to extract (percentage, grade, score, key_value, form, table, all)',
                        enum: ['percentage', 'grade', 'score', 'key_value', 'form', 'table', 'all'],
                        default: 'all',
                    },
                    forceReextract: {
                        type: 'boolean',
                        description: 'Force re-extraction even if data already exists (default: false)',
                        default: false,
                    },
                },
                required: [],
            }
        );
        this.fileSearchTool = new FileSearchTool();
    }

    /**
     * Execute structured extraction
     */
    async execute(params) {
        try {
            const {
                fileId,
                filePath,
                searchQuery,
                dataType = 'all',
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
                        error: `No documents found matching "${searchQuery}"`,
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

            // Check if already extracted
            if (targetFileId && !forceReextract) {
                const existingData = await getStructuredData(targetFileId);
                if (existingData && existingData.length > 0) {
                    // Filter by dataType if specified
                    let filteredData = existingData;
                    if (dataType !== 'all') {
                        filteredData = existingData.filter(item => {
                            if (dataType === 'percentage' || dataType === 'grade' || dataType === 'score') {
                                return item.dataType === 'percentage' ||
                                    item.extractedData?.value?.toString().includes('%') ||
                                    item.extractedData?.value?.toString().match(/\d+%/);
                            }
                            return item.dataType === dataType;
                        });
                    }

                    if (filteredData.length > 0) {
                        return {
                            success: true,
                            data: filteredData.map(item => ({
                                type: item.dataType,
                                extractedData: item.extractedData,
                                confidence: item.confidence,
                                method: item.extractionMethod,
                            })),
                            file: {
                                id: targetFileId,
                                path: targetFilePath,
                            },
                            cached: true,
                        };
                    }
                }
            }

            // Perform extraction
            const extractionResult = await extractStructuredData(
                targetFileId || 0,
                targetFilePath,
                targetFileType || 'application/pdf'
            );

            // Filter by dataType if specified
            let filteredData = extractionResult.data || [];
            if (dataType !== 'all') {
                filteredData = filteredData.filter(item => {
                    if (dataType === 'percentage' || dataType === 'grade' || dataType === 'score') {
                        return item.type === 'percentage' ||
                            item.value?.toString().includes('%') ||
                            item.value?.toString().match(/\d+%/);
                    }
                    return item.type === dataType;
                });
            }

            // Get file info if we don't have it
            if (!targetFileId) {
                const { getClient } = await import('../../../storage/sqlite-db.js');
                const client = getClient();
                const fileResult = await client.execute(
                    'SELECT id FROM files WHERE path = ? LIMIT 1',
                    [targetFilePath]
                );
                if (fileResult.rows.length > 0) {
                    targetFileId = fileResult.rows[0].id;
                }
            }

            return {
                success: true,
                data: filteredData,
                file: {
                    id: targetFileId,
                    path: targetFilePath,
                },
                confidence: extractionResult.confidence || 0.8,
            };
        } catch (error) {
            logger.error('Error in structured extraction tool:', error);
            throw error;
        }
    }
}