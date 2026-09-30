/**
 * Integration adapters — interfaces/placeholders only.
 * connectionStatus is honest: not_configured or demo.
 * execute() and healthCheck() never call real external APIs in V0.
 */

import type {
  AdapterExecuteInput,
  AdapterExecuteOutput,
  ConnectionStatus,
  IntegrationAdapterMeta,
} from "@/types";

export interface IntegrationAdapter extends IntegrationAdapterMeta {
  execute(input: AdapterExecuteInput): Promise<AdapterExecuteOutput>;
  healthCheck(): Promise<{ ok: boolean; status: ConnectionStatus; message: string }>;
}

function placeholderAdapter(
  id: string,
  name: string,
  capabilities: string[],
): IntegrationAdapter {
  return {
    id,
    name,
    capabilities,
    connectionStatus: "not_configured",
    async execute(input) {
      return {
        ok: false,
        simulated: true,
        message: `[${name}] Not configured. Refused action "${input.action}" — no credentials, no external call.`,
      };
    },
    async healthCheck() {
      return {
        ok: false,
        status: "not_configured",
        message: `${name} is not configured in V0.`,
      };
    },
  };
}

export const adapters: IntegrationAdapter[] = [
  placeholderAdapter("openai", "OpenAI", ["chat", "embeddings"]),
  placeholderAdapter("cursor", "Cursor", ["code_agent", "investigate"]),
  placeholderAdapter("claude", "Claude", ["chat", "analysis"]),
  placeholderAdapter("grok", "Grok / xAI", ["chat", "research"]),
  placeholderAdapter("github", "GitHub", ["repos", "issues", "prs"]),
  placeholderAdapter("vercel", "Vercel", ["deployments", "logs"]),
  placeholderAdapter("supabase", "Supabase", ["db", "auth"]),
  placeholderAdapter("stripe", "Stripe", ["billing", "webhooks"]),
  placeholderAdapter("google-calendar", "Google Calendar", ["events", "availability"]),
  placeholderAdapter("gmail", "Gmail", ["read", "draft"]),
];

export function getAdapter(id: string): IntegrationAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

export function listAdapters(): IntegrationAdapter[] {
  return adapters;
}
