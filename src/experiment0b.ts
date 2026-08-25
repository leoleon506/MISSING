import { resolve } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "./config/index.js";
import { loadCases } from "./benchmark/load.js";
import { OpenAICompatibleAgent } from "./agent/openai.js";
import { runBenchmark, serializeResult } from "./benchmark/runner.js";
import { secondaryRecoveryRate, coverageBoundarySuccessRate } from "./experiment0b-metrics.js";

interface Variant { id:string; description:string; }

const config=loadConfig();
if(!config.apiKey){
  console.error("OPENAI_API_KEY is required for Experiment 0B.");
  process.exit(1);
}

const cases=await loadCases(resolve("experiments/experiment-0/cases.json"));
const variants=JSON.parse(await readFile(resolve("experiments/experiment-0b/descriptions.json"),"utf8")) as Variant[];
const agent=new OpenAICompatibleAgent(config);
const summary:any={
  experiment:"MISSING Experiment 0B",
  created_at:new Date().toISOString(),
  seed:config.seed,
  model:config.model,
  provider:config.provider,
  cases:cases.length,
  variants:[]
};

for(const variant of variants){
  console.log(`\n=== Experiment 0B variant: ${variant.id} ===`);
  const result=await runBenchmark(cases,agent,{seed:config.seed,description:variant.description,provider:config.provider,model:config.model});
  const outDir=`results/experiment-0b/${variant.id}`;
  const resultPath=await serializeResult(result,outDir);
  const missing=result.metrics.missing;
  const secondary=secondaryRecoveryRate(result.results);
  const boundary=coverageBoundarySuccessRate(result.results);
  const row={
    id:variant.id,
    description:variant.description,
    result_path:resultPath,
    fallback_selection_rate:missing.fallback_selection_rate,
    false_positive_rate:missing.false_positive_rate,
    precision_missing:missing.precision_missing,
    missing_first_call_rate:missing.missing_first_call_rate,
    secondary_recovery_rate:secondary,
    coverage_boundary_success_rate:boundary,
    correct_normal_tool_rate:missing.correct_normal_tool_rate
  };
  summary.variants.push(row);
  console.log(JSON.stringify(row,null,2));
}

await mkdir("results/experiment-0b",{recursive:true});
const summaryPath="results/experiment-0b/summary.json";
await writeFile(summaryPath,JSON.stringify(summary,null,2)+"\n");
console.log(`\nExperiment 0B summary: ${summaryPath}`);
