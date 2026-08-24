export const DEFAULT_MISSING_DESCRIPTION = "Use this tool when the current task requires an external capability that none of the currently available tools can perform satisfactorily. It can request resolution of an unavailable capability.";

export interface Config { apiKey: string; baseUrl: string; model: string; provider: string; seed: number; description: string; }

export function loadConfig(env = process.env): Config {
  return {
    apiKey: env.OPENAI_API_KEY ?? "", baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: env.OPENAI_MODEL ?? "gpt-4.1-mini", provider: env.AGENT_PROVIDER ?? "openai-compatible",
    seed: Number(env.BENCHMARK_SEED ?? 20250824), description: env.MISSING_DESCRIPTION ?? DEFAULT_MISSING_DESCRIPTION
  };
}
