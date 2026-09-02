import type { RuntimeInput } from "./types.js";

export type SafePostSignalKind =
  | "sandbox_server"
  | "dry_run_control"
  | "test_mode_control"
  | "provider_safe_declaration"
  | "idempotency_key";

export interface SafePostParameterDescriptor {
  name: string;
  input_name: string | null;
  location: "query" | "header" | "body";
  required: boolean;
  schema: Record<string, any> | null;
  description: string;
}

export interface SafePostSignal {
  kind: SafePostSignalKind;
  sufficient: boolean;
  source: string;
  detail: string;
  location?: "query" | "header" | "body";
  name?: string;
  input_name?: string;
  safe_value?: boolean;
}

export interface SafePostVerificationAssessment {
  status: "safe_for_replay" | "needs_safe_verification";
  signals: SafePostSignal[];
  input_overrides: RuntimeInput;
  generated_headers: string[];
  reason: string;
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function sandboxServer(baseUrl: string): SafePostSignal | null {
  try {
    const url = new URL(baseUrl);
    const tokens = new Set([...words(url.hostname), ...words(url.pathname)]);
    const marker = ["sandbox", "test", "testing"].find(token => tokens.has(token));
    if (!marker) return null;
    return {
      kind: "sandbox_server",
      sufficient: true,
      source: "server_url",
      detail: `Provider base URL explicitly contains non-production marker '${marker}'`,
    };
  } catch {
    return null;
  }
}

function explicitSafeDeclaration(operation: Record<string, any>): SafePostSignal | null {
  const direct = operation?.["x-missing-safe-verification"];
  if (direct === true || ["sandbox", "dry_run", "dry-run", "test", "test_mode", "test-mode"].includes(String(direct).toLowerCase())) {
    return {
      kind: "provider_safe_declaration",
      sufficient: true,
      source: "x-missing-safe-verification",
      detail: "OpenAPI operation explicitly declares a side-effect-safe verification mode",
    };
  }

  for (const key of ["x-sandbox", "x-test-mode", "x-dry-run", "x-dry-run-supported", "x-safe-to-test"]) {
    if (operation?.[key] === true) {
      return {
        kind: "provider_safe_declaration",
        sufficient: true,
        source: key,
        detail: `OpenAPI operation explicitly declares ${key}=true`,
      };
    }
  }
  return null;
}

function booleanSchema(schema: Record<string, any> | null): boolean {
  if (!schema) return false;
  if (schema.type === "boolean") return true;
  if (Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every((value: unknown) => typeof value === "boolean")) return true;
  return false;
}

function documentedBooleanValue(schema: Record<string, any> | null, expected: boolean): boolean {
  if (!schema) return false;
  if (schema.default === expected || schema.example === expected) return true;
  if (Array.isArray(schema.examples) && schema.examples.includes(expected)) return true;
  if (Array.isArray(schema.enum) && schema.enum.includes(expected)) return true;
  return false;
}

function controlSignal(parameter: SafePostParameterDescriptor): SafePostSignal | null {
  if (parameter.location === "header" || !parameter.input_name || !booleanSchema(parameter.schema)) return null;
  const name = normalizedName(parameter.name);
  const description = parameter.description.toLowerCase();

  const dryRunNames = new Set(["dryrun", "dryrunonly", "preview", "simulate", "simulation", "validateonly", "validationonly"]);
  const testModeNames = new Set(["testmode", "testingmode", "sandboxmode"]);
  let kind: "dry_run_control" | "test_mode_control" | null = null;
  let safeValue = true;
  if (dryRunNames.has(name)) kind = "dry_run_control";
  if (testModeNames.has(name)) kind = "test_mode_control";
  if (!kind) return null;

  const semanticEvidence = kind === "dry_run_control"
    ? /(dry[ -]?run|preview|simulat|validation only|validate only|no changes|without (saving|persisting|committing|creating)|does not (save|persist|commit|create|modify))/.test(description)
    : /(test mode|testing mode|sandbox|non[- ]production|no real|does not (persist|commit|create|modify))/.test(description);
  const valueEvidence = documentedBooleanValue(parameter.schema, safeValue);
  if (!semanticEvidence && !valueEvidence) return null;

  return {
    kind,
    sufficient: true,
    source: `${parameter.location}:${parameter.name}`,
    detail: `${parameter.name} is a documented boolean safety control that MISSING can force to ${String(safeValue)}`,
    location: parameter.location,
    name: parameter.name,
    input_name: parameter.input_name,
    safe_value: safeValue,
  };
}

function idempotencySignal(parameter: SafePostParameterDescriptor): SafePostSignal | null {
  if (parameter.location !== "header") return null;
  const name = normalizedName(parameter.name);
  if (name !== "idempotencykey" && name !== "xidempotencykey") return null;
  return {
    kind: "idempotency_key",
    sufficient: false,
    source: `header:${parameter.name}`,
    detail: "Provider requires an idempotency key; this reduces duplicate effects but is not sufficient to make a real mutation safe to probe",
    location: "header",
    name: parameter.name,
  };
}

export function assessSafePostVerification(input: {
  base_url: string;
  operation: Record<string, any>;
  parameters: SafePostParameterDescriptor[];
}): SafePostVerificationAssessment {
  const signals: SafePostSignal[] = [];
  const server = sandboxServer(input.base_url);
  if (server) signals.push(server);
  const declaration = explicitSafeDeclaration(input.operation);
  if (declaration) signals.push(declaration);

  for (const parameter of input.parameters) {
    const control = controlSignal(parameter);
    if (control) signals.push(control);
    const idempotency = idempotencySignal(parameter);
    if (idempotency) signals.push(idempotency);
  }

  const input_overrides: RuntimeInput = {};
  const generated_headers: string[] = [];
  for (const signal of signals) {
    if (signal.sufficient && signal.input_name && typeof signal.safe_value === "boolean") input_overrides[signal.input_name] = signal.safe_value;
    if (signal.kind === "idempotency_key" && signal.name) generated_headers.push(signal.name);
  }

  const sufficient = signals.filter(signal => signal.sufficient);
  if (sufficient.length) {
    return {
      status: "safe_for_replay",
      signals,
      input_overrides,
      generated_headers: [...new Set(generated_headers)].sort(),
      reason: `POST has explicit side-effect containment evidence: ${sufficient.map(signal => signal.kind).join(", ")}`,
    };
  }

  const supportive = signals.filter(signal => !signal.sufficient);
  return {
    status: "needs_safe_verification",
    signals,
    input_overrides,
    generated_headers: [...new Set(generated_headers)].sort(),
    reason: supportive.length
      ? "POST has risk-reduction evidence, but no explicit sandbox/dry-run/test-mode guarantee; idempotency alone does not make mutation probing safe"
      : "POST has no explicit sandbox, dry-run, test-mode, or provider-declared safe verification guarantee",
  };
}
