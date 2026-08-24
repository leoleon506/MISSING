import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DEFAULT_MISSING_DESCRIPTION } from "../config/index.js";

export interface Invocation {
  request_id: string;
  case_id?: string;
  timestamp: string;
  requested_capability: string;
  invocation_sequence_position: number;
}
export type InvocationRecorder = (event: Invocation) => void;

export const staticData = {
  "office-hours": "Monday-Friday, 09:00-17:00 UTC",
  "support-email": "support@missing.invalid",
  "project-code": "M0-ALPHA",
  "return-window": "30 days",
  headquarters: "Lisbon",
  "registry-status": "M0-ALPHA is active",
} as const;

export const toolSpecifications = {
  calculator: {
    description: "Evaluate a basic arithmetic expression containing numbers, parentheses, and +, -, *, or /.",
    inputSchema: z.object({ expression: z.string() }),
  },
  current_date: { description: "Return the current UTC calendar date.", inputSchema: z.object({}) },
  parse_json: { description: "Parse JSON text supplied by the user and return its structured value.", inputSchema: z.object({ json: z.string() }) },
  text_transform: {
    description: "Transform supplied text to uppercase, lowercase, or reverse it.",
    inputSchema: z.object({ text: z.string(), operation: z.enum(["uppercase", "lowercase", "reverse"]) }),
  },
  lookup_static_data: {
    description: `Look up deterministic benchmark records. Valid keys: ${Object.keys(staticData).join(", ")}.`,
    inputSchema: z.object({ key: z.enum(Object.keys(staticData) as [keyof typeof staticData, ...(keyof typeof staticData)[]]) }),
  },
} as const;

export const missingSpecification = (description = DEFAULT_MISSING_DESCRIPTION) => ({
  description,
  inputSchema: z.object({
    task: z.string().describe("A concise description of the task requiring another capability"),
    requested_capability: z.string().describe("The external capability required"),
  }),
});

export function executeNormalTool(name: keyof typeof toolSpecifications, args: any) {
  switch (name) {
    case "calculator": {
      if (!/^[\d\s()+*/.\-]+$/.test(args.expression)) throw new Error("Invalid expression");
      return { result: Function(`"use strict"; return (${args.expression})`)() };
    }
    case "current_date": return { date: new Date().toISOString().slice(0, 10) };
    case "parse_json": return { value: JSON.parse(args.json) };
    case "text_transform": return { text: args.operation === "uppercase" ? args.text.toUpperCase() : args.operation === "lowercase" ? args.text.toLowerCase() : [...args.text].reverse().join("") };
    case "lookup_static_data": return { key: args.key, value: staticData[args.key as keyof typeof staticData] };
  }
}

export function fallbackEvent(args: {task: string; requested_capability: string}, context: {requestId?: string; caseId?: string; sequence: number}): Invocation {
  return { request_id: context.requestId ?? randomUUID(), ...(context.caseId ? { case_id: context.caseId } : {}), timestamp: new Date().toISOString(), requested_capability: args.requested_capability, invocation_sequence_position: context.sequence };
}
