import { z } from "zod";
import { randomUUID } from "node:crypto";
import { DEFAULT_MISSING_DESCRIPTION } from "../config/index.js";

export interface Invocation { request_id: string; task: string; timestamp: string; invocation: "resolve_missing_capability"; requested_capability?: string; }
export interface ToolContext { task: string; requestId?: string; recordFallback?: (event: Invocation) => void; }
export interface ToolDefinition { name: string; description: string; inputSchema: z.ZodObject<any>; execute: (args: any, context: ToolContext) => unknown | Promise<unknown>; }

const staticData: Record<string, string> = { "office-hours": "Monday-Friday, 09:00-17:00 UTC", "support-email": "help@example.test", "project-code": "M0-ALPHA", "return-window": "30 days", "headquarters": "Lisbon" };

export function normalTools(): ToolDefinition[] { return [
  { name: "calculator", description: "Evaluate a basic arithmetic expression containing numbers, parentheses, and +, -, *, or /.", inputSchema: z.object({ expression: z.string() }), execute: ({expression}) => {
    if (!/^[\d\s()+*/.\-]+$/.test(expression)) throw new Error("Invalid expression");
    return { result: Function(`"use strict"; return (${expression})`)() };
  }},
  { name: "current_date", description: "Return the current UTC calendar date.", inputSchema: z.object({}), execute: () => ({ date: new Date().toISOString().slice(0, 10) }) },
  { name: "parse_json", description: "Parse JSON text supplied by the user and return its structured value.", inputSchema: z.object({ json: z.string() }), execute: ({json}) => ({ value: JSON.parse(json) }) },
  { name: "text_transform", description: "Transform supplied text to uppercase, lowercase, or reverse it.", inputSchema: z.object({ text: z.string(), operation: z.enum(["uppercase", "lowercase", "reverse"]) }), execute: ({text, operation}) => ({ text: operation === "uppercase" ? text.toUpperCase() : operation === "lowercase" ? text.toLowerCase() : [...text].reverse().join("") }) },
  { name: "lookup_static_data", description: "Look up benchmark static data. Valid keys: office-hours, support-email, project-code, return-window, headquarters.", inputSchema: z.object({ key: z.enum(["office-hours", "support-email", "project-code", "return-window", "headquarters"]) }), execute: ({key}) => ({ key, value: staticData[key] }) }
]; }

export function missingTool(description = DEFAULT_MISSING_DESCRIPTION): ToolDefinition { return {
  name: "resolve_missing_capability", description,
  inputSchema: z.object({ task: z.string().describe("The task needing an external capability"), requested_capability: z.string().optional() }),
  execute: ({task, requested_capability}, context) => {
    const event: Invocation = { request_id: context.requestId ?? randomUUID(), task, timestamp: new Date().toISOString(), invocation: "resolve_missing_capability", ...(requested_capability ? {requested_capability} : {}) };
    context.recordFallback?.(event);
    return { status: "capability_not_available", message: "The requested capability is not currently available.", request_id: event.request_id };
  }
}; }

export function jsonSchema(tool: ToolDefinition) {
  // Tool schemas are intentionally explicit; Zod remains the execution-time validator.
  const shapes: Record<string, any> = {
    calculator: {expression:{type:"string"}}, current_date: {}, parse_json:{json:{type:"string"}},
    text_transform:{text:{type:"string"},operation:{type:"string",enum:["uppercase","lowercase","reverse"]}},
    lookup_static_data:{key:{type:"string",enum:Object.keys(staticData)}},
    resolve_missing_capability:{task:{type:"string"},requested_capability:{type:"string"}}
  };
  const required: Record<string,string[]> = {calculator:["expression"],parse_json:["json"],text_transform:["text","operation"],lookup_static_data:["key"],resolve_missing_capability:["task"]};
  return { type:"function", function:{name:tool.name,description:tool.description,parameters:{type:"object",properties:shapes[tool.name],required:required[tool.name]??[],additionalProperties:false}}};
}
