import { createHash } from "node:crypto";
import YAML from "yaml";
import type { SupplyCandidate } from "./acquisition.js";
import type { ProviderDiscoveryCandidate } from "./providerDiscovery.js";
import {
  assessSafePostVerification,
  type SafePostParameterDescriptor,
  type SafePostVerificationAssessment,
} from "./safePostPolicy.js";
import type { HttpMethod, ProjectionRule, RuntimeInput } from "./types.js";
import { harvestVerificationInputs, type VerificationInputEvidence } from "./verificationInputHarvest.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type OpenApiObject = Record<string, any>;

type SelectedOperation = {
  method: HttpMethod;
  path: string;
  pathItem: any;
  operation: any;
  score: number;
  matched: string[];
};

export interface ProviderReadinessDiagnostics {
  credentials_required: string[];
  response_schema_missing: boolean;
}

export interface OpenApiCompileResult {
  status:
    | "candidate_ready"
    | "candidate_ready_for_safe_post_replay"
    | "needs_verification_inputs"
    | "needs_safe_verification"
    | "needs_provider_setup"
    | "unsupported";
  lead: ProviderDiscoveryCandidate;
  operation: { method: HttpMethod; path: string; operation_id: string | null; summary: string; score: number; matched_terms: string[] } | null;
  candidate: SupplyCandidate | null;
  verification_input_evidence: VerificationInputEvidence[];
  provider_readiness: ProviderReadinessDiagnostics;
  safe_post_verification?: SafePostVerificationAssessment | null;
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

const EMPTY_READINESS: ProviderReadinessDiagnostics = { credentials_required: [], response_schema_missing: false };

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])].filter(token => !STOP_WORDS.has(token));
}

function tokenSet(text: string): Set<string> {
  return new Set(tokens(text));
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
  for (const part of ref.slice(2).split("/")) current = current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
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
  if (!resolved || resolved.type !== "object" || !resolved.properties || typeof resolved.properties !== "object") return { projection: {}, required: [] };
  const projection: Record<string, ProjectionRule> = {};
  const declaredRequired = new Set<string>(Array.isArray(resolved.required) ? resolved.required.filter((field: unknown): field is string => typeof field === "string") : []);
  for (const key of Object.keys(resolved.properties).sort().slice(0, 12)) projection[key] = { op: "FIELD", path: key };
  const required = [...declaredRequired].filter(field => projection[field]);
  if (!required.length) required.push(...Object.keys(projection).slice(0, Math.min(3, Object.keys(projection).length)));
  return { projection, required };
}

function operationParameters(spec: OpenApiObject, pathItem: any, operation: any): any[] {
  const combined = [...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []), ...(Array.isArray(operation?.parameters) ? operation.parameters : [])];
  return combined.map(param => resolveRef(spec, param)).filter(Boolean);
}

function normalizedHeaderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function idempotencyHeader(name: string): boolean {
  const normalized = normalizedHeaderName(name);
  return normalized === "idempotencykey" || normalized === "xidempotencykey";
}

function credentialRequirements(spec: OpenApiObject, pathItem: any, operation: any): string[] {
  const names = new Set<string>();
  for (const param of operationParameters(spec, pathItem, operation)) {
    if (param?.in === "header" && param?.required === true && typeof param?.name === "string" && !idempotencyHeader(param.name)) names.add(param.name);
  }
  const security = operation?.security ?? spec.security;
  if (Array.isArray(security)) {
    for (const requirement of security) {
      if (!requirement || typeof requirement !== "object") continue;
      for (const schemeName of Object.keys(requirement)) names.add(schemeName);
    }
  }
  return [...names].sort();
}

function operationScore(path: string, operation: any, lead: ProviderDiscoveryCandidate) {
  const query = tokens(`${lead.normalized_intent} ${lead.matched_terms.join(" ")}`);
  const operationId = String(operation?.operationId ?? "");
  const summaryText = [operationId, operation?.summary, operation?.description, path, ...(operation?.tags ?? [])].filter(Boolean).join(" ");
  const summaryTokens = tokenSet(summaryText);
  const operationIdTokens = tokenSet(operationId);
  const pathTokens = tokenSet(path);
  const matched = query.filter(term => summaryTokens.has(term));
  const coverage = query.length ? matched.length / query.length : 0;
  const operationIdBonus = matched.filter(term => operationIdTokens.has(term)).length * 0.08;
  const pathBonus = matched.filter(term => pathTokens.has(term)).length * 0.05;
  return { score: Number(Math.min(1, coverage * 0.8 + operationIdBonus + pathBonus).toFixed(4)), matched };
}

function bestOperation(choices: SelectedOperation[]): SelectedOperation | null {
  return [...choices].sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.path.localeCompare(b.path))[0] ?? null;
}

function selectOperation(spec: OpenApiObject, lead: ProviderDiscoveryCandidate): SelectedOperation | null {
  const choices: SelectedOperation[] = [];
  for (const [path, rawPathItem] of Object.entries(spec.paths ?? {})) {
    const pathItem = resolveRef(spec, rawPathItem);
    for (const method of ["GET", "POST"] as const) {
      const operation = pathItem?.[method.toLowerCase()];
      if (!operation) continue;
      const scored = operationScore(path, operation, lead);
      choices.push({ method, path, pathItem, operation, score: scored.score, matched: scored.matched });
    }
  }

  const relevantGet = choices.filter(choice => choice.method === "GET" && choice.score > 0 && choice.matched.length > 0);
  if (relevantGet.length) return bestOperation(relevantGet);
  const relevantPost = choices.filter(choice => choice.method === "POST" && choice.score > 0 && choice.matched.length > 0);
  if (relevantPost.length) return bestOperation(relevantPost);

  const anyGet = choices.filter(choice => choice.method === "GET");
  return bestOperation(anyGet.length ? anyGet : choices);
}

function deriveBindings(spec: OpenApiObject, pathItem: any, operation: any) {
  const path_bindings: Record<string, string> = {};
  const query_bindings: Record<string, string> = {};
  const parameters: Array<{ input_name: string; parameter: any }> = [];
  const safe_descriptors: SafePostParameterDescriptor[] = [];

  for (const param of operationParameters(spec, pathItem, operation)) {
    if (typeof param?.name !== "string") continue;
    const schema = resolveRef(spec, param.schema) ?? null;
    const description = [param.description, schema?.description].filter(Boolean).join(" ");
    if (param.in === "header") {
      safe_descriptors.push({ name: param.name, input_name: null, location: "header", required: param.required === true, schema, description });
      continue;
    }
    if (param.in !== "path" && param.in !== "query") continue;
    const inputName = slug(param.name, "input");
    safe_descriptors.push({ name: param.name, input_name: inputName, location: "query", required: param.required === true, schema, description });
    if (param.required !== true && param.in !== "path") continue;
    parameters.push({ input_name: inputName, parameter: param });
    if (param.in === "path") path_bindings[param.name] = `$input.${inputName}`;
    else query_bindings[param.name] = `$input.${inputName}`;
  }
  return { path_bindings, query_bindings, parameters, safe_descriptors };
}

function requestBodySchema(spec: OpenApiObject, operation: any): any {
  const requestBody = resolveRef(spec, operation?.requestBody);
  const schema = requestBody?.content?.["application/json"]?.schema;
  return resolveRef(spec, schema);
}

function deriveJsonBodyBindings(spec: OpenApiObject, operation: any) {
  const schema = requestBodySchema(spec, operation);
  if (!schema || schema.type !== "object" || !schema.properties || typeof schema.properties !== "object") {
    return { body_bindings: null, parameters: [], safe_descriptors: [], reason: "POST requestBody must declare an application/json top-level object schema" };
  }
  const propertyNames = Object.keys(schema.properties).sort().slice(0, 12);
  if (!propertyNames.length) return { body_bindings: null, parameters: [], safe_descriptors: [], reason: "POST requestBody object has no declared properties" };

  const required = new Set<string>(Array.isArray(schema.required) ? schema.required.filter((field: unknown): field is string => typeof field === "string") : []);
  const selectedNames = required.size ? propertyNames.filter(name => required.has(name)) : propertyNames;
  if (!selectedNames.length) return { body_bindings: null, parameters: [], safe_descriptors: [], reason: "POST requestBody required properties could not be mapped deterministically" };

  const body_bindings: Record<string, string> = {};
  const parameters: Array<{ input_name: string; parameter: any }> = [];
  const safe_descriptors: SafePostParameterDescriptor[] = [];
  for (const name of propertyNames) {
    const inputName = slug(name, "body_field");
    const propertySchema = resolveRef(spec, schema.properties[name]);
    const isRequired = required.has(name) || required.size === 0;
    const description = [propertySchema?.description].filter(Boolean).join(" ");
    safe_descriptors.push({ name, input_name: inputName, location: "body", required: isRequired, schema: propertySchema ?? null, description });
    if (!selectedNames.includes(name)) continue;
    body_bindings[name] = `$input.${inputName}`;
    parameters.push({ input_name: inputName, parameter: { name, required: true, schema: propertySchema } });
  }
  return { body_bindings, parameters, safe_descriptors, reason: null };
}

function candidateId(lead: ProviderDiscoveryCandidate, method: HttpMethod, path: string): string {
  const material = method === "GET"
    ? `${lead.directory_id}|${lead.spec_url}|${path}`
    : `${lead.directory_id}|${lead.spec_url}|POST|${path}`;
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 16);
  return `theta2_${hash}`;
}

function operationView(selected: SelectedOperation) {
  return { method: selected.method, path: selected.path, operation_id: selected.operation.operationId ?? null, summary: selected.operation.summary ?? "", score: selected.score, matched_terms: selected.matched };
}

function applySafeOverrides(inputs: RuntimeInput[], overrides: RuntimeInput): RuntimeInput[] {
  return inputs.map(input => ({ ...structuredClone(input), ...structuredClone(overrides) }));
}

export async function compileOpenApiLead(lead: ProviderDiscoveryCandidate, options: { fetchFn?: FetchLike; verificationInputs?: RuntimeInput[]; capability?: string; family?: string } = {}): Promise<OpenApiCompileResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(lead.spec_url, { headers: { accept: "application/json, application/yaml, text/yaml, */*", "user-agent": "MISSING-Lambda2/0.4" } });
  if (!response.ok) throw new Error(`OpenAPI spec request failed with HTTP ${response.status}`);
  const spec = parseSpec(await response.text());
  const selected = selectOperation(spec, lead);
  if (!selected) return { status: "unsupported", lead, operation: null, candidate: null, verification_input_evidence: [], provider_readiness: EMPTY_READINESS, safe_post_verification: null, missing: ["http_operation"], reason: "No GET or POST operation was found in the OpenAPI document" };
  if (selected.score <= 0 || selected.matched.length === 0) {
    const diagnostic = selected.method === "GET" ? "relevant_get_operation" : "relevant_post_operation";
    return { status: "unsupported", lead, operation: operationView(selected), candidate: null, verification_input_evidence: [], provider_readiness: EMPTY_READINESS, safe_post_verification: null, missing: [diagnostic], reason: `No ${selected.method} operation has semantic overlap with the unresolved demand` };
  }

  const base_url = baseUrlFor(spec, selected.operation);
  if (!base_url) return { status: "unsupported", lead, operation: operationView(selected), candidate: null, verification_input_evidence: [], provider_readiness: EMPTY_READINESS, safe_post_verification: null, missing: ["https_base_url"], reason: "Could not derive a static HTTPS base URL" };

  const credentials_required = credentialRequirements(spec, selected.pathItem, selected.operation);
  const selectedResponseSchema = responseSchema(spec, selected.operation);
  const response_schema_missing = !selectedResponseSchema;
  const provider_readiness: ProviderReadinessDiagnostics = { credentials_required, response_schema_missing };
  if (credentials_required.length || response_schema_missing) {
    const missing = [
      ...credentials_required.map(name => `credential:${name}`),
      ...(response_schema_missing ? ["response_schema"] : []),
    ];
    const reasons = [
      ...(credentials_required.length ? [`credentials required: ${credentials_required.join(", ")}`] : []),
      ...(response_schema_missing ? ["success response schema is not documented"] : []),
    ];
    return {
      status: "needs_provider_setup",
      lead,
      operation: operationView(selected),
      candidate: null,
      verification_input_evidence: [],
      provider_readiness,
      safe_post_verification: null,
      missing,
      reason: `Relevant provider cannot enter verification yet because ${reasons.join("; ")}`,
    };
  }

  const url = deriveBindings(spec, selected.pathItem, selected.operation);
  const path_bindings = { ...url.path_bindings };
  const query_bindings = { ...url.query_bindings };
  let body_bindings: Record<string, string> | undefined;
  let inputParameters = [...url.parameters];
  let safePost: SafePostVerificationAssessment | null = null;

  if (selected.method === "POST") {
    const body = deriveJsonBodyBindings(spec, selected.operation);
    if (!body.body_bindings) {
      return {
        status: "unsupported",
        lead,
        operation: operationView(selected),
        candidate: null,
        verification_input_evidence: [],
        provider_readiness,
        safe_post_verification: null,
        missing: ["json_request_body"],
        reason: body.reason,
      };
    }
    body_bindings = { ...body.body_bindings };
    inputParameters = [...inputParameters, ...body.parameters];
    safePost = assessSafePostVerification({
      base_url,
      operation: selected.operation,
      parameters: [...url.safe_descriptors, ...body.safe_descriptors],
    });

    for (const signal of safePost.signals) {
      if (!signal.sufficient || !signal.input_name || typeof signal.safe_value !== "boolean" || !signal.name || !signal.location) continue;
      if (signal.location === "query") query_bindings[signal.name] = `$input.${signal.input_name}`;
      if (signal.location === "body") body_bindings[signal.name] = `$input.${signal.input_name}`;
    }
    const overrideNames = new Set(Object.keys(safePost.input_overrides));
    inputParameters = inputParameters.filter(parameter => !overrideNames.has(parameter.input_name));
  }

  const { projection, required } = topLevelProjection(spec, selectedResponseSchema);
  if (!Object.keys(projection).length) {
    return { status: "unsupported", lead, operation: operationView(selected), candidate: null, verification_input_evidence: [], provider_readiness, safe_post_verification: safePost, missing: ["object_response_projection"], reason: "The selected operation does not expose a simple top-level JSON object schema that MISSING can project deterministically" };
  }

  const harvested = options.verificationInputs === undefined ? harvestVerificationInputs(inputParameters) : null;
  let verification_inputs = options.verificationInputs ?? harvested?.inputs ?? [];
  if (safePost) verification_inputs = applySafeOverrides(verification_inputs, safePost.input_overrides);

  const capability = options.capability ?? `${slug(lead.normalized_intent, "discovered")}_capability`;
  const candidate: SupplyCandidate = {
    candidate_id: candidateId(lead, selected.method, selected.path), demand_intent: lead.demand_intent, capability, family: options.family ?? "discovered", provider: lead.provider,
    evidence_url: lead.spec_url, method: selected.method, base_url, path_template: selected.path, path_bindings, query_bindings,
    ...(body_bindings ? { body_bindings } : {}),
    projection, required, verification_inputs,
  };

  if (selected.method === "POST" && safePost) {
    if (safePost.status === "safe_for_replay") {
      if (verification_inputs.length < 2) {
        return {
          status: "needs_verification_inputs",
          lead,
          operation: operationView(selected),
          candidate,
          verification_input_evidence: harvested?.evidence ?? [],
          provider_readiness,
          safe_post_verification: safePost,
          missing: ["verification_inputs"],
          reason: "POST has explicit side-effect containment evidence, but MISSING still requires two independent evidence-backed replay inputs",
        };
      }
      return {
        status: "candidate_ready_for_safe_post_replay",
        lead,
        operation: operationView(selected),
        candidate,
        verification_input_evidence: harvested?.evidence ?? [],
        provider_readiness,
        safe_post_verification: safePost,
        missing: [],
        reason: "POST has explicit side-effect containment evidence and two replay inputs; it is ready for a dedicated safe POST replay verifier, not standard Theta acquisition",
      };
    }

    const missing = ["safe_verification"];
    if (verification_inputs.length < 2) missing.push("verification_inputs");
    return {
      status: "needs_safe_verification",
      lead,
      operation: operationView(selected),
      candidate,
      verification_input_evidence: harvested?.evidence ?? [],
      provider_readiness,
      safe_post_verification: safePost,
      missing,
      reason: verification_inputs.length < 2
        ? `${safePost.reason}; MISSING also requires two evidence-backed inputs before any live replay`
        : safePost.reason,
    };
  }

  const missing: string[] = [];
  if (verification_inputs.length < 2) missing.push("verification_inputs");
  return {
    status: missing.length ? "needs_verification_inputs" : "candidate_ready", lead,
    operation: operationView(selected), candidate, verification_input_evidence: harvested?.evidence ?? [], provider_readiness, safe_post_verification: null, missing,
    reason: missing.length ? "Theta requires two independent replay inputs grounded in explicit caller data or OpenAPI examples, enum values, or defaults; MISSING will not invent them" : null,
  };
}
