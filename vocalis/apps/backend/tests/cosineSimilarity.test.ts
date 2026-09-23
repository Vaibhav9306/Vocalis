import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/utils/cosineSimilarity';

describe('cosineSimilarity', () => {
  // 1. Identical vectors → similarity ≈ 1
  it('should return 1 for identical vectors', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  // 2. Collinear / parallel vectors with different scales → similarity ≈ 1
  it('should return 1 for parallel scaled vectors', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  // 3. Orthogonal vectors → similarity ≈ 0
  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(0.0, 5);
  });

  // 4. Opposite vectors → similarity ≈ -1
  it('should return -1 for opposite vectors', () => {
    const a = [1, -2, 3];
    const b = [-1, 2, -3];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(-1.0, 5);
  });

  // 5. Normal decimal vectors
  it('should accurately compute cosine similarity for floating point values', () => {
    const a = [0.1, 0.45, -0.2, 0.8];
    const b = [0.12, 0.40, -0.18, 0.75];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.95);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });

  // 6. Mismatched dimensions → controlled error
  it('should throw an error when vector dimensions mismatch', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow(/dimension mismatch/i);
  });

  // 7. Empty vectors → controlled error
  it('should throw an error when either vector is empty', () => {
    expect(() => cosineSimilarity([], [1, 2])).toThrow(/empty/i);
    expect(() => cosineSimilarity([1, 2], [])).toThrow(/empty/i);
    expect(() => cosineSimilarity([], [])).toThrow(/empty/i);
  });

  // 8. Zero-magnitude vector → controlled behavior (returns 0)
  it('should safely return 0 when a vector has zero magnitude (all zeros)', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(b, a)).toBe(0);
    expect(cosineSimilarity(a, a)).toBe(0);
  });

  // 9. Verify inputs are not mutated
  it('should not mutate input vectors during calculation', () => {
    const a = [0.5, -0.2, 0.8];
    const b = [0.1, 0.9, -0.4];
    const originalA = [...a];
    const originalB = [...b];

    cosineSimilarity(a, b);

    expect(a).toEqual(originalA);
    expect(b).toEqual(originalB);
  });
});
