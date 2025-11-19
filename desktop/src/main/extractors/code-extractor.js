import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

// Enhanced project detection with workspace path detection
async function extractProjectInfo(activity) {
    const title = activity.window_title || '';
    const appName = activity.app_name || '';

    // Try to extract project path from window title
    // VS Code pattern: "workspace-name - Visual Studio Code" or "file.js - workspace-name - VS Code"
    const patterns = [
        /^([^-]+)\s*-\s*(?:Visual Studio Code|Code|VS Code)/,
        /([^-]+\.(js|ts|py|java|cpp|c|h|html|css|json|md|go|rs|php|rb))\s*-\s*([^-]+)\s*-\s*(?:Visual Studio Code|Code|VS Code)/,
    ];

    let projectName = null;
    let fileName = null;
    let projectPath = null;

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            projectName = match[1]?.trim() || match[3]?.trim();
            fileName = match[1]?.trim();
            break;
        }
    }

    // If no pattern matches, try to extract project name from title
    if (!projectName) {
        const simpleMatch = title.match(/^([^-]+)/);
        if (simpleMatch) {
            projectName = simpleMatch[1].trim();
        }
    }

    // Try to find actual project path by searching common workspace locations
    if (projectName) {
        projectPath = await findProjectPath(projectName, fileName);
    }

    // Extract project type and frameworks if project path found
    let projectType = null;
    let frameworks = [];
    let isLearningProject = false;

    if (projectPath) {
        const projectInfo = await analyzeProject(projectPath);
        projectType = projectInfo.type;
        frameworks = projectInfo.frameworks;
        isLearningProject = projectInfo.isLearning;
    }

    return {
        projectName,
        fileName,
        projectPath,
        language: detectLanguage(fileName || projectName),
        projectType,
        frameworks,
        isLearningProject,
    };
}

// Find actual project path on filesystem
async function findProjectPath(projectName, fileName) {
    const searchPaths = [
        path.join(app.getPath('home'), 'Documents', 'Projects'),
        path.join(app.getPath('home'), 'Documents'),
        path.join(app.getPath('home'), 'Desktop'),
        path.join(app.getPath('home'), 'Code'),
        path.join(app.getPath('home'), 'workspace'),
    ];

    for (const basePath of searchPaths) {
        try {
            // Try exact match
            const exactPath = path.join(basePath, projectName);
            const stats = await fs.stat(exactPath);
            if (stats.isDirectory()) {
                return exactPath;
            }

            // Try to find directory containing the file
            if (fileName) {
                const dirs = await fs.readdir(basePath);
                for (const dir of dirs) {
                    const dirPath = path.join(basePath, dir);
                    try {
                        const dirStats = await fs.stat(dirPath);
                        if (dirStats.isDirectory()) {
                            const filePath = path.join(dirPath, fileName);
                            await fs.access(filePath);
                            return dirPath;
                        }
                    } catch {
                        // Continue searching
                    }
                }
            }
        } catch {
            // Continue searching
        }
    }

    return null;
}

// Analyze project to detect type, frameworks, and if it's a learning project
async function analyzeProject(projectPath) {
    try {
        const files = await fs.readdir(projectPath);
        const projectInfo = {
            type: null,
            frameworks: [],
            isLearning: false,
        };

        // Check for package.json (Node.js/React/Vue/etc.)
        if (files.includes('package.json')) {
            try {
                const packageJsonPath = path.join(projectPath, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

                // Detect frameworks
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                if (deps.react || deps['react-dom']) {
                    projectInfo.frameworks.push('React');
                    projectInfo.type = 'React';
                }
                if (deps.vue || deps['vue-router']) {
                    projectInfo.frameworks.push('Vue');
                    projectInfo.type = 'Vue';
                }
                if (deps.angular || deps['@angular/core']) {
                    projectInfo.frameworks.push('Angular');
                    projectInfo.type = 'Angular';
                }
                if (deps.next) {
                    projectInfo.frameworks.push('Next.js');
                    projectInfo.type = 'Next.js';
                }
                if (deps.express) {
                    projectInfo.frameworks.push('Express');
                    if (!projectInfo.type) projectInfo.type = 'Node.js';
                }
                if (deps['@nestjs/core']) {
                    projectInfo.frameworks.push('NestJS');
                    projectInfo.type = 'NestJS';
                }
                if (deps.tailwindcss) {
                    projectInfo.frameworks.push('Tailwind CSS');
                }
                if (deps.typescript) {
                    projectInfo.frameworks.push('TypeScript');
                }

                // Check if learning project (tutorial keywords in name/path)
                const projectName = packageJson.name || '';
                const lowerName = projectName.toLowerCase();
                const lowerPath = projectPath.toLowerCase();
                const learningKeywords = ['tutorial', 'learn', 'course', 'example', 'demo', 'practice', 'training'];
                projectInfo.isLearning = learningKeywords.some(keyword =>
                    lowerName.includes(keyword) || lowerPath.includes(keyword)
                );
            } catch (error) {
                logger.debug('Error reading package.json:', error.message);
            }
        }

        // Check for requirements.txt (Python)
        if (files.includes('requirements.txt')) {
            try {
                const requirementsPath = path.join(projectPath, 'requirements.txt');
                const requirements = await fs.readFile(requirementsPath, 'utf8');

                if (requirements.includes('django')) {
                    projectInfo.frameworks.push('Django');
                    projectInfo.type = 'Django';
                }
                if (requirements.includes('flask')) {
                    projectInfo.frameworks.push('Flask');
                    projectInfo.type = 'Flask';
                }
                if (requirements.includes('fastapi')) {
                    projectInfo.frameworks.push('FastAPI');
                    projectInfo.type = 'FastAPI';
                }
                if (!projectInfo.type) projectInfo.type = 'Python';
            } catch (error) {
                logger.debug('Error reading requirements.txt:', error.message);
            }
        }

        // Check for pom.xml (Java/Maven)
        if (files.includes('pom.xml')) {
            projectInfo.type = 'Java';
        }

        // Check for Cargo.toml (Rust)
        if (files.includes('Cargo.toml')) {
            projectInfo.type = 'Rust';
        }

        // Check for go.mod (Go)
        if (files.includes('go.mod')) {
            projectInfo.type = 'Go';
        }

        return projectInfo;
    } catch (error) {
        logger.debug('Error analyzing project:', error.message);
        return { type: null, frameworks: [], isLearning: false };
    }
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

// Extract framework/library usage from file imports
async function extractFrameworkUsage(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        const frameworks = [];

        // React patterns
        if (content.includes('import') && (content.includes('react') || content.includes('React'))) {
            frameworks.push('React');
        }

        // Vue patterns
        if (content.includes('import') && content.includes('vue')) {
            frameworks.push('Vue');
        }

        // Angular patterns
        if (content.includes('@angular')) {
            frameworks.push('Angular');
        }

        // Express patterns
        if (content.includes('require') && content.includes('express')) {
            frameworks.push('Express');
        }

        return frameworks;
    } catch (error) {
        logger.debug('Error extracting framework usage:', error.message);
        return [];
    }
}

// Enhanced code content extraction
async function extractCodeContent(activity) {
    try {
        const projectInfo = await extractProjectInfo(activity);

        // Extract file path if available
        let filePath = null;
        if (projectInfo.projectPath && projectInfo.fileName) {
            filePath = path.join(projectInfo.projectPath, projectInfo.fileName);
            try {
                await fs.access(filePath);
            } catch {
                filePath = null;
            }
        }

        // Extract framework usage if file path available
        let frameworkUsage = [];
        if (filePath) {
            frameworkUsage = await extractFrameworkUsage(filePath);
        }

        const content = generateCodeSummary(activity, projectInfo, frameworkUsage);

        logger.info(`Code activity detected: ${projectInfo.projectName || 'Unknown'} (${projectInfo.projectType || 'Unknown Type'})`);

        return {
            title: projectInfo.projectName || activity.window_title || '',
            content,
            url: null,
            metadata: {
                app: activity.app_name,
                projectName: projectInfo.projectName,
                projectPath: projectInfo.projectPath,
                fileName: projectInfo.fileName,
                filePath,
                language: projectInfo.language,
                projectType: projectInfo.projectType,
                frameworks: [...projectInfo.frameworks, ...frameworkUsage],
                isLearningProject: projectInfo.isLearningProject,
                sourceType: 'code',
                extractionMethod: 'enhanced-metadata',
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

// Generate enhanced summary
function generateCodeSummary(activity, projectInfo, frameworkUsage) {
    const parts = [];

    if (projectInfo.projectName) {
        parts.push(`Project: ${projectInfo.projectName}`);
    }

    if (projectInfo.projectType) {
        parts.push(`Type: ${projectInfo.projectType}`);
    }

    if (projectInfo.frameworks.length > 0 || frameworkUsage.length > 0) {
        const allFrameworks = [...new Set([...projectInfo.frameworks, ...frameworkUsage])];
        parts.push(`Frameworks: ${allFrameworks.join(', ')}`);
    }

    if (projectInfo.fileName) {
        parts.push(`File: ${projectInfo.fileName}`);
    }

    if (projectInfo.language) {
        parts.push(`Language: ${projectInfo.language}`);
    }

    if (projectInfo.isLearningProject) {
        parts.push(`Context: Learning/Tutorial`);
    } else {
        parts.push(`Context: Working/Development`);
    }

    parts.push(`IDE: ${activity.app_name}`);

    return parts.join('\n');
}

// Try to read code file content (if accessible)
async function tryReadCodeFile(filePath) {
    try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        return content.substring(0, 5000);
    } catch (error) {
        logger.debug(`Could not read code file: ${filePath}`, error.message);
        return null;
    }
}

export {
    extractCodeContent,
    extractProjectInfo,
    detectLanguage,
    tryReadCodeFile,
    analyzeProject,
};