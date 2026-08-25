import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "./config/index.js";
import { loadCases } from "./benchmark/load.js";
import { OpenAICompatibleAgent } from "./agent/openai.js";
import { runBenchmark, serializeResult } from "./benchmark/runner.js";

const DESCRIPTION = "Use this tool only when the user's task cannot be fully completed with the available tools. Call it when no suitable tool exists or after another tool proves insufficient because its schema, data coverage, permissions, supported values, freshness, or execution result cannot satisfy the request. Do not call it if an available tool can fully complete the task.";
const TOOL_NAME = "request_missing_capability";
const ratio=(n:number,d:number)=>d?n/d:0;

const config=loadConfig();
if(!config.apiKey){ console.error("OPENAI_API_KEY is required for Experiment 0C."); process.exit(1); }
const cases=await loadCases(resolve("experiments/experiment-0c/cases.json"));
const agent=new OpenAICompatibleAgent(config);
const result=await runBenchmark(cases,agent,{seed:config.seed,description:DESCRIPTION,missingToolName:TOOL_NAME,provider:config.provider,model:config.model});
const resultPath=await serializeResult(result,"results/experiment-0c");
const missingRows=result.results.filter(r=>r.condition==="missing");
const direct=missingRows.filter(r=>r.ground_truth==="requires_missing"&&r.case_family.startsWith("direct_"));
const boundary=missingRows.filter(r=>r.ground_truth==="requires_missing"&&r.case_family.startsWith("boundary_"));
const solvable=missingRows.filter(r=>r.ground_truth==="solvable_without_missing");
const directRate=ratio(direct.filter(r=>r.whether_missing_was_called).length,direct.length);
const boundaryRate=ratio(boundary.filter(r=>r.whether_missing_was_called).length,boundary.length);
const boundarySecondary=ratio(boundary.filter(r=>r.first_selected_tool!==TOOL_NAME&&r.whether_missing_was_called).length,boundary.filter(r=>r.first_selected_tool!==TOOL_NAME).length);
const m=result.metrics.missing;
let decision="REASSESS";
if(m.fallback_selection_rate>=0.75&&m.false_positive_rate<=0.10&&(m.precision_missing??0)>=0.90&&directRate>=0.80&&boundaryRate>=0.60) decision="GO_EXPERIMENT_1_FACTORY";
else if(m.false_positive_rate<=0.10&&(m.precision_missing??0)>=0.90&&directRate>=0.80&&boundaryRate<0.60) decision="GO_REROUTING_GATEWAY_BEFORE_FACTORY";
const summary={experiment:"MISSING Experiment 0C",created_at:new Date().toISOString(),seed:config.seed,model:config.model,provider:config.provider,cases:cases.length,tool_name:TOOL_NAME,description:DESCRIPTION,result_path:resultPath,overall:{fallback_selection_rate:m.fallback_selection_rate,false_positive_rate:m.false_positive_rate,precision_missing:m.precision_missing,missing_first_call_rate:m.missing_first_call_rate,correct_normal_tool_rate:m.correct_normal_tool_rate},holdout:{direct_missing_cases:direct.length,direct_missing_fallback_rate:directRate,boundary_missing_cases:boundary.length,boundary_missing_fallback_rate:boundaryRate,boundary_secondary_recovery_rate:boundarySecondary,solvable_cases:solvable.length},decision};
await mkdir("results/experiment-0c",{recursive:true});
await writeFile("results/experiment-0c/summary.json",JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
