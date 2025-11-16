import axios from 'axios';
import logger from '../utils/logger.js';

// Extract YouTube video ID from URL
function extractVideoId(url) {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Extract transcript from YouTube video
async function extractYouTubeTranscript(activity) {
    const url = activity.url;
    if (!url) {
        logger.debug('No URL provided for YouTube extraction');
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {},
        };
    }

    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            logger.debug('Could not extract YouTube video ID from URL');
            return {
                title: activity.window_title || '',
                content: '',
                url,
                metadata: { error: 'Invalid YouTube URL' },
            };
        }

        // Try to get video metadata and transcript
        // Using youtube-transcript API (unofficial)
        try {
            // Method 1: Try to get transcript using youtube-transcript-scraper approach
            const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;

            const response = await axios.get(transcriptUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            // Parse XML transcript
            if (response.data) {
                const transcript = parseTranscriptXML(response.data);

                if (transcript) {
                    logger.info(`YouTube transcript extracted: ${transcript.length} characters`);

                    return {
                        title: activity.window_title || '',
                        content: transcript,
                        url,
                        metadata: {
                            videoId,
                            source: 'youtube',
                            extractionMethod: 'transcript-api',
                        },
                    };
                }
            }
        } catch (error) {
            logger.debug('Failed to extract transcript via API:', error.message);
        }

        // If transcript extraction fails, return with video info
        return {
            title: activity.window_title || '',
            content: '', // Transcript not available
            url,
            metadata: {
                videoId,
                source: 'youtube',
                error: 'Transcript not available',
                note: 'Consider watching video with captions enabled',
            },
        };
    } catch (error) {
        logger.error('Error extracting YouTube transcript:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url,
            metadata: {
                error: error.message,
            },
        };
    }
}

// Parse XML transcript to text
function parseTranscriptXML(xml) {
    try {
        // Simple XML parsing for transcript
        // Format: <text start="..." dur="...">Text content</text>
        const textMatches = xml.match(/<text[^>]*>([^<]+)<\/text>/g);

        if (!textMatches || textMatches.length === 0) {
            return null;
        }

        const transcript = textMatches
            .map(match => {
                const textMatch = match.match(/<text[^>]*>([^<]+)<\/text>/);
                return textMatch ? textMatch[1].trim() : '';
            })
            .filter(text => text.length > 0)
            .join(' ');

        return transcript || null;
    } catch (error) {
        logger.error('Error parsing transcript XML:', error);
        return null;
    }
}

// Get YouTube video metadata
async function getVideoMetadata(videoId) {
    try {
        // This is a placeholder - in production, you'd use YouTube Data API
        // For now, return basic info
        return {
            videoId,
            title: null,
            channel: null,
        };
    } catch (error) {
        logger.error('Error getting video metadata:', error);
        return null;
    }
}

export { extractYouTubeTranscript, extractVideoId };