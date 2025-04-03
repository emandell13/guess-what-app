// backend/utils/semanticUtils.js
const { pipeline } = require('@xenova/transformers');
const { normalizeText } = require('./textUtils');

// Cache for embeddings to improve performance
const embeddingCache = new Map();
// Cache for similarity results to avoid recalculating
const similarityCache = new Map();

// Initialize the embedding model
let embeddingModel = null;
let modelLoading = false;
const modelLoadingQueue = [];

async function getEmbeddingModel() {
    if (embeddingModel) return embeddingModel;
    
    // If model is already loading, wait for it
    if (modelLoading) {
        return new Promise((resolve) => {
            modelLoadingQueue.push(resolve);
        });
    }
    
    try {
        modelLoading = true;
        console.log('Loading sentence embedding model...');
        // Use the smallest but still effective model for embeddings
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Sentence embedding model loaded successfully');
        
        // Resolve any pending promises
        modelLoadingQueue.forEach(resolve => resolve(embeddingModel));
        modelLoadingQueue.length = 0;
        
        return embeddingModel;
    } catch (error) {
        console.error('Error loading sentence embedding model:', error);
        modelLoading = false;
        throw error;
    }
}

/**
 * Generate an embedding for a text string
 * @param {string} text - The text to generate embedding for
 * @returns {Promise<Array>} - The embedding vector
 */
async function getEmbedding(text) {
    const normalizedText = normalizeText(text);
    
    // Return from cache if available
    if (embeddingCache.has(normalizedText)) {
        return embeddingCache.get(normalizedText);
    }
    
    try {
        const model = await getEmbeddingModel();
        const result = await model(normalizedText, { pooling: 'mean', normalize: true });
        
        // Get the embedding vector
        const embedding = Array.from(result.data);
        
        // Store in cache for future use
        embeddingCache.set(normalizedText, embedding);
        
        return embedding;
    } catch (error) {
        console.error(`Error generating embedding for text "${text}":`, error);
        return null;
    }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    return dotProduct / (mag1 * mag2);
}

/**
 * Check if two texts are semantically similar
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @param {object} options - Options for similarity
 * @param {number} options.threshold - Similarity threshold (0-1)
 * @param {string} options.questionContext - The question context for better matching
 * @returns {Promise<boolean>} - Whether the texts are similar
 */
async function isSemanticMatch(text1, text2, options = {}) {
    const { 
        threshold = 0.75, 
        questionContext = null 
    } = options;
    
    // Normalize texts
    const normalizedText1 = normalizeText(text1);
    const normalizedText2 = normalizeText(text2);
    
    // Exact match after normalization
    if (normalizedText1 === normalizedText2) return true;
    
    // Simple pre-checks for very short texts
    // If one is <3 chars and the other is >10, likely not a match
    if ((normalizedText1.length < 3 && normalizedText2.length > 10) || 
        (normalizedText2.length < 3 && normalizedText1.length > 10)) {
        return false;
    }
    
    // Check cache for this comparison
    const cacheKey = `${normalizedText1}|${normalizedText2}|${questionContext || ''}`;
    if (similarityCache.has(cacheKey)) {
        return similarityCache.get(cacheKey) >= threshold;
    }
    
    try {
        let similarity;
        
        if (questionContext) {
            // If we have question context, use it to influence the similarity calculation
            // Get embeddings for both texts and the question context
            const [embedding1, embedding2, questionEmbedding] = await Promise.all([
                getEmbedding(normalizedText1),
                getEmbedding(normalizedText2),
                getEmbedding(questionContext)
            ]);
            
            if (!embedding1 || !embedding2 || !questionEmbedding) return false;
            
            // Calculate base similarity between texts
            const baseSimilarity = cosineSimilarity(embedding1, embedding2);
            
            // Calculate similarities of each text to the question context
            const text1ToQuestion = cosineSimilarity(embedding1, questionEmbedding);
            const text2ToQuestion = cosineSimilarity(embedding2, questionEmbedding);
            
            // If both texts are similarly relevant to the question, boost their similarity
            const questionRelevanceDiff = Math.abs(text1ToQuestion - text2ToQuestion);
            const relevanceBoost = 1 - questionRelevanceDiff;
            
            // Apply weighted combination: 70% base similarity, 30% question relevance boost
            similarity = (baseSimilarity * 0.7) + (relevanceBoost * 0.3);
            
            console.log(`Semantic matching with question context: 
              Base similarity: ${baseSimilarity.toFixed(4)}
              Text1 to question: ${text1ToQuestion.toFixed(4)}
              Text2 to question: ${text2ToQuestion.toFixed(4)}
              Relevance diff: ${questionRelevanceDiff.toFixed(4)}
              Boost: ${relevanceBoost.toFixed(4)}
              Final similarity: ${similarity.toFixed(4)}`);
        } else {
            // Standard similarity calculation without question context
            const [embedding1, embedding2] = await Promise.all([
                getEmbedding(normalizedText1),
                getEmbedding(normalizedText2)
            ]);
            
            if (!embedding1 || !embedding2) return false;
            
            // Calculate similarity
            similarity = cosineSimilarity(embedding1, embedding2);
        }
        
        // Store in cache
        similarityCache.set(cacheKey, similarity);
        
        // Return result based on threshold
        return similarity >= threshold;
    } catch (error) {
        console.error('Error in semantic matching:', error);
        // Fall back to fuzzy matching from textUtils if semantic matching fails
        const { isFuzzyMatch } = require('./textUtils');
        return isFuzzyMatch(text1, text2, threshold);
    }
}

/**
 * Group similar answers using semantic similarity
 * @param {Array<string>} answers - Array of answer strings
 * @param {object} options - Options for grouping
 * @param {string} options.questionContext - The question for context
 * @returns {Promise<object>} - Grouped answers with counts and mappings
 */
async function groupSimilarAnswers(answers, options = {}) {
    const groups = {};
    const mappings = {};
    const voteToAnswerMapping = {};
    
    // First round: Count exact normalized matches
    answers.forEach(answer => {
        const normalized = normalizeText(answer);
        groups[normalized] = (groups[normalized] || 0) + 1;
        
        // Remember original form for each normalized version
        if (!mappings[normalized] || answer.length < mappings[normalized].length) {
            mappings[normalized] = answer;
        }
    });
    
    // Second round: Merge semantically similar answers
    const mergedGroups = {};
    const processedKeys = new Set();
    
    // Sort keys by frequency to prioritize more common answers
    const sortedKeys = Object.keys(groups).sort((a, b) => groups[b] - groups[a]);
    
    for (const key1 of sortedKeys) {
        if (processedKeys.has(key1)) continue;
        
        let bestRepresentative = mappings[key1];
        let totalCount = groups[key1];
        processedKeys.add(key1);
        
        // Add mapping for this answer
        voteToAnswerMapping[key1] = bestRepresentative;
        
        // Check if this should be merged with any other answers
        for (const key2 of sortedKeys) {
            if (key1 !== key2 && !processedKeys.has(key2)) {
                const isMatch = await isSemanticMatch(key1, key2, options);
                
                if (isMatch) {
                    totalCount += groups[key2];
                    processedKeys.add(key2);
                    
                    // Add mapping for this similar answer
                    voteToAnswerMapping[key2] = bestRepresentative;
                    
                    // Use the more common entry as representative, or shorter if tied
                    if (groups[key2] > groups[key1] || 
                        (groups[key2] === groups[key1] && mappings[key2].length < bestRepresentative.length)) {
                        bestRepresentative = mappings[key2];
                        
                        // Update all previous mappings to this new best representative
                        Object.keys(voteToAnswerMapping).forEach(key => {
                            if (voteToAnswerMapping[key] === mappings[key1]) {
                                voteToAnswerMapping[key] = bestRepresentative;
                            }
                        });
                    }
                }
            }
        }
        
        mergedGroups[bestRepresentative] = totalCount;
    }
    
    return {
        groupedAnswers: mergedGroups,
        voteToAnswerMapping
    };
}

/**
 * Test semantic matching between two texts
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @param {object} options - Options for testing
 * @returns {Promise<Object>} - Test results
 */
async function testSemanticMatching(text1, text2, options = {}) {
    try {
        const normalized1 = normalizeText(text1);
        const normalized2 = normalizeText(text2);
        const questionContext = options.questionContext;
        
        console.log(`Normalized texts: "${normalized1}" and "${normalized2}"`);
        
        // First check for direct match after normalization
        const exactMatch = normalized1 === normalized2;
        if (exactMatch) {
            return {
                original: { text1, text2 },
                normalized: { text1: normalized1, text2: normalized2 },
                questionContext: questionContext || null,
                metrics: { 
                    semanticSimilarity: 1.0,
                },
                isMatch: true
            };
        }
        
        let metrics = {};
        let isMatch = false;
        
        if (questionContext) {
            // Get embeddings for both texts and the question context
            const [embedding1, embedding2, questionEmbedding] = await Promise.all([
                getEmbedding(normalized1),
                getEmbedding(normalized2),
                getEmbedding(questionContext)
            ]);
            
            if (!embedding1 || !embedding2 || !questionEmbedding) {
                throw new Error('Failed to generate embeddings');
            }
            
            // Calculate base similarity between texts
            const baseSimilarity = cosineSimilarity(embedding1, embedding2);
            
            // Calculate similarities of each text to the question context
            const text1ToQuestion = cosineSimilarity(embedding1, questionEmbedding);
            const text2ToQuestion = cosineSimilarity(embedding2, questionEmbedding);
            
            // If both texts are similarly relevant to the question, boost their similarity
            const questionRelevanceDiff = Math.abs(text1ToQuestion - text2ToQuestion);
            const relevanceBoost = 1 - questionRelevanceDiff;
            
            // Apply weighted combination: 70% base similarity, 30% question relevance boost
            const finalSimilarity = (baseSimilarity * 0.7) + (relevanceBoost * 0.3);
            
            metrics = {
                baseSimilarity,
                text1ToQuestion,
                text2ToQuestion,
                questionRelevanceDiff,
                relevanceBoost,
                semanticSimilarity: finalSimilarity
            };
            
            isMatch = finalSimilarity >= (options.threshold || 0.75);
        } else {
            // Standard similarity calculation without question context
            const [embedding1, embedding2] = await Promise.all([
                getEmbedding(normalized1),
                getEmbedding(normalized2)
            ]);
            
            if (!embedding1 || !embedding2) {
                throw new Error('Failed to generate embeddings');
            }
            
            // Calculate similarity
            const semanticSimilarity = cosineSimilarity(embedding1, embedding2);
            metrics = { semanticSimilarity };
            isMatch = semanticSimilarity >= (options.threshold || 0.75);
        }
        
        return {
            original: { text1, text2 },
            normalized: { text1: normalized1, text2: normalized2 },
            questionContext: questionContext || null,
            metrics,
            isMatch
        };
    } catch (error) {
        console.error('Error in semantic matching test:', error);
        return {
            original: { text1, text2 },
            normalized: { text1: normalizeText(text1), text2: normalizeText(text2) },
            questionContext: options.questionContext || null,
            error: error.message || 'Unknown error in semantic matching'
        };
    }
}

// Export functions
module.exports = {
    isSemanticMatch,
    groupSimilarAnswers,
    testSemanticMatching,
    getEmbedding
};