import type { McpServer } from "@modelcontextprotocol/server";
import { isIP } from "node:net";
import { z } from "zod";
import { compileOpenApiLead, openApiCompilerEnabled } from "../runtime/openApiCompiler.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

const leadSchema = z.object({
  source: z.literal("apis_guru"),
  directory_id: z.string().min(1),
  provider: z.string().min(1),
  title: z.string(),
  description: z.string(),
  spec_url: z.string().url(),
  directory_url: z.string().url().nullable(),
  openapi_version: z.string().nullable(),
  score: z.number().min(0).max(1),
  matched_terms: z.array(z.string()),
  demand_intent: z.string().min(2),
  normalized_intent: z.string().min(2),
});

function safePublicSpecUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (isIP(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function registerOpenApiCompilerTool(server: McpServer) {
  server.registerTool("compile_openapi_candidate", {
    description: "On a trusted compiler worker, fetch an unverified OpenAPI lead and compile its most demand-relevant GET operation into a deterministic Theta supply-candidate draft. Compilation never verifies or promotes the provider.",
    inputSchema: z.object({
      lead: leadSchema,
      capability: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
      family: z.string().min(1).optional(),
      verification_inputs: z.array(z.record(z.string(), z.unknown())).optional().describe("Optional real replay inputs. If fewer than two are supplied, Theta.2 returns needs_verification_inputs rather than inventing them."),
    }),
  }, async args => {
    if (!openApiCompilerEnabled()) {
      return content({ status: "disabled", reason: "OpenAPI compilation is disabled on this public runtime. Enable only on a trusted compiler worker with MISSING_OPENAPI_COMPILER_ENABLED=1." });
    }
    if (!safePublicSpecUrl(args.lead.spec_url)) {
      return content({ status: "rejected", reason: "spec_url must be a credential-free public HTTPS hostname" });
    }
    return content(await compileOpenApiLead(args.lead, {
      capability: args.capability,
      family: args.family,
      verificationInputs: args.verification_inputs,
    }));
  });
}
