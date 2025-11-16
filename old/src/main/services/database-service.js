import { insertActivity, insertSummary, insertEmbedding, getActivityById } from '../storage/sqlite-db.js';
import { storeEmbedding, querySimilarEmbeddings } from '../storage/chromadb-client.js';
import { createNode, createRelationship, getRelatedNodes } from '../storage/graph-client.js';
import logger from '../utils/logger.js';

// Store complete activity with AI processing results
async function storeActivityWithAI(activity, aiResult) {
    try {
        // 1. Store activity in SQLite
        const activityId = await insertActivity(activity);
        logger.info(`Activity stored in SQLite: ${activityId}`);

        // 2. Store summary in SQLite
        let summaryId = null;
        if (aiResult.summary) {
            summaryId = await insertSummary({
                activity_id: activityId,
                summary_text: aiResult.summary.summary,
                key_concepts: aiResult.concepts?.concepts?.map(c => c.text) || [],
                complexity: aiResult.summary.complexity || 'intermediate',
                sentiment: aiResult.summary.sentiment || 0.0,
            });
            logger.info(`Summary stored in SQLite: ${summaryId}`);
        }

        // 3. Store embedding in ChromaDB
        if (aiResult.embedding && summaryId) {
            try {
                await storeEmbedding({
                    id: `embedding_${summaryId}`,
                    embedding: aiResult.embedding.embedding,
                    document: aiResult.summary.summary,
                    metadata: {
                        activity_id: activityId,
                        summary_id: summaryId,
                        title: activity.title,
                        source_type: activity.source_type,
                        complexity: aiResult.summary.complexity,
                        sentiment: aiResult.summary.sentiment,
                    },
                });
                logger.info(`Embedding stored in ChromaDB: ${summaryId}`);

                // Also store in SQLite for backup
                await insertEmbedding({
                    summary_id: summaryId,
                    vector: aiResult.embedding.embedding,
                    model_version: aiResult.embedding.model,
                });
            } catch (error) {
                logger.error('Error storing embedding:', error);
            }
        }

        // 4. Store concepts in Neo4j
        if (aiResult.concepts && aiResult.concepts.concepts) {
            try {
                await storeConceptsInGraph(activityId, aiResult.concepts.concepts, activity);
                logger.info(`Concepts stored in Neo4j: ${aiResult.concepts.concepts.length}`);
            } catch (error) {
                logger.error('Error storing concepts in Neo4j:', error);
            }
        }

        return {
            activityId,
            summaryId,
            success: true,
        };
    } catch (error) {
        logger.error('Error storing activity with AI results:', error);
        throw error;
    }
}

// Store concepts in Neo4j graph
async function storeConceptsInGraph(activityId, concepts, activity) {
    const nodes = [];
    const relationships = [];

    // Create activity node
    const activityNode = await createNode({
        label: 'Activity',
        properties: {
            id: `activity_${activityId}`,
            title: activity.title,
            source_type: activity.source_type,
            url: activity.url || null,
            timestamp: activity.timestamp || new Date().toISOString(),
        },
    });
    nodes.push(activityNode);

    // Create concept nodes and relationships
    for (const concept of concepts) {
        const conceptId = `concept_${concept.text.toLowerCase().replace(/\s+/g, '_')}`;

        // Create or get concept node
        let conceptNode;
        try {
            conceptNode = await createNode({
                label: 'Concept',
                properties: {
                    id: conceptId,
                    name: concept.text,
                    label: concept.label,
                    confidence: concept.confidence,
                },
            });
            nodes.push(conceptNode);
        } catch (error) {
            // Node might already exist, continue
            logger.debug(`Concept node might already exist: ${conceptId}`);
        }

        // Create relationship: Activity -[LEARNED_FROM]-> Concept
        try {
            await createRelationship({
                fromId: `activity_${activityId}`,
                fromLabel: 'Activity',
                toId: conceptId,
                toLabel: 'Concept',
                relationshipType: 'LEARNED_FROM',
                properties: {
                    confidence: concept.confidence,
                },
            });
            relationships.push({ from: activityId, to: conceptId, type: 'LEARNED_FROM' });
        } catch (error) {
            logger.debug(`Relationship might already exist: ${activityId} -> ${conceptId}`);
        }
    }

    return { nodes, relationships };
}

// Find similar activities using embeddings
async function findSimilarActivities(activityId, limit = 5) {
    try {
        // Get activity and its embedding
        const activity = await getActivityById(activityId);
        if (!activity) {
            throw new Error(`Activity ${activityId} not found`);
        }

        // Get embedding from ChromaDB
        const embeddingData = await querySimilarEmbeddings(
            null, // We'll need to get the embedding first
            limit + 1, // +1 to exclude the query itself
            { activity_id: { $ne: activityId } }
        );

        return embeddingData.map(item => ({
            activityId: item.metadata.activity_id,
            title: item.metadata.title,
            similarity: 1 - item.distance, // Convert distance to similarity
            summary: item.document,
        }));
    } catch (error) {
        logger.error('Error finding similar activities:', error);
        throw error;
    }
}

// Get knowledge graph data for visualization
async function getGraphData(limit = 100) {
    try {
        const { queryGraph } = await import('../storage/graph-client.js');
        const results = await queryGraph('MATCH_ACTIVITY_CONCEPTS', { limit });

        // Format for visualization (same as before)
        const nodes = new Map();
        const edges = [];

        results.forEach(record => {
            const activity = record.a;
            const concept = record.c;
            const relationship = record.r;

            // Add activity node
            if (!nodes.has(activity.properties.id)) {
                nodes.set(activity.properties.id, {
                    id: activity.properties.id,
                    label: activity.properties.title,
                    type: 'Activity',
                    properties: activity.properties,
                });
            }

            // Add concept node
            if (!nodes.has(concept.properties.id)) {
                nodes.set(concept.properties.id, {
                    id: concept.properties.id,
                    label: concept.properties.name,
                    type: 'Concept',
                    properties: concept.properties,
                });
            }

            // Add edge
            edges.push({
                source: activity.properties.id,
                target: concept.properties.id,
                type: 'LEARNED_FROM',
                properties: relationship.properties,
            });
        });

        return {
            nodes: Array.from(nodes.values()),
            edges,
        };
    } catch (error) {
        logger.error('Error getting graph data:', error);
        return { nodes: [], edges: [] };
    }
}

// Get related concepts for a given concept
async function getRelatedConcepts(conceptName, limit = 10) {
    try {
        const conceptId = `concept_${conceptName.toLowerCase().replace(/\s+/g, '_')}`;

        const related = await getRelatedNodes(conceptId, 'Concept', null, limit);

        return related.map(item => ({
            name: item.node.properties.name,
            relationshipType: item.relationshipType,
            properties: item.node.properties,
        }));
    } catch (error) {
        logger.error('Error getting related concepts:', error);
        return [];
    }
}

export {
    storeActivityWithAI,
    storeConceptsInGraph,
    findSimilarActivities,
    getGraphData,
    getRelatedConcepts,
};