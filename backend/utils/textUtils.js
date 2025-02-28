/**
 * Normalizes text by converting to lowercase, removing punctuation,
 * standardizing spaces, and removing common articles
 */
function normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')        // Standardize spaces
      .replace(/[^\w\s]/g, '')     // Remove punctuation
      .replace(/\bthe\b|\ba\b|\ban\b/g, '') // Remove articles
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
   * Determines if two strings match based on fuzzy matching
   */
  function isFuzzyMatch(text1, text2, threshold = 0.85) {
    const normalized1 = normalizeText(text1);
    const normalized2 = normalizeText(text2);
    
    // For very short texts, require exact match
    if (normalized1.length < 4 || normalized2.length < 4) {
      return normalized1 === normalized2;
    }
    
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= threshold;
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
          if (isFuzzyMatch(key1, key2, 0.85)) {
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
  
  module.exports = {
    normalizeText,
    levenshteinDistance,
    isFuzzyMatch,
    groupSimilarAnswers
  };