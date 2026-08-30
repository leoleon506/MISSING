import { createHash } from "node:crypto";
import YAML from "yaml";
import type { SupplyCandidate } from "./acquisition.js";
import type { ProviderDiscoveryCandidate } from "./providerDiscovery.js";
import type { ProjectionRule, RuntimeInput } from "./types.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type OpenApiObject = Record<string, any>;

export interface OpenApiCompileResult {
  status: "candidate_ready" | "needs_verification_inputs" | "unsupported";
  lead: ProviderDiscoveryCandidate;
  operation: {
    method: "GET";
    path: string;
    operation_id: string | null;
    summary: string;
    score: number;
    matched_terms: string[];
  } | null;
  candidate: SupplyCandidate | null;
  missing: string[];
  reason: string | null;
}

export function openApiCompilerEnabled(): boolean {
  return process.env.MISSING_OPENAPI_COMPILER_ENABLED === "1";
}

const STOP_WORDS = new Set([
  "a", "an", "and", "api", "for", "from", "in", "is", "me", "number", "of", "on", "or", "the", "this", "to", "with",
  "validate", "validation", "verify", "check", "find", "get", "lookup", "locate",
]);

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])].filter(token => !STOP_WORDS.has(token));
}

function slug(value: string, fallback: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "");
  return normalized || fallback;
}

function resolveRef(spec: OpenApiObject, value: any): any {
  if (!value || typeof value !== "object" || typeof value.$ref !== "string") return value;
  const ref = value.$ref as string;
  if (!ref.startsWith("#/")) return value;
  let current: any = spec;
  for (const part of ref.slice(2).split("/")) {
    current = current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return current ?? value;
}

function parseSpec(text: string): OpenApiObject {
  const parsed = YAML.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("OpenAPI document is not an object");
  return parsed as OpenApiObject;
}

function baseUrlFor(spec: OpenApiObject, operation: any): string | null {
  const server = operation?.servers?.[0]?.url ?? spec.servers?.[0]?.url;
  if (typeof server === "string" && server.startsWith("https://") && !server.includes("{")) return server.replace(/\/$/, "");
  if (spec.swagger === "2.0" && typeof spec.host === "string") {
    const schemes: string[] = Array.isArray(spec.schemes) ? spec.schemes : ["https"];
    if (!schemes.includes("https")) return null;
    const basePath = typeof spec.basePath === "string" ? spec.basePath.replace(/\/$/, "") : "";
    return `https://${spec.host}${basePath}`;
  }
  return null;
}

function responseSchema(spec: OpenApiObject, operation: any): any {
  const responses = operation?.responses ?? {};
  const response = responses["200"] ?? responses["201"] ?? responses.default;
  if (!response) return null;
  const resolved = resolveRef(spec, response);
  const schema = resolved?.content?.["application/json"]?.schema ?? resolved?.schema;
  return resolveRef(spec, schema);
}

function topLevelProjection(spec: OpenApiObject, schema: any): { projection: Record<string, ProjectionRule>; required: string[] } {
  const resolved = resolveRef(spec, schema);
  if (!resolved || resolved.type !== "object" || !resolved.properties || typeof resolved.properties !== "object") {
    return { projection: {}, required: [] };
  }
  const projection: Record<string, ProjectionRule> = {};
  const declaredRequired = new Set(Array.isArray(resolved.required) ? resolved.required : []);
  for (const key of Object.keys(resolved.properties).sort().slice(0, 12)) {
    projection[key] = { op: "FIELD", path: key };
  }
  const required = [...declaredRequired].filter(field => typeof field === "string" && projection[field]);
  if (!required.length) required.push(...Object.keys(projection).slice(0, Math.min(3, Object.keys(projection).length)));
  return { projection, required };
}

function operationParameters(spec: OpenApiObject, pathItem: any, operation: any): any[] {
  const combined = [...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []), ...(Array.isArray(operation?.parameters) ? operation.parameters : [])];
  return combined.map(param => resolveRef(spec, param)).filter(Boolean);
}

function operationScore(path: string, operation: any, lead: ProviderDiscoveryCandidate) {
  const query = tokens(`${lead.normalized_intent} ${lead.matched_terms.join(" ")}`);
  const summary = [operation?.operationId, operation?.summary, operation?.description, path, ...(operation?.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const matched = query.filter(term => summary.includes(term));
  const coverage = query.length ? matched.length / query.length : 0;
  const operationIdBonus = matched.filter(term => String(operation?.operationId ?? "").toLowerCase().includes(term)).length * 0.08;
  const pathBonus = matched.filter(term => path.toLowerCase().includes(term)).length * 0.05;
  return { score: Number(Math.min(1, coverage * 0.8 + operationIdBonus + pathBonus).toFixed(4)), matched };
}

function selectOperation(spec: OpenApiObject, lead: ProviderDiscoveryCandidate) {
  const choices: Array<{ path: string; pathItem: any; operation: any; score: number; matched: string[] }> = [];
  for (const [path, rawPathItem] of Object.entries(spec.paths ?? {})) {
    const pathItem = resolveRef(spec, rawPathItem);
    const operation = pathItem?.get;
    if (!operation) continue;
    const scored = operationScore(path, operation, lead);
    choices.push({ path, pathItem, operation, score: scored.score, matched: scored.matched });
  }
  choices.sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.path.localeCompare(b.path));
  return choices[0] ?? null;
}

function deriveBindings(spec: OpenApiObject, pathItem: any, operation: any) {
  const path_bindings: Record<string, string> = {};
  const query_bindings: Record<string, string> = {};
  const inputs = new Set<string>();
  for (const param of operationParameters(spec, pathItem, operation)) {
    if (typeof param?.name !== "string" || (param.in !== "path" && param.in !== "query")) continue;
    if (param.required !== true && param.in !== "path") continue;
    const inputName = slug(param.name, "input");
    inputs.add(inputName);
    if (param.in === "path") path_bindings[param.name] = `$input.${inputName}`;
    else query_bindings[param.name] = `$input.${inputName}`;
  }
  return { path_bindings, query_bindings, inputs: [...inputs] };
}

function candidateId(lead: ProviderDiscoveryCandidate, path: string): string {
  const hash = createHash("sha256").update(`${lead.directory_id}|${lead.spec_url}|${path}`).digest("hex").slice(0, 16);
  return `theta2_${hash}`;
}

export async function compileOpenApiLead(
  lead: ProviderDiscoveryCandidate,
  options: {
    fetchFn?: FetchLike;
    verificationInputs?: RuntimeInput[];
    capability?: string;
    family?: string;
  } = {},
): Promise<OpenApiCompileResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(lead.spec_url, { headers: { accept: "application/json, application/yaml, text/yaml, */*", "user-agent": "MISSING-Theta2/0.2" } });
  if (!response.ok) throw new Error(`OpenAPI spec request failed with HTTP ${response.status}`);
  const spec = parseSpec(await response.text());
  const selected = selectOperation(spec, lead);
  if (!selected) return { status: "unsupported", lead, operation: null, candidate: null, missing: ["get_operation"], reason: "No GET operation was found in the OpenAPI document" };

  const base_url = baseUrlFor(spec, selected.operation);
  if (!base_url) return { status: "unsupported", lead, operation: null, candidate: null, missing: ["https_base_url"], reason: "Could not derive a static HTTPS base URL" };

  const { path_bindings, query_bindings, inputs } = deriveBindings(spec, selected.pathItem, selected.operation);
  const { projection, required } = topLevelProjection(spec, responseSchema(spec, selected.operation));
  if (!Object.keys(projection).length) {
    return {
      status: "unsupported",
      lead,
      operation: { method: "GET", path: selected.path, operation_id: selected.operation.operationId ?? null, summary: selected.operation.summary ?? "", score: selected.score, matched_terms: selected.matched },
      candidate: null,
      missing: ["object_response_projection"],
      reason: "The selected operation does not expose a simple top-level JSON object schema that Theta can project deterministically",
    };
  }

  const verification_inputs = options.verificationInputs ?? [];
  const capability = options.capability ?? `${slug(lead.normalized_intent, "discovered")}_capability`;
  const candidate: SupplyCandidate = {
    candidate_id: candidateId(lead, selected.path),
    demand_intent: lead.demand_intent,
    capability,
    family: options.family ?? "discovered",
    provider: lead.provider,
    evidence_url: lead.spec_url,
    method: "GET",
    base_url,
    path_template: selected.path,
    path_bindings,
    query_bindings,
    projection,
    required,
    verification_inputs,
  };

  const missing: string[] = [];
  if (inputs.length && verification_inputs.length < 2) missing.push("verification_inputs");
  if (!inputs.length && verification_inputs.length < 2) missing.push("verification_inputs");
  return {
    status: missing.length ? "needs_verification_inputs" : "candidate_ready",
    lead,
    operation: { method: "GET", path: selected.path, operation_id: selected.operation.operationId ?? null, summary: selected.operation.summary ?? "", score: selected.score, matched_terms: selected.matched },
    candidate,
    missing,
    reason: missing.length ? "Theta requires at least two independent replay inputs before verification; the compiler will not invent them" : null,
  };
}
