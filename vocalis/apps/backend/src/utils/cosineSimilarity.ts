/**
 * Standalone Cosine Similarity calculation utility.
 *
 * Cosine similarity formula:
 *   cos(θ) = (A · B) / (||A|| * ||B||)
 *
 * Requirements:
 * - Rejects empty vectors
 * - Rejects mismatched dimensions
 * - Handles zero-magnitude vectors safely (returns 0)
 * - Guarantees result is bounded within [-1, 1]
 * - Does not mutate input vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error('Vectors must be valid arrays of numbers');
  }

  if (a.length === 0 || b.length === 0) {
    throw new Error('Cannot compute cosine similarity of empty vectors');
  }

  if (a.length !== b.length) {
    throw new Error(
      `Dimension mismatch: vector A has length ${a.length} while vector B has length ${b.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];

    if (typeof valA !== 'number' || typeof valB !== 'number' || isNaN(valA) || isNaN(valB)) {
      throw new Error(
        `Vector elements must be valid numbers; encountered invalid value at index ${i}`
      );
    }

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  // Handle zero-magnitude vectors safely (e.g. vector of all zeros)
  if (normA === 0 || normB === 0) {
    return 0;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  const similarity = dotProduct / magnitude;

  // Clamp to [-1, 1] to guard against floating-point inaccuracies (e.g. 1.0000000000000002)
  return Math.max(-1, Math.min(1, similarity));
}
