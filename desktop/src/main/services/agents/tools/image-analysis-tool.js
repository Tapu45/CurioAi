import { BaseTool } from './base-tool.js';
import { analyzeImage, getImageAnalysis } from '../../extraction/image-analyzer.js';
import { getFileById } from '../../../storage/sqlite-db.js';
import { FileSearchTool } from './file-search-tool.js';
import logger from '../../../utils/logger.js';
import { getClient } from '../../../storage/sqlite-db.js';
import path from 'path';

/**
 * Image Analysis Tool - Analyze images with OCR and vision models
 */
export class ImageAnalysisTool extends BaseTool {
    constructor() {
        super(
            'image_analysis',
            'Analyze images to extract text (OCR), describe scenes, and detect objects. Use this when the user asks about images, wants to find images by content, or needs to understand what is in an image. Can analyze a specific image file or search for images matching a description.',
            {
                type: 'object',
                properties: {
                    imagePath: {
                        type: 'string',
                        description: 'Path to the image file to analyze (optional if using searchQuery)',
                    },
                    fileId: {
                        type: 'number',
                        description: 'File ID of the image to analyze (optional if using imagePath or searchQuery)',
                    },
                    searchQuery: {
                        type: 'string',
                        description: 'Search query to find images by content (optional if imagePath or fileId provided)',
                    },
                    useOCR: {
                        type: 'boolean',
                        description: 'Extract text from image using OCR (default: true)',
                        default: true,
                    },
                    useVision: {
                        type: 'boolean',
                        description: 'Use vision model to describe scene (default: true)',
                        default: true,
                    },
                },
                required: [],
            }
        );
        this.fileSearchTool = new FileSearchTool();
    }

    /**
     * Execute image analysis
     */
    async execute(params) {
        try {
            const {
                imagePath,
                fileId,
                searchQuery,
                useOCR = true,
                useVision = true,
            } = params;

            let targetFileId = fileId;
            let targetFilePath = imagePath;

            // If search query provided, search for images first
            if (searchQuery && !imagePath && !fileId) {
                const searchResults = await this.fileSearchTool.execute({
                    query: searchQuery,
                    fileType: 'image',
                    maxResults: 5,
                });

                if (!searchResults.files || searchResults.files.length === 0) {
                    return {
                        success: false,
                        error: `No images found matching "${searchQuery}"`,
                        suggestions: 'Try a different search query or provide a specific image path',
                    };
                }

                // Use first result
                targetFileId = searchResults.files[0].id;
                targetFilePath = searchResults.files[0].path;
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
            }

            if (!targetFilePath) {
                return {
                    success: false,
                    error: 'Either imagePath, fileId, or searchQuery must be provided',
                };
            }

            // Check if file exists
            const fs = await import('fs/promises');
            try {
                await fs.access(targetFilePath);
            } catch (error) {
                return {
                    success: false,
                    error: `Image file not found: ${targetFilePath}`,
                };
            }

            // Check if already analyzed
            if (targetFileId) {
                const existingAnalysis = await getImageAnalysis(targetFileId);
                if (existingAnalysis) {
                    return {
                        success: true,
                        analysis: {
                            ocrText: existingAnalysis.ocrText,
                            sceneDescription: existingAnalysis.sceneDescription,
                            objectsDetected: existingAnalysis.objectsDetected,
                            confidence: existingAnalysis.confidence,
                            method: existingAnalysis.analysisMethod,
                            cached: true,
                        },
                        file: {
                            id: targetFileId,
                            path: targetFilePath,
                            name: path.basename(targetFilePath),
                        },
                    };
                }
            }

            // Perform analysis
            const analysis = await analyzeImage(
                targetFileId || 0, // Will be set after analysis
                targetFilePath,
                {
                    use_ocr: useOCR,
                    use_vision: useVision,
                }
            );

            // Get file info if we don't have it
            if (!targetFileId) {
                // Try to find file in database by path
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
                analysis: {
                    ocrText: analysis.ocr_text || '',
                    sceneDescription: analysis.scene_description || '',
                    objectsDetected: analysis.objects_detected || [],
                    confidence: analysis.confidence || 0.8,
                    method: analysis.method || 'vision-model',
                },
                file: {
                    id: targetFileId,
                    path: targetFilePath,
                    name: path.basename(targetFilePath),
                },
            };
        } catch (error) {
            logger.error('Error in image analysis tool:', error);
            throw error;
        }
    }
}