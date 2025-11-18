import { BaseTool } from './base-tool.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../../../utils/logger.js';

/**
 * File System Tool - Navigate and inspect file system
 */
export class FileSystemTool extends BaseTool {
    constructor() {
        super(
            'file_system',
            'Navigate the file system, list files in directories, check if files exist, and get file metadata. Use this when the user asks to browse directories, check file existence, or navigate the file system.',
            {
                type: 'object',
                properties: {
                    operation: {
                        type: 'string',
                        description: 'Operation to perform',
                        enum: ['list', 'exists', 'info', 'read'],
                        required: true,
                    },
                    path: {
                        type: 'string',
                        description: 'File or directory path',
                        required: true,
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'List recursively (for list operation, default: false)',
                        default: false,
                    },
                    maxDepth: {
                        type: 'number',
                        description: 'Maximum depth for recursive listing (default: 3)',
                        default: 3,
                    },
                },
                required: ['operation', 'path'],
            }
        );
    }

    /**
     * Execute file system operation
     */
    async execute(params) {
        try {
            const {
                operation,
                path: targetPath,
                recursive = false,
                maxDepth = 3,
            } = params;

            // Normalize path
            const normalizedPath = path.resolve(targetPath);

            switch (operation) {
                case 'list':
                    return await this.listDirectory(normalizedPath, recursive, maxDepth);
                case 'exists':
                    return await this.checkExists(normalizedPath);
                case 'info':
                    return await this.getFileInfo(normalizedPath);
                case 'read':
                    return await this.readFile(normalizedPath);
                default:
                    return {
                        success: false,
                        error: `Unknown operation: ${operation}`,
                    };
            }
        } catch (error) {
            logger.error('Error in file system tool:', error);
            return {
                success: false,
                error: error.message || String(error),
            };
        }
    }

    /**
     * List directory contents
     */
    async listDirectory(dirPath, recursive, maxDepth) {
        try {
            const stats = await fs.stat(dirPath);
            if (!stats.isDirectory()) {
                return {
                    success: false,
                    error: `Path is not a directory: ${dirPath}`,
                };
            }

            if (!recursive || maxDepth === 0) {
                const entries = await fs.readdir(dirPath);
                const files = [];

                for (const entry of entries) {
                    const entryPath = path.join(dirPath, entry);
                    try {
                        const entryStats = await fs.stat(entryPath);
                        files.push({
                            name: entry,
                            path: entryPath,
                            type: entryStats.isDirectory() ? 'directory' : 'file',
                            size: entryStats.size,
                            modified: entryStats.mtime.toISOString(),
                        });
                    } catch (error) {
                        // Skip entries we can't access
                        logger.debug(`Cannot access ${entryPath}:`, error.message);
                    }
                }

                return {
                    success: true,
                    path: dirPath,
                    files,
                    count: files.length,
                };
            } else {
                // Recursive listing
                const files = [];
                await this.listRecursive(dirPath, files, maxDepth, 0);
                return {
                    success: true,
                    path: dirPath,
                    files,
                    count: files.length,
                    recursive: true,
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Cannot list directory: ${error.message}`,
            };
        }
    }

    /**
     * Recursive directory listing helper
     */
    async listRecursive(dirPath, files, maxDepth, currentDepth) {
        if (currentDepth >= maxDepth) {
            return;
        }

        try {
            const entries = await fs.readdir(dirPath);
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry);
                try {
                    const entryStats = await fs.stat(entryPath);
                    files.push({
                        name: entry,
                        path: entryPath,
                        type: entryStats.isDirectory() ? 'directory' : 'file',
                        size: entryStats.size,
                        modified: entryStats.mtime.toISOString(),
                        depth: currentDepth,
                    });

                    if (entryStats.isDirectory() && currentDepth < maxDepth - 1) {
                        await this.listRecursive(entryPath, files, maxDepth, currentDepth + 1);
                    }
                } catch (error) {
                    // Skip entries we can't access
                    logger.debug(`Cannot access ${entryPath}:`, error.message);
                }
            }
        } catch (error) {
            logger.debug(`Cannot read directory ${dirPath}:`, error.message);
        }
    }

    /**
     * Check if file/directory exists
     */
    async checkExists(filePath) {
        try {
            await fs.access(filePath);
            const stats = await fs.stat(filePath);
            return {
                success: true,
                exists: true,
                path: filePath,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
            };
        } catch (error) {
            return {
                success: true,
                exists: false,
                path: filePath,
            };
        }
    }

    /**
     * Get file information
     */
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                success: true,
                path: filePath,
                name: path.basename(filePath),
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                accessed: stats.atime.toISOString(),
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
            };
        } catch (error) {
            return {
                success: false,
                error: `Cannot get file info: ${error.message}`,
            };
        }
    }

    /**
     * Read file contents (for text files only)
     */
    async readFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                return {
                    success: false,
                    error: 'Path is a directory, not a file',
                };
            }

            // Only read text files (limit size to 1MB)
            if (stats.size > 1024 * 1024) {
                return {
                    success: false,
                    error: 'File too large to read (max 1MB)',
                };
            }

            const content = await fs.readFile(filePath, 'utf-8');
            return {
                success: true,
                path: filePath,
                content: content.substring(0, 10000), // Limit to 10KB preview
                size: stats.size,
                truncated: content.length > 10000,
            };
        } catch (error) {
            return {
                success: false,
                error: `Cannot read file: ${error.message}`,
            };
        }
    }
}