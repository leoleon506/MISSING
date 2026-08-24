import { randomUUID } from "node:crypto"; import { mkdir, writeFile } from "node:fs/promises";
import type { Agent } from "../agent/openai.js"; import type { BenchmarkCase, CaseResult, Condition, RunResult } from "../types.js";
import { agentVisibleCase } from "./load.js"; import { shuffleSeeded } from "./random.js"; import { missingTool, normalTools } from "../mcp/tools.js"; import { calculateMetrics } from "../metrics/index.js";
export async function runBenchmark(cases:BenchmarkCase[],agent:Agent,options:{seed:number;description:string;provider?:string;model?:string;runType?:RunResult["run_type"]}):Promise<RunResult>{
  const results:CaseResult[]=[]; for(const condition of ["control","missing"] as Condition[]) for(let index=0;index<cases.length;index++){
    const testCase=cases[index], caseSeed=(options.seed+index+(condition==="missing"?cases.length:0))>>>0; const base=normalTools(); if(condition==="missing")base.push(missingTool(options.description));
    const tools=shuffleSeeded(base,caseSeed), visible=agentVisibleCase(testCase), requestId=randomUUID(), started=performance.now(); let output;
    try{output=await agent.run(visible.user_task,tools,requestId);}catch(error){output={selectedTools:[],finalOutcome:"agent_error",latencyMs:performance.now()-started,errors:[error instanceof Error?error.message:String(error)]};}
    results.push({case_id:testCase.case_id,ground_truth:testCase.ground_truth,condition,user_task:testCase.user_task,available_tools:tools.map(t=>t.name),tool_order:tools.map(t=>t.name),selected_tools:output.selectedTools,first_selected_tool:output.selectedTools[0]??null,whether_missing_was_called:output.selectedTools.includes("resolve_missing_capability"),final_agent_outcome:output.finalOutcome,provider:options.provider,model:options.model,latency_ms:output.latencyMs,errors:output.errors,random_seed:caseSeed,expected_tool:testCase.expected_tool});
  }
  const by=(condition:Condition)=>results.filter(r=>r.condition===condition); return {experiment:"MISSING Experiment 0",run_id:`${new Date().toISOString().replace(/[:.]/g,"-")}-${options.seed}`,run_type:options.runType??"real-agent",created_at:new Date().toISOString(),fallback_description:options.description,results,metrics:{control:calculateMetrics(by("control")),missing:calculateMetrics(by("missing"))}};
}
export async function serializeResult(result:RunResult,directory="results"){await mkdir(directory,{recursive:true});const path=`${directory}/${result.run_id}.json`;await writeFile(path,JSON.stringify(result,null,2)+"\n");return path;}
