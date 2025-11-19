import logger from '../utils/logger.js';
import { getActivities, getActivitiesBySession } from '../storage/sqlite-db.js';
import { getSessionById, getSessions } from '../storage/sqlite-db.js';
import { queryGraph } from '../storage/graph-client.js';
import { getActivityEntities } from '../storage/sqlite-db.js';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, subWeeks } from 'date-fns';
import axios from 'axios';
import { getAppConfig } from '../utils/config-manager.js';

// AI service URL helper
function getAIServiceURL() {
    const config = getAppConfig();
    return config.aiServiceURL || 'http://127.0.0.1:8000';
}

/**
 * Wrapper: Generate daily summary enhanced by AI.
 * Uses the basic implementation and then tries to enhance with AI service.
 */
async function generateDailySummary(date) {
    try {
        const basicSummary = await generateDailySummaryBasic(date);

        // Try to enhance with AI
        try {
            const url = getAIServiceURL();
            const response = await axios.post(
                `${url}/api/v1/generate-insights`,
                {
                    activities_data: {
                        date: format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd'),
                        activities: basicSummary.byType,
                        sessions: basicSummary.sessionSummaries,
                        concepts: basicSummary.concepts,
                        time_spent: Object.fromEntries(
                            Object.entries(basicSummary.byType).map(([type, data]) => [
                                type,
                                Math.floor((data.duration || 0) / 60)
                            ])
                        ),
                    },
                    insight_type: 'daily',
                },
                { timeout: 30000 }
            );

            return {
                ...basicSummary,
                aiSummary: response.data.insights?.summary || null,
                aiInsights: response.data.insights?.insights || [],
            };
        } catch (aiError) {
            logger.warn('AI summary generation failed, using basic summary:', aiError?.message || aiError);
            return basicSummary;
        }
    } catch (error) {
        logger.error('Error generating daily summary (wrapper):', error);
        throw error;
    }
}

/**
 * Basic daily summary implementation (original code)
 */
async function generateDailySummaryBasic(date) {
    try {
        const targetDate = date instanceof Date ? date : new Date(date);
        const start = startOfDay(targetDate).toISOString();
        const end = endOfDay(targetDate).toISOString();

        const activities = await getActivities({
            startDate: start,
            endDate: end,
        });

        // Group by activity type
        const byType = {};
        const sessions = new Set();
        let totalDuration = 0;

        activities.forEach(activity => {
            const type = activity.activity_type || activity.source_type || 'other';
            if (!byType[type]) {
                byType[type] = {
                    count: 0,
                    duration: 0,
                    activities: [],
                };
            }
            byType[type].count++;
            byType[type].activities.push(activity);

            if (activity.session_id) {
                sessions.add(activity.session_id);
            }
        });

        // Get session summaries
        const sessionSummaries = [];
        for (const sessionId of sessions) {
            const session = await getSessionById(sessionId);
            if (session && session.summary) {
                sessionSummaries.push({
                    type: session.activity_type,
                    summary: session.summary,
                    duration: session.duration_seconds,
                });
                totalDuration += session.duration_seconds || 0;
            }
        }

        // Extract key concepts learned
        const concepts = await extractDailyConcepts(activities);

        const summary = {
            date: format(targetDate, 'yyyy-MM-dd'),
            totalActivities: activities.length,
            totalSessions: sessions.size,
            totalDurationSeconds: totalDuration,
            byType,
            sessionSummaries,
            concepts,
            insights: generateInsights(byType, concepts),
        };

        logger.info(`Daily summary generated for ${format(targetDate, 'yyyy-MM-dd')}`);
        return summary;
    } catch (error) {
        logger.error('Error generating daily summary (basic):', error);
        throw error;
    }
}

/**
 * Wrapper: Generate weekly insights enhanced with AI.
 */
async function generateWeeklyInsights(weekStart) {
    try {
        const basicInsights = await generateWeeklyInsightsBasic(weekStart);

        // Enhance with AI
        try {
            const url = getAIServiceURL();
            const response = await axios.post(
                `${url}/api/v1/generate-insights`,
                {
                    activities_data: {
                        week_start: basicInsights.weekStart,
                        week_end: basicInsights.weekEnd,
                        total_activities: basicInsights.totalActivities,
                        daily_stats: basicInsights.dailyStats,
                        type_stats: basicInsights.typeStats,
                        concepts: basicInsights.concepts,
                        time_distribution: Object.fromEntries(
                            Object.entries(basicInsights.typeStats).map(([type, count]) => [
                                type,
                                count * 5 // Estimate 5 min per activity
                            ])
                        ),
                    },
                    insight_type: 'weekly',
                },
                { timeout: 30000 }
            );

            return {
                ...basicInsights,
                aiSummary: response.data.insights?.summary || null,
                aiPatterns: response.data.insights?.patterns || [],
                aiRecommendations: response.data.insights?.recommendations || [],
                aiKnowledgeGrains: response.data.insights?.knowledge_grains || [],
            };
        } catch (aiError) {
            logger.warn('AI insights generation failed, using basic insights:', aiError?.message || aiError);
            return basicInsights;
        }
    } catch (error) {
        logger.error('Error generating weekly insights (wrapper):', error);
        throw error;
    }
}

/**
 * Basic weekly insights implementation (original code)
 */
async function generateWeeklyInsightsBasic(weekStart) {
    try {
        const start = startOfWeek(weekStart instanceof Date ? weekStart : new Date(weekStart)).toISOString();
        const end = endOfWeek(weekStart instanceof Date ? weekStart : new Date(weekStart)).toISOString();

        const activities = await getActivities({
            startDate: start,
            endDate: end,
        });

        // Group by day
        const dailyStats = {};
        const typeStats = {};
        const concepts = new Set();

        activities.forEach(activity => {
            const date = format(new Date(activity.timestamp || activity.created_at), 'yyyy-MM-dd');
            if (!dailyStats[date]) {
                dailyStats[date] = { count: 0, types: {} };
            }
            dailyStats[date].count++;

            const type = activity.activity_type || activity.source_type || 'other';
            dailyStats[date].types[type] = (dailyStats[date].types[type] || 0) + 1;
            typeStats[type] = (typeStats[type] || 0) + 1;

            // Extract concepts
            if (activity.metadata?.concepts) {
                const activityConcepts = Array.isArray(activity.metadata.concepts)
                    ? activity.metadata.concepts
                    : JSON.parse(activity.metadata.concepts || '[]');
                activityConcepts.forEach(c => concepts.add(c));
            }
        });

        // Identify patterns
        const patterns = identifyPatterns(activities, dailyStats);

        // Generate recommendations
        const recommendations = generateRecommendations(activities, typeStats, Array.from(concepts));

        return {
            weekStart: format(new Date(start), 'yyyy-MM-dd'),
            weekEnd: format(new Date(end), 'yyyy-MM-dd'),
            totalActivities: activities.length,
            dailyStats,
            typeStats,
            concepts: Array.from(concepts),
            patterns,
            recommendations,
        };
    } catch (error) {
        logger.error('Error generating weekly insights (basic):', error);
        throw error;
    }
}

/**
 * Wrapper: Identify learning gaps enhanced by AI
 */
async function identifyLearningGaps() {
    try {
        const basicGaps = await identifyLearningGapsBasic();

        if (!basicGaps || basicGaps.length === 0) {
            return [];
        }

        // Enhance with AI
        try {
            const url = getAIServiceURL();
            const response = await axios.post(
                `${url}/api/v1/generate-insights`,
                {
                    activities_data: {
                        gaps: basicGaps,
                    },
                    insight_type: 'gaps',
                },
                { timeout: 30000 }
            );

            return response.data.insights || basicGaps;
        } catch (aiError) {
            logger.warn('AI gap analysis failed, using basic gaps:', aiError?.message || aiError);
            return basicGaps;
        }
    } catch (error) {
        logger.error('Error identifying learning gaps (wrapper):', error);
        return [];
    }
}

/**
 * Basic identifyLearningGaps implementation (original code)
 */
async function identifyLearningGapsBasic() {
    try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
        const watchingActivities = await getActivities({
            startDate: thirtyDaysAgo,
            activity_type: 'watching',
            limit: 100,
        });

        const gaps = [];

        for (const activity of watchingActivities) {
            // Extract concepts from watching activity
            const concepts = await extractEntitiesFromActivity(activity);

            for (const concept of concepts) {
                if (concept.entityType === 'topic') {
                    // Check if concept was applied in coding activities
                    const applied = await queryGraph('MATCH_APPLIED', {
                        conceptId: `concept_${concept.entityName.toLowerCase().replace(/\s+/g, '_')}`,
                    });

                    if (applied.length === 0) {
                        // Learning gap found
                        gaps.push({
                            concept: concept.entityName,
                            watchedIn: activity.title,
                            watchedDate: activity.timestamp,
                            daysSince: Math.floor(
                                (new Date().getTime() - new Date(activity.timestamp).getTime()) / (24 * 60 * 60 * 1000)
                            ),
                        });
                    }
                }
            }
        }

        // Sort by days since (oldest first)
        gaps.sort((a, b) => b.daysSince - a.daysSince);

        logger.info(`Identified ${gaps.length} learning gaps`);
        return gaps;
    } catch (error) {
        logger.error('Error identifying learning gaps (basic):', error);
        return [];
    }
}

/**
 * Wrapper: Suggest focus areas enhanced by AI
 */
async function suggestFocusAreas() {
    try {
        const basicSuggestions = await suggestFocusAreasBasic();

        // Enhance with AI
        try {
            const url = getAIServiceURL();
            const response = await axios.post(
                `${url}/api/v1/generate-insights`,
                {
                    activities_data: {
                        type_distribution: basicSuggestions.typeDistribution || {},
                        time_by_type: basicSuggestions.timeByType || {},
                        top_concepts: basicSuggestions.topConcepts || [],
                    },
                    insight_type: 'focus',
                },
                { timeout: 30000 }
            );

            return response.data.insights || basicSuggestions;
        } catch (aiError) {
            logger.warn('AI focus areas failed, using basic suggestions:', aiError?.message || aiError);
            return basicSuggestions;
        }
    } catch (error) {
        logger.error('Error suggesting focus areas (wrapper):', error);
        return [];
    }
}

/**
 * Basic suggestFocusAreas implementation (original code)
 */
async function suggestFocusAreasBasic() {
    try {
        const twoWeeksAgo = subDays(new Date(), 14).toISOString();
        const activities = await getActivities({
            startDate: twoWeeksAgo,
            limit: 200,
        });

        // Analyze activity distribution
        const typeDistribution = {};
        const conceptFrequency = new Map();

        activities.forEach(activity => {
            const type = activity.activity_type || activity.source_type || 'other';
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;

            // Count concepts
            if (activity.metadata?.concepts) {
                const concepts = Array.isArray(activity.metadata.concepts)
                    ? activity.metadata.concepts
                    : JSON.parse(activity.metadata.concepts || '[]');
                concepts.forEach(c => {
                    conceptFrequency.set(c, (conceptFrequency.get(c) || 0) + 1);
                });
            }
        });

        // Calculate time spent per type
        const sessions = await getSessions({
            startDate: twoWeeksAgo,
        });

        const timeByType = {};
        sessions.forEach(session => {
            const type = session.activity_type;
            timeByType[type] = (timeByType[type] || 0) + (session.duration_seconds || 0);
        });

        // Generate suggestions
        const suggestions = [];

        // Check for imbalance
        const totalTime = Object.values(timeByType).reduce((sum, t) => sum + t, 0);
        const watchingTime = timeByType.watching || 0;
        const codingTime = timeByType.coding || 0;

        if (watchingTime > 0 && codingTime === 0) {
            suggestions.push({
                type: 'apply_learning',
                message: 'You\'ve been watching tutorials but haven\'t coded. Consider applying what you learned.',
                priority: 'high',
            });
        }

        if (watchingTime > codingTime * 2) {
            suggestions.push({
                type: 'balance_learning',
                message: 'You\'re watching more than coding. Try to code more to reinforce learning.',
                priority: 'medium',
            });
        }

        // Top concepts to focus on
        const topConcepts = Array.from(conceptFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([concept, count]) => ({ concept, frequency: count }));

        if (topConcepts.length > 0) {
            suggestions.push({
                type: 'focus_topics',
                message: `Focus areas: ${topConcepts.map(c => c.concept).join(', ')}`,
                priority: 'low',
                concepts: topConcepts,
            });
        }

        // Attach metadata to the returned structure for the wrapper AI call
        const result = {
            typeDistribution,
            timeByType,
            topConcepts,
            suggestions,
        };

        return result;
    } catch (error) {
        logger.error('Error suggesting focus areas (basic):', error);
        return {
            typeDistribution: {},
            timeByType: {},
            topConcepts: [],
            suggestions: [],
        };
    }
}

/**
 * Track progress on a specific topic
 */
async function trackProgress(topic) {
    try {
        const conceptId = `concept_${topic.toLowerCase().replace(/\s+/g, '_')}`;

        // Get all activities related to this concept
        const watched = await queryGraph('MATCH_LEARNED_FROM', {
            conceptId,
            activityType: ['watching', 'reading'],
        });

        const applied = await queryGraph('MATCH_APPLIED', {
            conceptId,
        });

        // Calculate progress metrics
        const progress = {
            topic,
            watchedCount: watched.length,
            appliedCount: applied.length,
            applicationRate: watched.length > 0 ? (applied.length / watched.length) * 100 : 0,
            firstWatched: watched.length > 0 ? watched[0].timestamp : null,
            lastApplied: applied.length > 0 ? applied[applied.length - 1].timestamp : null,
            activities: {
                watched: watched.map(w => ({
                    activityId: w.activityId,
                    timestamp: w.timestamp,
                })),
                applied: applied.map(a => ({
                    activityId: a.activityId,
                    timestamp: a.timestamp,
                })),
            },
        };

        return progress;
    } catch (error) {
        logger.error('Error tracking progress:', error);
        return null;
    }
}

/**
 * Extract concepts from activities for daily summary
 */
async function extractDailyConcepts(activities) {
    const concepts = new Set();

    for (const activity of activities) {
        if (activity.metadata?.concepts) {
            const activityConcepts = Array.isArray(activity.metadata.concepts)
                ? activity.metadata.concepts
                : JSON.parse(activity.metadata.concepts || '[]');
            activityConcepts.forEach(c => concepts.add(c));
        }
    }

    return Array.from(concepts);
}

/**
 * Generate insights from activity data
 */
function generateInsights(byType, concepts) {
    const insights = [];

    // Learning insight
    if (byType.watching && byType.watching.count > 0) {
        insights.push(`Watched ${byType.watching.count} video${byType.watching.count > 1 ? 's' : ''}`);
    }

    if (byType.coding && byType.coding.count > 0) {
        insights.push(`Coded in ${byType.coding.count} session${byType.coding.count > 1 ? 's' : ''}`);
    }

    if (concepts.length > 0) {
        insights.push(`Learned about: ${concepts.slice(0, 3).join(', ')}${concepts.length > 3 ? '...' : ''}`);
    }

    return insights;
}

/**
 * Identify patterns in activities
 */
function identifyPatterns(activities, dailyStats) {
    const patterns = [];

    // Check for consistent daily activity
    const activeDays = Object.keys(dailyStats).length;
    if (activeDays >= 5) {
        patterns.push({
            type: 'consistent_activity',
            description: `Active ${activeDays} out of 7 days`,
        });
    }

    // Check for learning → application pattern
    const hasWatching = Object.keys(dailyStats).some(day => dailyStats[day].types.watching);
    const hasCoding = Object.keys(dailyStats).some(day => dailyStats[day].types.coding);

    if (hasWatching && hasCoding) {
        patterns.push({
            type: 'learning_application',
            description: 'Balanced learning and application',
        });
    } else if (hasWatching && !hasCoding) {
        patterns.push({
            type: 'learning_only',
            description: 'Watching but not coding - consider applying what you learn',
        });
    }

    return patterns;
}

/**
 * Generate recommendations
 */
function generateRecommendations(activities, typeStats, concepts) {
    const recommendations = [];

    // Check learning → application ratio
    const watchingCount = typeStats.watching || 0;
    const codingCount = typeStats.coding || 0;

    if (watchingCount > codingCount * 2) {
        recommendations.push({
            type: 'apply_learning',
            message: 'You\'ve watched more tutorials than coded. Try applying what you learned.',
            priority: 'high',
        });
    }

    // Suggest focusing on top concepts
    if (concepts.length > 0) {
        recommendations.push({
            type: 'focus_concepts',
            message: `Continue learning about: ${concepts.slice(0, 3).join(', ')}`,
            priority: 'medium',
        });
    }

    return recommendations;
}

// Helper function to extract entities (import from graph-builder)
async function extractEntitiesFromActivity(activity) {
    const { extractEntitiesFromActivity } = await import('./graph-builder.js');
    return await extractEntitiesFromActivity(activity);
}

// Helper function to get sessions
async function getSessions(filters = {}) {
    try {
        const db = await import('../storage/sqlite-db.js');
        return await db.getSessions(filters);
    } catch (error) {
        logger.error('Error getting sessions:', error);
        return [];
    }
}

export {
    generateDailySummary,
    generateWeeklyInsights,
    identifyLearningGaps,
    suggestFocusAreas,
    trackProgress,
};