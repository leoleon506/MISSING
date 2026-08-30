import type { RuntimeInput } from "./types.js";

export interface VerificationInputEvidence {
  input_name: string;
  value: unknown;
  source: "parameter_example" | "schema_example" | "schema_enum" | "schema_default";
}

export interface VerificationInputHarvest {
  inputs: RuntimeInput[];
  evidence: VerificationInputEvidence[];
  missing_inputs: string[];
  status: "ready" | "insufficient_evidence";
}

type ParameterDescriptor = {
  input_name: string;
  parameter: any;
};

function uniqueValues(values: Array<{ value: unknown; source: VerificationInputEvidence["source"] }>) {
  const seen = new Set<string>();
  const result: Array<{ value: unknown; source: VerificationInputEvidence["source"] }> = [];
  for (const entry of values) {
    if (entry.value === undefined || entry.value === null) continue;
    const key = JSON.stringify(entry.value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function documentedValues(parameter: any) {
  const schema = parameter?.schema ?? parameter ?? {};
  const values: Array<{ value: unknown; source: VerificationInputEvidence["source"] }> = [];

  if (parameter?.example !== undefined) values.push({ value: parameter.example, source: "parameter_example" });
  if (parameter?.examples && typeof parameter.examples === "object") {
    for (const item of Object.values(parameter.examples as Record<string, any>)) {
      const value = item && typeof item === "object" && "value" in item ? item.value : item;
      if (value !== undefined) values.push({ value, source: "parameter_example" });
    }
  }
  if (schema?.example !== undefined) values.push({ value: schema.example, source: "schema_example" });
  if (Array.isArray(schema?.enum)) {
    for (const value of schema.enum) values.push({ value, source: "schema_enum" });
  }
  if (schema?.default !== undefined) values.push({ value: schema.default, source: "schema_default" });

  return uniqueValues(values);
}

export function harvestVerificationInputs(parameters: ParameterDescriptor[]): VerificationInputHarvest {
  const normalized = parameters.filter(item => item.input_name && item.parameter);
  const valuesByInput = new Map<string, ReturnType<typeof documentedValues>>();
  const evidence: VerificationInputEvidence[] = [];
  const missing_inputs: string[] = [];

  for (const item of normalized) {
    const values = documentedValues(item.parameter);
    valuesByInput.set(item.input_name, values);
    if (!values.length) missing_inputs.push(item.input_name);
    for (const entry of values) evidence.push({ input_name: item.input_name, value: entry.value, source: entry.source });
  }

  if (missing_inputs.length || !normalized.length) {
    return { inputs: [], evidence, missing_inputs, status: "insufficient_evidence" };
  }

  const first: RuntimeInput = {};
  for (const item of normalized) first[item.input_name] = valuesByInput.get(item.input_name)![0].value;

  const candidates: RuntimeInput[] = [first];
  for (const item of normalized) {
    const values = valuesByInput.get(item.input_name)!;
    for (let index = 1; index < values.length; index += 1) {
      const variant = structuredClone(first);
      variant[item.input_name] = values[index].value;
      candidates.push(variant);
      if (candidates.length >= 2) break;
    }
    if (candidates.length >= 2) break;
  }

  if (candidates.length < 2) {
    return { inputs: [], evidence, missing_inputs: normalized.map(item => item.input_name), status: "insufficient_evidence" };
  }

  return { inputs: candidates.slice(0, 2), evidence, missing_inputs: [], status: "ready" };
}
