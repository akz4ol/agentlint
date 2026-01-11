/**
 * Hash utilities for AgentLint
 */

import * as crypto from 'crypto';

/**
 * Generate SHA256 hash of content
 */
export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a stable finding ID based on rule, path, line, and evidence
 */
export function generateFindingId(
  ruleId: string,
  path: string,
  startLine: number,
  evidence: string
): string {
  const normalized = `${ruleId}|${path}|${startLine}|${normalizeEvidence(evidence)}`;
  return `sha256:${sha256(normalized).substring(0, 16)}`;
}

/**
 * Generate location-based fingerprint
 */
export function generateLocationFingerprint(
  ruleId: string,
  path: string,
  startLine: number,
  endLine: number
): string {
  const data = `${ruleId}|${path}|${startLine}|${endLine}`;
  return `sha256:${sha256(data).substring(0, 16)}`;
}

/**
 * Generate content-based fingerprint
 */
export function generateContentFingerprint(
  ruleId: string,
  evidence: string
): string {
  const data = `${ruleId}|${normalizeEvidence(evidence)}`;
  return `sha256:${sha256(data).substring(0, 16)}`;
}

/**
 * Normalize evidence string for consistent hashing
 */
function normalizeEvidence(evidence: string): string {
  return evidence
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate document hash
 */
export function hashDocument(content: string): string {
  return `sha256:${sha256(content)}`;
}
