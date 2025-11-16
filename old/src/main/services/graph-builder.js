import { querySimilarEmbeddings, getAllEmbeddings } from '../storage/chromadb-client.js';
import { getAppConfig } from '../utils/config-manager.js';
import logger from '../utils/logger.js';
import { createRelationship, queryGraph, getNodeById } from '../storage/graph-client.js';

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

        return {
            nodes: stats.nodes,
            relationships: stats.relationships,
        };
    } catch (error) {
        logger.error('Error getting graph statistics:', error);
        return { nodes: {}, relationships: {} };
    }
}

async function buildKnowledgeGraph(options = {}) {
    const {
        conceptThreshold = 0.7,
        activityThreshold = 0.75,
        buildTopics = true,
        limit = 100,
    } = options;

    const conceptRel = await buildConceptRelationships(conceptThreshold, limit);
    const activityRel = await buildActivityRelationships(activityThreshold, limit);
    let topicClusters = { clustersCreated: 0 };
    if (buildTopics) {
        topicClusters = await buildTopicClusters();
    }

    return {
        conceptRelationships: conceptRel.relationshipsCreated,
        activityRelationships: activityRel.relationshipsCreated,
        topicClusters: topicClusters.clustersCreated,
    };
}


export {
    buildKnowledgeGraph,
    buildConceptRelationships,
    buildActivityRelationships,
    buildTopicClusters,
    calculateSimilarity,
    getGraphStatistics,
};