import { querySimilarEmbeddings, getAllEmbeddings } from '../storage/lancedb-client.js';
import { getAppConfig } from '../utils/config-manager.js';
import logger from '../utils/logger.js';
import { createRelationship, queryGraph, getNodeById } from '../storage/graph-client.js';
import { getActivities, getActivityById, getActivitiesBySession } from '../storage/sqlite-db.js';
import { extractConcepts } from './ai-service-client.js';
import { insertActivityEntity } from '../storage/sqlite-db.js';

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
        return 0;
    }

    return dotProduct / denominator;
}

// Calculate similarity between two embeddings
function calculateSimilarity(embedding1, embedding2) {
    try {
        return cosineSimilarity(embedding1, embedding2);
    } catch (error) {
        logger.error('Error calculating similarity:', error);
        return 0;
    }
}

/**
 * Extract entities from activity using enhanced NER
 * @param {Object} activity - Activity object
 * @returns {Promise<Array>} - Array of extracted entities
 */
async function extractEntitiesFromActivity(activity) {
    try {
        const text = `${activity.title || ''} ${activity.content || ''}`.trim();

        if (!text || text.length < 10) {
            return [];
        }

        // Use AI service to extract entities
        const concepts = await extractConcepts(text, 0.5);

        if (!concepts || !concepts.concepts) {
            return [];
        }

        // Map concepts to entities
        const entities = concepts.concepts.map(concept => ({
            entityType: mapConceptToEntityType(concept.label),
            entityName: concept.text,
            confidence: concept.confidence,
            start: concept.start,
            end: concept.end,
        }));

        // Extract specialized entities (movies, games, books, projects)
        const specialized = extractSpecializedEntities(activity);
        entities.push(...specialized);

        return entities;
    } catch (error) {
        logger.error('Error extracting entities from activity:', error);
        return [];
    }
}

/**
 * Map concept labels to entity types
 */
function mapConceptToEntityType(conceptLabel) {
    const mapping = {
        'PERSON': 'person',
        'ORGANIZATION': 'organization',
        'TECH': 'topic',
        'LOCATION': 'location',
        'OTHER': 'topic',
    };
    return mapping[conceptLabel] || 'topic';
}

/**
 * Extract specialized entities from activity metadata
 */
function extractSpecializedEntities(activity) {
    const entities = [];

    // Movie/Video
    if (activity.activity_type === 'watching' && activity.video_id) {
        entities.push({
            entityType: 'video',
            entityName: activity.title || 'Unknown Video',
            confidence: 0.9,
            metadata: {
                videoId: activity.video_id,
                channel: activity.metadata?.channel,
            },
        });
    }

    // Game
    if (activity.activity_type === 'gaming' && activity.game_name) {
        entities.push({
            entityType: 'game',
            entityName: activity.game_name,
            confidence: 0.9,
            metadata: {
                platform: activity.metadata?.platform,
            },
        });
    }

    // PDF/Book
    if (activity.activity_type === 'reading' && activity.file_path) {
        entities.push({
            entityType: 'pdf',
            entityName: activity.title || activity.file_path,
            confidence: 0.9,
            metadata: {
                filePath: activity.file_path,
            },
        });
    }

    // Project
    if (activity.activity_type === 'coding' && activity.project_name) {
        entities.push({
            entityType: 'project',
            entityName: activity.project_name,
            confidence: 0.9,
            metadata: {
                projectType: activity.metadata?.projectType,
                frameworks: activity.metadata?.frameworks,
            },
        });
    }

    return entities;
}

/**
 * Store entities in activity_entities table
 */
async function storeActivityEntities(activityId, sessionId, entities) {
    try {
        const { v4: uuidv4 } = await import('uuid');

        for (const entity of entities) {
            const entityId = uuidv4();
            await insertActivityEntity({
                id: entityId,
                activity_id: activityId,
                session_id: sessionId,
                entity_type: entity.entityType,
                entity_name: entity.entityName,
                entity_value: JSON.stringify(entity.metadata || {}),
                confidence: entity.confidence || 0.5,
            });
        }

        logger.debug(`Stored ${entities.length} entities for activity ${activityId}`);
    } catch (error) {
        logger.error('Error storing activity entities:', error);
    }
}

/**
 * Build learning flow relationships: WATCHED → LEARNED → APPLIED
 */
async function buildLearningFlowRelationships(activityId, activity) {
    try {
        const activityType = activity.activity_type || activity.source_type;
        const concepts = await extractEntitiesFromActivity(activity);

        // Create activity node if not exists
        await createNode({
            label: 'Activity',
            properties: {
                id: `activity_${activityId}`,
                title: activity.title || activity.window_title,
                activity_type: activityType,
                source_type: activity.source_type,
                timestamp: activity.timestamp || activity.created_at,
                session_id: activity.session_id,
            },
        });

        // For watching activities, create WATCHED relationship to concepts
        if (activityType === 'watching' || activityType === 'reading') {
            for (const entity of concepts) {
                if (entity.entityType === 'topic' || entity.entityType === 'video' || entity.entityType === 'pdf') {
                    const conceptId = `concept_${entity.entityName.toLowerCase().replace(/\s+/g, '_')}`;

                    // Create concept node
                    await createNode({
                        label: 'Concept',
                        properties: {
                            id: conceptId,
                            name: entity.entityName,
                            entity_type: entity.entityType,
                            confidence: entity.confidence,
                        },
                    });

                    // Create WATCHED or READ relationship
                    await createRelationship({
                        fromId: `activity_${activityId}`,
                        fromLabel: 'Activity',
                        toId: conceptId,
                        toLabel: 'Concept',
                        relationshipType: activityType === 'watching' ? 'WATCHED' : 'READ',
                        properties: {
                            confidence: entity.confidence,
                            timestamp: activity.timestamp,
                        },
                    });
                }
            }
        }

        // For coding activities, create APPLIED relationship to concepts
        if (activityType === 'coding') {
            // Find concepts from previous watching/reading activities
            const similarActivities = await findRelatedLearningActivities(activity);

            for (const relatedActivity of similarActivities) {
                const relatedConcepts = await extractEntitiesFromActivity(relatedActivity);

                for (const concept of relatedConcepts) {
                    if (concept.entityType === 'topic') {
                        const conceptId = `concept_${concept.entityName.toLowerCase().replace(/\s+/g, '_')}`;

                        // Check if this concept was learned from watching/reading
                        const learnedFrom = await queryGraph('MATCH_LEARNED_FROM', {
                            conceptId,
                            activityType: ['watching', 'reading'],
                        });

                        if (learnedFrom.length > 0) {
                            // Create APPLIED relationship
                            await createRelationship({
                                fromId: `activity_${activityId}`,
                                fromLabel: 'Activity',
                                toId: conceptId,
                                toLabel: 'Concept',
                                relationshipType: 'APPLIED',
                                properties: {
                                    confidence: concept.confidence,
                                    timestamp: activity.timestamp,
                                    learned_from: learnedFrom[0].activityId,
                                },
                            });
                        }
                    }
                }
            }
        }

        // Store entities in database
        if (activity.session_id) {
            await storeActivityEntities(activityId, activity.session_id, concepts);
        }
    } catch (error) {
        logger.error('Error building learning flow relationships:', error);
    }
}

/**
 * Find related learning activities (watching/reading) for a coding activity
 */
async function findRelatedLearningActivities(codingActivity) {
    try {
        // Get activities from recent sessions (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activities = await getActivities({
            startDate: sevenDaysAgo.toISOString(),
            activityType: ['watching', 'reading'],
            limit: 50,
        });

        // Find similar activities using semantic search
        const { findSimilarActivities } = await import('./semantic-search-service.js');
        const similar = await findSimilarActivities(codingActivity.id, 10);

        return similar.map(s => s.activityId).map(id =>
            activities.find(a => a.id === id)
        ).filter(Boolean);
    } catch (error) {
        logger.error('Error finding related learning activities:', error);
        return [];
    }
}

/**
 * Build temporal relationships: BEFORE → AFTER
 */
async function buildTemporalRelationships(activityId, activity) {
    try {
        // Get previous activity in same session
        if (!activity.session_id) {
            return;
        }

        const sessionActivities = await getActivitiesBySession(activity.session_id);
        const currentIndex = sessionActivities.findIndex(a => a.id === activityId);

        if (currentIndex > 0) {
            const previousActivity = sessionActivities[currentIndex - 1];

            await createRelationship({
                fromId: `activity_${previousActivity.id}`,
                fromLabel: 'Activity',
                toId: `activity_${activityId}`,
                toLabel: 'Activity',
                relationshipType: 'BEFORE',
                properties: {
                    time_gap_seconds: Math.floor(
                        (new Date(activity.timestamp) - new Date(previousActivity.timestamp)) / 1000
                    ),
                    same_session: true,
                },
            });
        }
    } catch (error) {
        logger.error('Error building temporal relationships:', error);
    }
}

/**
 * Build topic relationships: RELATED_TO, PREREQUISITE_OF
 */
async function buildTopicRelationships(conceptId1, conceptId2, similarity, metadata1, metadata2) {
    try {
        // RELATED_TO - concepts are similar
        if (similarity >= 0.7) {
            await createRelationship({
                fromId: conceptId1,
                fromLabel: 'Concept',
                toId: conceptId2,
                toLabel: 'Concept',
                relationshipType: 'RELATED_TO',
                properties: {
                    similarity,
                    source: 'embedding_similarity',
                },
            });
        }

        // PREREQUISITE_OF - if one concept appears before another consistently
        const timestamp1 = metadata1.timestamp || metadata1.created_at;
        const timestamp2 = metadata2.timestamp || metadata2.created_at;

        if (timestamp1 && timestamp2) {
            const date1 = new Date(timestamp1);
            const date2 = new Date(timestamp2);

            // If concept1 appears significantly earlier and they're related
            if (date1 < date2 && (date2 - date1) > 7 * 24 * 60 * 60 * 1000 && similarity >= 0.6) {
                await createRelationship({
                    fromId: conceptId1,
                    fromLabel: 'Concept',
                    toId: conceptId2,
                    toLabel: 'Concept',
                    relationshipType: 'PREREQUISITE_OF',
                    properties: {
                        similarity,
                        days_between: Math.floor((date2 - date1) / (24 * 60 * 60 * 1000)),
                    },
                });
            }
        }
    } catch (error) {
        logger.error('Error building topic relationships:', error);
    }
}

/**
 * Build project relationships: WORKED_ON, USED_IN
 */
async function buildProjectRelationships(activityId, activity) {
    try {
        if (activity.activity_type !== 'coding' || !activity.project_name) {
            return;
        }

        const projectId = `project_${activity.project_name.toLowerCase().replace(/\s+/g, '_')}`;

        // Create project node
        await createNode({
            label: 'Project',
            properties: {
                id: projectId,
                name: activity.project_name,
                project_type: activity.metadata?.projectType,
                frameworks: activity.metadata?.frameworks || [],
            },
        });

        // Create WORKED_ON relationship
        await createRelationship({
            fromId: `activity_${activityId}`,
            fromLabel: 'Activity',
            toId: projectId,
            toLabel: 'Project',
            relationshipType: 'WORKED_ON',
            properties: {
                timestamp: activity.timestamp,
            },
        });

        // Create USED_IN relationships for frameworks
        if (activity.metadata?.frameworks) {
            for (const framework of activity.metadata.frameworks) {
                const frameworkId = `framework_${framework.toLowerCase().replace(/\s+/g, '_')}`;

                await createNode({
                    label: 'Framework',
                    properties: {
                        id: frameworkId,
                        name: framework,
                    },
                });

                await createRelationship({
                    fromId: projectId,
                    fromLabel: 'Project',
                    toId: frameworkId,
                    toLabel: 'Framework',
                    relationshipType: 'USED_IN',
                    properties: {},
                });
            }
        }
    } catch (error) {
        logger.error('Error building project relationships:', error);
    }
}

// Build relationships between concepts based on embeddings
async function buildConceptRelationships(threshold = 0.7, limit = 100) {
    try {
        logger.info('Building concept relationships...');

        // Get all embeddings from ChromaDB
        const embeddingsData = await getAllEmbeddings(limit);

        if (embeddingsData.ids.length < 2) {
            logger.info('Not enough embeddings to build relationships');
            return { relationshipsCreated: 0 };
        }

        const relationships = [];
        const processed = new Set();

        // Compare each embedding with others
        for (let i = 0; i < embeddingsData.ids.length; i++) {
            const id1 = embeddingsData.ids[i];
            const embedding1 = embeddingsData.embeddings[i];
            const metadata1 = embeddingsData.metadatas[i];

            for (let j = i + 1; j < embeddingsData.ids.length; j++) {
                const id2 = embeddingsData.ids[j];
                const embedding2 = embeddingsData.embeddings[j];
                const metadata2 = embeddingsData.metadatas[j];

                // Skip if same activity
                if (metadata1.activity_id === metadata2.activity_id) {
                    continue;
                }

                // Calculate similarity
                const similarity = calculateSimilarity(embedding1, embedding2);

                if (similarity >= threshold) {
                    const pairKey = `${id1}_${id2}`;
                    if (!processed.has(pairKey)) {
                        relationships.push({
                            from: id1,
                            to: id2,
                            similarity,
                            metadata1,
                            metadata2,
                        });
                        processed.add(pairKey);
                    }
                }
            }
        }

        logger.info(`Found ${relationships.length} potential relationships`);

        // Create relationships in Neo4j
        let created = 0;
        for (const rel of relationships) {
            try {
                // Extract concept IDs from metadata or create from activity
                const conceptIds1 = await getConceptsForActivity(rel.metadata1.activity_id);
                const conceptIds2 = await getConceptsForActivity(rel.metadata2.activity_id);

                // Create relationships between concepts
                for (const conceptId1 of conceptIds1) {
                    for (const conceptId2 of conceptIds2) {
                        if (conceptId1 !== conceptId2) {
                            try {
                                await createRelationship({
                                    fromId: conceptId1,
                                    fromLabel: 'Concept',
                                    toId: conceptId2,
                                    toLabel: 'Concept',
                                    relationshipType: 'RELATED_TO',
                                    properties: {
                                        similarity: rel.similarity,
                                        source: 'embedding_similarity',
                                        created_at: new Date().toISOString(),
                                    },
                                });
                                created++;
                            } catch (error) {
                                // Relationship might already exist
                                logger.debug(`Relationship might already exist: ${conceptId1} -> ${conceptId2}`);
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('Error creating relationship:', error);
            }
        }

        logger.info(`Created ${created} concept relationships`);
        return { relationshipsCreated: created };
    } catch (error) {
        logger.error('Error building concept relationships:', error);
        throw error;
    }
}

// Get concepts for an activity
async function getConceptsForActivity(activityId) {
    try {
        const results = await queryGraph('MATCH_ACTIVITY_CONCEPT', { activityId: `activity_${activityId}` });
        return results.map(r => r.conceptId);
    } catch (error) {
        logger.error('Error getting concepts for activity:', error);
        return [];
    }
}

// Build relationships between activities based on similarity
async function buildActivityRelationships(threshold = 0.75, limit = 50) {
    try {
        logger.info('Building activity relationships...');

        // Get recent activities with embeddings
        const embeddingsData = await getAllEmbeddings(limit);

        if (embeddingsData.ids.length < 2) {
            logger.info('Not enough activities to build relationships');
            return { relationshipsCreated: 0 };
        }

        const relationships = [];
        const processed = new Set();

        // Compare activities
        for (let i = 0; i < embeddingsData.ids.length; i++) {
            const id1 = embeddingsData.ids[i];
            const embedding1 = embeddingsData.embeddings[i];
            const metadata1 = embeddingsData.metadatas[i];

            for (let j = i + 1; j < embeddingsData.ids.length; j++) {
                const id2 = embeddingsData.ids[j];
                const embedding2 = embeddingsData.embeddings[j];
                const metadata2 = embeddingsData.metadatas[j];

                const pairKey = `${metadata1.activity_id}_${metadata2.activity_id}`;
                if (processed.has(pairKey)) {
                    continue;
                }

                const similarity = calculateSimilarity(embedding1, embedding2);

                if (similarity >= threshold) {
                    relationships.push({
                        activityId1: metadata1.activity_id,
                        activityId2: metadata2.activity_id,
                        similarity,
                    });
                    processed.add(pairKey);
                }
            }
        }

        logger.info(`Found ${relationships.length} similar activity pairs`);

        // Create CONNECTS relationships in Neo4j
        let created = 0;
        for (const rel of relationships) {
            try {
                await createRelationship({
                    fromId: `activity_${rel.activityId1}`,
                    fromLabel: 'Activity',
                    toId: `activity_${rel.activityId2}`,
                    toLabel: 'Activity',
                    relationshipType: 'CONNECTS',
                    properties: {
                        similarity: rel.similarity,
                        source: 'embedding_similarity',
                        created_at: new Date().toISOString(),
                    },
                });
                created++;
            } catch (error) {
                logger.debug(`Relationship might already exist: ${rel.activityId1} -> ${rel.activityId2}`);
            }
        }

        logger.info(`Created ${created} activity relationships`);
        return { relationshipsCreated: created };
    } catch (error) {
        logger.error('Error building activity relationships:', error);
        throw error;
    }
}

// Build topic clusters from concepts
async function buildTopicClusters(minClusterSize = 3, similarityThreshold = 0.65) {
    try {
        logger.info('Building topic clusters...');

        const concepts = await queryGraph('MATCH_CONCEPTS', {});

        if (concepts.length < minClusterSize) {
            logger.info('Not enough concepts to build clusters');
            return { clustersCreated: 0 };
        }

        // Get embeddings for concepts (via activities)
        const conceptEmbeddings = new Map();

        for (const concept of concepts) {
            const activities = await queryGraph('MATCH_ACTIVITIES_FOR_CONCEPT', { conceptId: concept.id });

            if (activities.length > 0) {
                // Get embedding for first activity
                const activityId = activities[0].activityId.replace('activity_', '');
                try {
                    const { getEmbeddingById } = await import('../storage/chromadb-client.js');
                    const embedding = await getEmbeddingById(`embedding_${activityId}`);
                    if (embedding) {
                        conceptEmbeddings.set(concept.id, embedding.embedding);
                    }
                } catch (error) {
                    logger.debug(`No embedding found for concept: ${concept.id}`);
                }
            }
        }

        // Simple clustering: group similar concepts
        const clusters = [];
        const assigned = new Set();

        for (const [conceptId1, embedding1] of conceptEmbeddings.entries()) {
            if (assigned.has(conceptId1)) continue;

            const cluster = [conceptId1];
            assigned.add(conceptId1);

            for (const [conceptId2, embedding2] of conceptEmbeddings.entries()) {
                if (conceptId1 === conceptId2 || assigned.has(conceptId2)) continue;

                const similarity = calculateSimilarity(embedding1, embedding2);
                if (similarity >= similarityThreshold) {
                    cluster.push(conceptId2);
                    assigned.add(conceptId2);
                }
            }

            if (cluster.length >= minClusterSize) {
                clusters.push(cluster);
            }
        }

        logger.info(`Found ${clusters.length} topic clusters`);

        // Create Topic nodes and relationships
        let topicsCreated = 0;
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const topicId = `topic_${i + 1}`;

            try {
                const { createNode } = await import('../storage/graph-client.js');
                await createNode({
                    label: 'Topic',
                    properties: {
                        id: topicId,
                        name: `Topic Cluster ${i + 1}`,
                        conceptCount: cluster.length,
                        created_at: new Date().toISOString(),
                    },
                });

                // Link concepts to topic
                for (const conceptId of cluster) {
                    await createRelationship({
                        fromId: topicId,
                        fromLabel: 'Topic',
                        toId: conceptId,
                        toLabel: 'Concept',
                        relationshipType: 'CONTAINS',
                        properties: {},
                    });
                }

                topicsCreated++;
            } catch (error) {
                logger.error('Error creating topic cluster:', error);
            }
        }

        logger.info(`Created ${topicsCreated} topic clusters`);
        return { clustersCreated: topicsCreated };
    } catch (error) {
        logger.error('Error building topic clusters:', error);
        throw error;
    }
}

// Main graph building function
async function getGraphStatistics() {
    try {
        const { getGraphStats } = await import('../storage/graph-client.js');
        const stats = await getGraphStats();

        // Calculate total node count from the object
        const totalNodes = typeof stats.nodes === 'object' && stats.nodes !== null
            ? Object.values(stats.nodes).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0)
            : typeof stats.nodes === 'number' ? stats.nodes : 0;

        // Calculate total edge count from relationships object
        const totalEdges = typeof stats.relationships === 'object' && stats.relationships !== null
            ? Object.values(stats.relationships).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0)
            : typeof stats.relationships === 'number' ? stats.relationships : 0;

        return {
            nodes: totalNodes,
            edges: totalEdges,
            // Optionally include the breakdown for future use
            nodeBreakdown: stats.nodes,
            relationshipBreakdown: stats.relationships,
        };
    } catch (error) {
        logger.error('Error getting graph statistics:', error);
        return { nodes: 0, edges: 0 };
    }
}

async function buildKnowledgeGraph(options = {}) {
    const {
        conceptThreshold = 0.7,
        activityThreshold = 0.75,
        buildTopics = true,
        buildLearningFlows = true,
        limit = 100,
    } = options;

    const results = {
        conceptRelationships: 0,
        activityRelationships: 0,
        topicClusters: 0,
        learningFlows: 0,
    };

    // Build concept relationships
    const conceptRel = await buildConceptRelationships(conceptThreshold, limit);
    results.conceptRelationships = conceptRel.relationshipsCreated;

    // Build activity relationships
    const activityRel = await buildActivityRelationships(activityThreshold, limit);
    results.activityRelationships = activityRel.relationshipsCreated;

    // Build topic clusters
    if (buildTopics) {
        const topicClusters = await buildTopicClusters();
        results.topicClusters = topicClusters.clustersCreated;
    }

    // Build learning flows for recent activities
    if (buildLearningFlows) {
        try {
            const recentActivities = await getActivities({
                limit: 50,
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            });

            for (const activity of recentActivities) {
                await buildActivityGraph(activity.id, activity);
            }
            results.learningFlows = recentActivities.length;
        } catch (error) {
            logger.error('Error building learning flows:', error);
        }
    }

    return results;
}


export {
    buildKnowledgeGraph,
    buildConceptRelationships,
    buildActivityRelationships,
    buildTopicClusters,
    buildLearningFlowRelationships,
    buildTemporalRelationships,
    buildProjectRelationships,
    extractEntitiesFromActivity,
    calculateSimilarity,
    getGraphStatistics,
};