import logger from '../utils/logger.js';
import { getSessionById, updateSession } from '../storage/sqlite-db.js';

/**
 * Aggregate activities within a session
 * Groups file switches in coding sessions, related browsing, etc.
 */
class ActivityAggregator {
    constructor() {
        this.sessionCache = new Map();
    }

    /**
     * Aggregate activities for a session
     * @param {string} sessionId - Session ID
     * @param {Array<Object>} activities - Activities in the session
     * @returns {Promise<Object>} - Aggregated session data
     */
    async aggregateSession(sessionId, activities) {
        if (!activities || activities.length === 0) {
            return null;
        }

        const session = await getSessionById(sessionId);
        if (!session) {
            logger.warn(`Session ${sessionId} not found for aggregation`);
            return null;
        }

        const activityType = session.activity_type;

        switch (activityType) {
            case 'coding':
                return await this.aggregateCodingSession(sessionId, activities, session);
            case 'browsing':
                return await this.aggregateBrowsingSession(sessionId, activities, session);
            case 'reading':
                return await this.aggregateReadingSession(sessionId, activities, session);
            case 'watching':
                return await this.aggregateWatchingSession(sessionId, activities, session);
            default:
                return await this.aggregateGenericSession(sessionId, activities, session);
        }
    }

    /**
     * Aggregate coding session - group file switches
     */
    async aggregateCodingSession(sessionId, activities, session) {
        const files = new Set();
        const languages = new Set();
        const frameworks = new Set();
        let projectName = null;

        activities.forEach(activity => {
            // Collect files
            if (activity.window_title) {
                const fileName = this.extractFileName(activity.window_title);
                if (fileName) {
                    files.add(fileName);
                }
            }

            // Collect languages
            if (activity.metadata?.language) {
                languages.add(activity.metadata.language);
            }

            // Collect frameworks
            if (activity.metadata?.frameworks) {
                activity.metadata.frameworks.forEach(f => frameworks.add(f));
            }

            // Get project name
            if (activity.project_name) {
                projectName = activity.project_name;
            }
        });

        // Update session with aggregated data
        const aggregatedFiles = Array.from(files);
        await updateSession(sessionId, {
            aggregated_files: JSON.stringify(aggregatedFiles),
        });

        // Generate summary
        const summary = this.generateCodingSummary({
            projectName: projectName || session.project_name,
            files: aggregatedFiles,
            languages: Array.from(languages),
            frameworks: Array.from(frameworks),
            fileCount: aggregatedFiles.length,
            activityCount: activities.length,
        });

        return {
            sessionId,
            summary,
            aggregatedData: {
                files: aggregatedFiles,
                languages: Array.from(languages),
                frameworks: Array.from(frameworks),
                projectName,
            },
        };
    }

    /**
     * Aggregate browsing session - group by domain
     */
    async aggregateBrowsingSession(sessionId, activities, session) {
        const domains = new Map(); // domain -> count
        const urls = new Set();

        activities.forEach(activity => {
            if (activity.url) {
                urls.add(activity.url);
                const domain = this.extractDomain(activity.url);
                if (domain) {
                    domains.set(domain, (domains.get(domain) || 0) + 1);
                }
            }
        });

        // Update session with aggregated URLs
        const aggregatedUrls = Array.from(urls);
        await updateSession(sessionId, {
            aggregated_urls: JSON.stringify(aggregatedUrls),
        });

        // Generate summary
        const topDomains = Array.from(domains.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([domain]) => domain);

        const summary = this.generateBrowsingSummary({
            domains: topDomains,
            urlCount: aggregatedUrls.length,
            activityCount: activities.length,
        });

        return {
            sessionId,
            summary,
            aggregatedData: {
                urls: aggregatedUrls,
                domains: topDomains,
            },
        };
    }

    /**
     * Aggregate reading session - each PDF is separate
     */
    async aggregateReadingSession(sessionId, activities, session) {
        // Reading sessions are typically single PDF, so minimal aggregation
        const pdfFiles = activities
            .map(a => a.file_path || a.window_title)
            .filter(Boolean);

        const summary = this.generateReadingSummary({
            pdfFiles,
            activityCount: activities.length,
        });

        return {
            sessionId,
            summary,
            aggregatedData: {
                pdfFiles,
            },
        };
    }

    /**
     * Aggregate watching session - each video is separate
     */
    async aggregateWatchingSession(sessionId, activities, session) {
        const videos = activities
            .map(a => ({
                videoId: a.video_id,
                title: a.title || a.window_title,
                url: a.url,
            }))
            .filter(v => v.videoId || v.url);

        const summary = this.generateWatchingSummary({
            videos,
            videoCount: videos.length,
        });

        return {
            sessionId,
            summary,
            aggregatedData: {
                videos,
            },
        };
    }

    /**
     * Aggregate generic session
     */
    async aggregateGenericSession(sessionId, activities, session) {
        const summary = `Session with ${activities.length} activities`;

        return {
            sessionId,
            summary,
            aggregatedData: {
                activityCount: activities.length,
            },
        };
    }

    /**
     * Generate coding session summary
     */
    generateCodingSummary(data) {
        const parts = [];

        if (data.projectName) {
            parts.push(`Working on ${data.projectName}`);
        }

        if (data.files.length > 0) {
            parts.push(`${data.files.length} file${data.files.length > 1 ? 's' : ''} edited`);
        }

        if (data.languages.length > 0) {
            parts.push(`Languages: ${data.languages.join(', ')}`);
        }

        if (data.frameworks.length > 0) {
            parts.push(`Frameworks: ${data.frameworks.join(', ')}`);
        }

        return parts.join('. ') || 'Coding session';
    }

    /**
     * Generate browsing session summary
     */
    generateBrowsingSummary(data) {
        const parts = [];

        if (data.domains.length > 0) {
            parts.push(`Visited ${data.domains.length} domain${data.domains.length > 1 ? 's' : ''}: ${data.domains.join(', ')}`);
        }

        if (data.urlCount > 0) {
            parts.push(`${data.urlCount} page${data.urlCount > 1 ? 's' : ''} viewed`);
        }

        return parts.join('. ') || 'Browsing session';
    }

    /**
     * Generate reading session summary
     */
    generateReadingSummary(data) {
        if (data.pdfFiles.length === 1) {
            return `Reading: ${data.pdfFiles[0]}`;
        }
        return `Reading ${data.pdfFiles.length} PDF${data.pdfFiles.length > 1 ? 's' : ''}`;
    }

    /**
     * Generate watching session summary
     */
    generateWatchingSummary(data) {
        if (data.videos.length === 1) {
            return `Watching: ${data.videos[0].title || 'Video'}`;
        }
        return `Watched ${data.videoCount} video${data.videoCount > 1 ? 's' : ''}`;
    }

    /**
     * Extract filename from window title
     */
    extractFileName(windowTitle) {
        const match = windowTitle.match(/([^\/\\]+\.(js|ts|jsx|tsx|py|java|cpp|c|h|html|css|json|md|go|rs|php|rb))(?:\s|$)/i);
        return match ? match[1] : null;
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return null;
        }
    }

    /**
     * Filter out noise from activities (rapid switches, accidental clicks)
     */
    filterNoise(activities) {
        const filtered = [];
        const seen = new Set();
        const MIN_TIME_BETWEEN = 1000; // 1 second minimum between similar activities

        activities.forEach((activity, index) => {
            const key = this.getActivityKey(activity);
            const timestamp = new Date(activity.timestamp || activity.created_at).getTime();

            // Check if we've seen this activity recently
            if (seen.has(key)) {
                const lastSeen = seen.get(key);
                if (timestamp - lastSeen < MIN_TIME_BETWEEN) {
                    logger.debug(`Filtered noise activity: ${key}`);
                    return; // Skip this activity
                }
            }

            seen.set(key, timestamp);
            filtered.push(activity);
        });

        return filtered;
    }

    /**
     * Get unique key for activity
     */
    getActivityKey(activity) {
        const activityType = activity.activity_type || activity.source_type || 'other';

        if (activityType === 'coding') {
            return `${activityType}:${activity.project_name || activity.app_name}:${activity.window_title}`;
        } else if (activity.url) {
            return `${activityType}:${activity.url}`;
        }

        return `${activityType}:${activity.app_name}:${activity.window_title}`;
    }
}

// Singleton instance
const aggregator = new ActivityAggregator();

export default aggregator;

export {
    ActivityAggregator,
};