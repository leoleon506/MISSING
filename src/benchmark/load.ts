import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { BenchmarkCase } from "../types.js";
const schema = z.array(z.object({case_id:z.string(),ground_truth:z.enum(["solvable_without_missing","requires_missing"]),user_task:z.string(),expected_tool:z.string().optional()}));
export async function loadCases(path: string): Promise<BenchmarkCase[]> { return schema.parse(JSON.parse(await readFile(path,"utf8"))); }
/** The only case projection permitted across the evaluator/agent boundary. */
export function agentVisibleCase(testCase: BenchmarkCase): { user_task: string } { return { user_task: testCase.user_task }; }
