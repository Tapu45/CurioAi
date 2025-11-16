import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

// Detect code project from window title
function extractProjectInfo(activity) {
    const title = activity.window_title || '';
    const appName = activity.app_name || '';

    // Common patterns:
    // "project-name - Visual Studio Code"
    // "filename.js - project-name - VS Code"
    const patterns = [
        /^([^-]+)\s*-\s*(?:Visual Studio Code|Code|VS Code)/,
        /([^-]+\.(js|ts|py|java|cpp|c|h|html|css|json|md|go|rs|php|rb))\s*-\s*([^-]+)/,
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            return {
                projectName: match[1]?.trim() || match[3]?.trim(),
                fileName: match[1]?.trim(),
                language: detectLanguage(match[1] || ''),
            };
        }
    }

    // If no pattern matches, try to extract project name from title
    const simpleMatch = title.match(/^([^-]+)/);
    if (simpleMatch) {
        return {
            projectName: simpleMatch[1].trim(),
            fileName: null,
            language: detectLanguage(simpleMatch[1]),
        };
    }

    return {
        projectName: null,
        fileName: null,
        language: null,
    };
}

// Detect programming language from filename or content
function detectLanguage(filename) {
    if (!filename) return null;

    const ext = path.extname(filename).toLowerCase();

    const languageMap = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.h': 'C/C++',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.sass': 'Sass',
        '.json': 'JSON',
        '.xml': 'XML',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.md': 'Markdown',
        '.sql': 'SQL',
        '.sh': 'Shell',
        '.bash': 'Bash',
    };

    return languageMap[ext] || null;
}

// Extract code content from IDE activity
async function extractCodeContent(activity) {
    try {
        const projectInfo = extractProjectInfo(activity);

        // For now, we'll extract metadata about the code activity
        // Actual code content extraction would require IDE integration
        // which is complex and depends on the specific IDE

        const content = generateCodeSummary(activity, projectInfo);

        logger.info(`Code activity detected: ${projectInfo.projectName || 'Unknown'}`);

        return {
            title: projectInfo.projectName || activity.window_title || '',
            content,
            url: null,
            metadata: {
                app: activity.app_name,
                projectName: projectInfo.projectName,
                fileName: projectInfo.fileName,
                language: projectInfo.language,
                sourceType: 'code',
                extractionMethod: 'metadata',
            },
        };
    } catch (error) {
        logger.error('Error extracting code content:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {
                app: activity.app_name,
                error: error.message,
            },
        };
    }
}

// Generate summary of code activity
function generateCodeSummary(activity, projectInfo) {
    const parts = [];

    if (projectInfo.projectName) {
        parts.push(`Project: ${projectInfo.projectName}`);
    }

    if (projectInfo.fileName) {
        parts.push(`File: ${projectInfo.fileName}`);
    }

    if (projectInfo.language) {
        parts.push(`Language: ${projectInfo.language}`);
    }

    parts.push(`IDE: ${activity.app_name}`);

    if (activity.window_title) {
        parts.push(`Context: ${activity.window_title}`);
    }

    return parts.join('\n');
}

// Try to read code file content (if accessible)
async function tryReadCodeFile(filePath) {
    try {
        // Check if file exists and is readable
        await fs.access(filePath);

        // Read file content
        const content = await fs.readFile(filePath, 'utf8');

        // Limit content size (first 5000 characters)
        return content.substring(0, 5000);
    } catch (error) {
        logger.debug(`Could not read code file: ${filePath}`, error.message);
        return null;
    }
}

export { extractCodeContent, extractProjectInfo, detectLanguage , tryReadCodeFile };