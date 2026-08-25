import { resolve } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "./config/index.js";
import { loadCases } from "./benchmark/load.js";
import { OpenAICompatibleAgent } from "./agent/openai.js";
import { runBenchmark, serializeResult } from "./benchmark/runner.js";
import { secondaryRecoveryRate, coverageBoundarySuccessRate } from "./experiment0b-metrics.js";

const STRICT_RECOVERY_DESCRIPTION = "Use this tool only when the user's task cannot be fully completed with the available tools. Call it when no suitable tool exists or after another tool proves insufficient because its schema, data coverage, permissions, supported values, freshness, or execution result cannot satisfy the request. Do not call it if an available tool can fully complete the task.";
interface Variant { id:string; tool_name:string; }

const config=loadConfig();
if(!config.apiKey){ console.error("OPENAI_API_KEY is required for Experiment 0B2."); process.exit(1); }
const cases=await loadCases(resolve("experiments/experiment-0/cases.json"));
const variants=JSON.parse(await readFile(resolve("experiments/experiment-0b2/tool-names.json"),"utf8")) as Variant[];
const agent=new OpenAICompatibleAgent(config);
const summary:any={experiment:"MISSING Experiment 0B2",created_at:new Date().toISOString(),seed:config.seed,model:config.model,provider:config.provider,cases:cases.length,description:STRICT_RECOVERY_DESCRIPTION,variants:[]};

for(const variant of variants){
  console.log(`\n=== Experiment 0B2 tool name: ${variant.tool_name} ===`);
  const result=await runBenchmark(cases,agent,{seed:config.seed,description:STRICT_RECOVERY_DESCRIPTION,missingToolName:variant.tool_name,provider:config.provider,model:config.model});
  const outDir=`results/experiment-0b2/${variant.id}`;
  const resultPath=await serializeResult(result,outDir);
  const m=result.metrics.missing;
  const row={id:variant.id,tool_name:variant.tool_name,result_path:resultPath,fallback_selection_rate:m.fallback_selection_rate,false_positive_rate:m.false_positive_rate,precision_missing:m.precision_missing,missing_first_call_rate:m.missing_first_call_rate,secondary_recovery_rate:secondaryRecoveryRate(result.results),coverage_boundary_success_rate:coverageBoundarySuccessRate(result.results),correct_normal_tool_rate:m.correct_normal_tool_rate};
  summary.variants.push(row); console.log(JSON.stringify(row,null,2));
}
await mkdir("results/experiment-0b2",{recursive:true});
await writeFile("results/experiment-0b2/summary.json",JSON.stringify(summary,null,2)+"\n");
console.log("\nExperiment 0B2 summary: results/experiment-0b2/summary.json");
