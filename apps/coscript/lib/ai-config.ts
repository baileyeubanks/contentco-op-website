// Centralized AI model configuration
// Update this single file when switching model versions

export const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514";
export const AI_MAX_TOKENS = 2048;
export const ANTHROPIC_API_VERSION = "2023-06-01";

export function getAnthropicHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_API_VERSION,
  };
}
