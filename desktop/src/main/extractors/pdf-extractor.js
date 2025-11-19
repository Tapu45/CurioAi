import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

// Enhanced PDF extraction with file path tracking and metadata
async function extractPDFContent(activity) {
    try {
        let pdfPath = null;
        const title = activity.window_title || '';

        // Method 1: Try to extract from window title
        const pdfMatch = title.match(/([^\s]+\.pdf)/i);
        if (pdfMatch) {
            const filename = pdfMatch[1];
            pdfPath = await findPDFFile(filename);
        }

        // Method 2: Try to extract from file_path if available (from activity metadata)
        if (!pdfPath && activity.file_path) {
            try {
                await fs.access(activity.file_path);
                pdfPath = activity.file_path;
            } catch {
                // File path not accessible
            }
        }

        // Method 3: Search common locations
        if (!pdfPath) {
            pdfPath = await searchPDFLocations(title);
        }

        if (!pdfPath) {
            logger.debug('PDF file not found for extraction');
            return {
                title: title.replace(/\s*-\s*.*$/, '') || activity.window_title || '',
                content: '',
                url: null,
                metadata: {
                    app: activity.app_name,
                    error: 'PDF file not found',
                    filePath: null,
                },
            };
        }

        // Read and parse PDF
        const dataBuffer = await fs.readFile(pdfPath);
        const pdfData = await pdfParse(dataBuffer);

        // Extract metadata
        const metadata = {
            app: activity.app_name,
            pdfPath,
            fileName: path.basename(pdfPath),
            fileSize: dataBuffer.length,
            numPages: pdfData.numpages,
            author: pdfData.info?.Author || null,
            title: pdfData.info?.Title || null,
            subject: pdfData.info?.Subject || null,
            creator: pdfData.info?.Creator || null,
            producer: pdfData.info?.Producer || null,
            creationDate: pdfData.info?.CreationDate || null,
            modificationDate: pdfData.info?.ModDate || null,
            extractionMethod: 'pdf-parse',
        };

        // Determine if we should store full content or summary
        const shouldStoreFullContent = pdfData.text.length < 100000; // Store full if < 100KB text

        logger.info(`PDF content extracted: ${pdfData.text.length} characters from ${pdfPath}`);

        return {
            title: pdfData.info?.Title || title.replace(/\s*-\s*.*$/, '') || path.basename(pdfPath),
            content: shouldStoreFullContent ? pdfData.text : pdfData.text.substring(0, 5000) + '... [truncated]',
            url: `file://${pdfPath}`,
            metadata: {
                ...metadata,
                fullContentStored: shouldStoreFullContent,
                contentLength: pdfData.text.length,
            },
        };
    } catch (error) {
        logger.error('Error extracting PDF content:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {
                app: activity.app_name,
                error: error.message,
                filePath: null,
            },
        };
    }
}

// Find PDF file by filename
async function findPDFFile(filename) {
    const searchPaths = [
        app.getPath('documents'),
        app.getPath('downloads'),
        path.join(app.getPath('home'), 'Documents'),
        path.join(app.getPath('home'), 'Downloads'),
        path.join(app.getPath('home'), 'Desktop'),
    ];

    for (const basePath of searchPaths) {
        try {
            const filePath = path.join(basePath, filename);
            await fs.access(filePath);
            return filePath;
        } catch {
            // Continue searching
        }
    }

    return null;
}

// Search PDF locations recursively
async function searchPDFLocations(title) {
    const searchPaths = [
        app.getPath('documents'),
        app.getPath('downloads'),
    ];

    // Extract potential filename from title
    const titleMatch = title.match(/([^\s]+\.pdf)/i);
    if (!titleMatch) return null;

    const searchTerm = titleMatch[1].toLowerCase();

    for (const basePath of searchPaths) {
        try {
            const files = await fs.readdir(basePath);
            for (const file of files) {
                if (file.toLowerCase().includes(searchTerm.replace('.pdf', ''))) {
                    const filePath = path.join(basePath, file);
                    const stats = await fs.stat(filePath);
                    if (stats.isFile() && file.toLowerCase().endsWith('.pdf')) {
                        return filePath;
                    }
                }
            }
        } catch {
            // Continue searching
        }
    }

    return null;
}

// Track reading progress (to be called periodically)
async function trackReadingProgress(pdfPath, currentPage) {
    // This would be integrated with session manager
    // For now, just log
    logger.debug(`Reading progress: ${pdfPath} - Page ${currentPage}`);
}

export { extractPDFContent, findPDFFile, trackReadingProgress };