/**
 * Text utility functions for normalizing and matching user inputs
 */

/**
 * Normalizes text by converting to lowercase, removing punctuation,
 * standardizing spaces, and removing common articles and filler words
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')        // Standardize spaces
    .replace(/[^\w\s]/g, '')     // Remove punctuation
    .replace(/\b(the|a|an|some|bit|of|little|few|many|much|lot|lots|my|your|their|his|her|its|our)\b/g, '') // Remove articles and common fillers
    .trim();
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) === a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // substitution
          matrix[i][j-1] + 1,   // insertion
          matrix[i-1][j] + 1    // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculates word-based similarity between two strings
 */
function wordBasedSimilarity(text1, text2) {
  const words1 = new Set(normalizeText(text1).split(' ').filter(w => w.length > 0));
  const words2 = new Set(normalizeText(text2).split(' ').filter(w => w.length > 0));
  
  // Find intersection and union
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Determines if two strings match using a combination of methods
 */
function isFuzzyMatch(text1, text2, threshold = 0.7) {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  // First check - exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }
  
  // For very short texts (1-2 words), use character-based
  if (normalized1.split(' ').length <= 2 && normalized2.split(' ').length <= 2) {
    // Skip Levenshtein for very different length strings
    if (Math.max(normalized1.length, normalized2.length) > 2 * Math.min(normalized1.length, normalized2.length)) {
      return false;
    }
    
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= threshold;
  }
  
  // For longer phrases, use word-based similarity
  const wordSimilarity = wordBasedSimilarity(normalized1, normalized2);
  return wordSimilarity >= 0.5; // More lenient threshold for word-based
}

/**
 * Groups similar answers together when tallying votes
 */
function groupSimilarAnswers(votes) {
  const groups = {};
  const mappings = {};
  
  // First round: Count exact normalized matches
  votes.forEach(vote => {
    const normalized = normalizeText(vote);
    groups[normalized] = (groups[normalized] || 0) + 1;
    
    // Remember original form for each normalized version
    if (!mappings[normalized] || vote.length < mappings[normalized].length) {
      mappings[normalized] = vote;
    }
  });
  
  // Second round: Merge similar answers
  const mergedGroups = {};
  const processedKeys = new Set();
  
  Object.keys(groups).forEach(key1 => {
    if (processedKeys.has(key1)) return;
    
    let bestRepresentative = mappings[key1];
    let totalCount = groups[key1];
    processedKeys.add(key1);
    
    // Check if this should be merged with any other answers
    Object.keys(groups).forEach(key2 => {
      if (key1 !== key2 && !processedKeys.has(key2)) {
        if (isFuzzyMatch(key1, key2)) {
          totalCount += groups[key2];
          processedKeys.add(key2);
          
          // Use the more common entry as representative
          if (groups[key2] > groups[key1] || 
             (groups[key2] === groups[key1] && mappings[key2].length < bestRepresentative.length)) {
            bestRepresentative = mappings[key2];
          }
        }
      }
    });
    
    mergedGroups[bestRepresentative] = totalCount;
  });
  
  return mergedGroups;
}

// For testing/debugging
function testMatching(text1, text2) {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  const levenDistance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const charSimilarity = 1 - (levenDistance / maxLength);
  
  const wordSim = wordBasedSimilarity(text1, text2);
  const isMatch = isFuzzyMatch(text1, text2);
  
  return {
    original: { text1, text2 },
    normalized: { text1: normalized1, text2: normalized2 },
    metrics: { 
      levenshteinDistance: levenDistance,
      characterSimilarity: charSimilarity, 
      wordSimilarity: wordSim 
    },
    isMatch
  };
}

module.exports = {
  normalizeText,
  levenshteinDistance,
  wordBasedSimilarity,
  isFuzzyMatch,
  groupSimilarAnswers,
  testMatching
};