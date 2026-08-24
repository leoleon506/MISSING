import { describe,expect,it } from "vitest";
import { loadCases,agentVisibleCase } from "../src/benchmark/load.js";
import { shuffleSeeded } from "../src/benchmark/random.js";
import { calculateMetrics } from "../src/metrics/index.js";
import { missingTool } from "../src/mcp/tools.js";
import { runBenchmark,serializeResult } from "../src/benchmark/runner.js";
import { readFile,mkdtemp } from "node:fs/promises";import { tmpdir } from "node:os";import { join } from "node:path";
import type { Agent } from "../src/agent/openai.js";import type { CaseResult } from "../src/types.js";
const fixture="experiments/experiment-0/cases.json";
describe("Experiment 0 infrastructure",()=>{
 it("loads a balanced 60-case benchmark",async()=>{const cases=await loadCases(fixture);expect(cases).toHaveLength(60);expect(cases.filter(c=>c.ground_truth==="requires_missing")).toHaveLength(30);});
 it("isolates evaluator labels from agent-visible input",async()=>{const c=(await loadCases(fixture))[0];expect(agentVisibleCase(c)).toEqual({user_task:c.user_task});expect(JSON.stringify(agentVisibleCase(c))).not.toContain("ground_truth");expect(JSON.stringify(agentVisibleCase(c))).not.toContain("expected_tool");});
 it("calculates required metrics",()=>{const base=(truth:string,missing:boolean,tools:string[],expected?:string)=>({ground_truth:truth,whether_missing_was_called:missing,selected_tools:tools,expected_tool:expected}) as CaseResult;const m=calculateMetrics([base("requires_missing",true,["resolve_missing_capability"]),base("requires_missing",false,[]),base("solvable_without_missing",false,["calculator"],"calculator"),base("solvable_without_missing",true,["resolve_missing_capability"],"parse_json")]);expect(m).toMatchObject({fallback_selection_rate:.5,false_positive_rate:.5,give_up_rate:.5,correct_tool_rate:.5,precision_missing:.5});});
 it("shuffles reproducibly without mutating input",()=>{const source=[1,2,3,4,5];expect(shuffleSeeded(source,42)).toEqual(shuffleSeeded(source,42));expect(shuffleSeeded(source,42)).not.toEqual(shuffleSeeded(source,43));expect(source).toEqual([1,2,3,4,5]);});
 it("records fallback invocations",async()=>{const events:any[]=[];const out=await missingTool().execute({task:"check registry",requested_capability:"registry lookup"},{task:"check registry",requestId:"req-1",recordFallback:e=>events.push(e)});expect(events[0]).toMatchObject({request_id:"req-1",task:"check registry",invocation:"resolve_missing_capability",requested_capability:"registry lookup"});expect(out).toMatchObject({status:"capability_not_available"});});
 it("serializes complete mock results and labels them infrastructure-only",async()=>{const agent:Agent={run:async(_task,tools)=>({selectedTools:[tools[0].name],finalOutcome:"mock",latencyMs:1,errors:[]})};const result=await runBenchmark((await loadCases(fixture)).slice(0,2),agent,{seed:7,description:"test",runType:"infrastructure-mock"});const dir=await mkdtemp(join(tmpdir(),"missing-"));const path=await serializeResult(result,dir);const saved=JSON.parse(await readFile(path,"utf8"));expect(saved.run_type).toBe("infrastructure-mock");expect(saved.results[0]).toEqual(expect.objectContaining({case_id:expect.any(String),tool_order:expect.any(Array),random_seed:7,errors:expect.any(Array)}));});
});
