import {mkdir,readFile,writeFile} from "node:fs/promises";
import {buildVerifiedReport} from "./experiment3p2rVerifier.js";

const CORE_REPORT="results/experiment-3p2/report.json";
const CORE_RECIPES="results/experiment-3p2/recipes.json";
const OUTDIR="results/experiment-3p2r";

async function main(){
  await mkdir(OUTDIR,{recursive:true});
  const [rawReport,rawRecipes]=await Promise.all([
    readFile(CORE_REPORT,"utf-8"),
    readFile(CORE_RECIPES,"utf-8")
  ]);
  const coreReport=JSON.parse(rawReport);
  const recipes=JSON.parse(rawRecipes);
  if(!Array.isArray(recipes))throw new Error("core_recipes_not_array");
  const report=buildVerifiedReport(coreReport,recipes,rawReport,rawRecipes);
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(!String(report.decision).startsWith("GO_"))process.exitCode=2;
}

main().catch(async e=>{
  await mkdir(OUTDIR,{recursive:true});
  const failure={
    experiment:"MISSING Experiment 3P2R — Verified Fingerprint-Control Replication",
    created_at:new Date().toISOString(),
    fatal_error:String(e),
    decision:"REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED"
  };
  await writeFile(`${OUTDIR}/fatal.json`,JSON.stringify(failure,null,2));
  console.error(e);
  process.exitCode=1;
});
