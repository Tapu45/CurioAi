import axios from 'axios';
import logger from '../utils/logger.js';

// Enhanced YouTube video ID extraction
function extractVideoId(url) {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Extract domain from URL
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return null;
    }
}

// Get YouTube video metadata (enhanced)
async function getVideoMetadata(videoId) {
    try {
        // Try to get metadata from oEmbed API (no key required)
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

        const response = await axios.get(oembedUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (response.data) {
            return {
                videoId,
                title: response.data.title || null,
                channel: response.data.author_name || null,
                channelUrl: response.data.author_url || null,
                thumbnail: response.data.thumbnail_url || null,
                description: null, // oEmbed doesn't provide description
            };
        }
    } catch (error) {
        logger.debug('Error getting video metadata from oEmbed:', error.message);
    }

    // Fallback: return basic info
    return {
        videoId,
        title: null,
        channel: null,
        channelUrl: null,
        thumbnail: null,
        description: null,
    };
}

// Detect video category (tutorial, entertainment, etc.)
function detectVideoCategory(title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();

    const categories = {
        tutorial: ['tutorial', 'how to', 'learn', 'course', 'lesson', 'guide', 'explained'],
        entertainment: ['funny', 'comedy', 'music', 'song', 'movie', 'trailer', 'entertainment'],
        gaming: ['game', 'gaming', 'playthrough', 'walkthrough', 'review'],
        tech: ['tech', 'technology', 'review', 'unboxing', 'comparison'],
        news: ['news', 'update', 'breaking', 'latest'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return category;
        }
    }

    return 'other';
}

// Enhanced YouTube transcript extraction
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

        // Get video metadata
        const metadata = await getVideoMetadata(videoId);

        // Try to extract transcript
        let transcript = null;
        try {
            const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
            const response = await axios.get(transcriptUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (response.data) {
                transcript = parseTranscriptXML(response.data);
            }
        } catch (error) {
            logger.debug('Failed to extract transcript:', error.message);
        }

        // Detect video category
        const category = detectVideoCategory(metadata.title, metadata.description);

        logger.info(`YouTube video extracted: ${metadata.title || videoId}`);

        return {
            title: metadata.title || activity.window_title || '',
            content: transcript || '',
            url,
            metadata: {
                videoId,
                channel: metadata.channel,
                channelUrl: metadata.channelUrl,
                thumbnail: metadata.thumbnail,
                category,
                source: 'youtube',
                extractionMethod: transcript ? 'transcript-api' : 'metadata-only',
                hasTranscript: !!transcript,
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

export {
    extractYouTubeTranscript,
    extractVideoId,
    getVideoMetadata,
    detectVideoCategory,
};