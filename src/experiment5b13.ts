import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {inspectFiveB13Integrity} from "./experiment5b13Harness.js";
import {buildFiveB13Report} from "./experiment5b13Decision.js";
const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const outDir=fileURLToPath(new URL("../results/experiment-5b13/",import.meta.url));
const engineOutDir=fileURLToPath(new URL("../results/experiment-5b13-engine/",import.meta.url));
const frozenCorePath=fileURLToPath(new URL("./experiment4aCore.ts",import.meta.url));
const developmentCorePath=fileURLToPath(new URL("./experiment5aCore.ts",import.meta.url));
const baselinePath=fileURLToPath(new URL("../experiments/5b13/frozen-5b12-development-baseline.json",import.meta.url));
const generatedPath=fileURLToPath(new URL("./.generated-experiment5b13.ts",import.meta.url));
const generatedPlannerPath=fileURLToPath(new URL("./.generated-experiment5b13Planner.ts",import.meta.url));
await mkdir(outDir,{recursive:true});const integrity=inspectFiveB13Integrity();if(!integrity.ok){const report={experiment:"5B13",decision:"REASSESS_5B13_REQUEST_LOCAL_DOCUMENTARY_SEMANTIC_UTILITY",integrity};await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));throw new Error(`5b13_integrity_failed:${integrity.errors.join("|")}`)}
const originalCore=await readFile(frozenCorePath,"utf8"),developmentCore=await readFile(developmentCorePath,"utf8"),baseline=JSON.parse(await readFile(baselinePath,"utf8"));await rm(engineOutDir,{recursive:true,force:true});await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true});let engineError:any=null;try{await writeFile(frozenCorePath,developmentCore,"utf8");execFileSync(process.execPath,["--import","tsx","src/experiment5b13Engine.ts"],{cwd:repoRoot,env:process.env,stdio:"inherit"})}catch(e){engineError=e}finally{await writeFile(frozenCorePath,originalCore,"utf8");await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true})}if(engineError){const failure={experiment:"5B13",decision:"REASSESS_5B13_REQUEST_LOCAL_DOCUMENTARY_SEMANTIC_UTILITY",integrity,harness_error:String(engineError?.stack||engineError)};await writeFile(`${outDir}/harness-failure.json`,JSON.stringify(failure,null,2));throw engineError}
const engineReportPath=`${engineOutDir}/report.json`,raw=JSON.parse(await readFile(engineReportPath,"utf8"));await cp(engineReportPath,`${outDir}/engine-report.json`);const report=buildFiveB13Report(raw,integrity,baseline);(report as any).started_at=raw.started_at||null;(report as any).finished_at=raw.finished_at||null;await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({experiment:"5B13",decision:report.decision,fingerprint:report.fingerprint,metrics:report.metrics,gates:report.gates},null,2));
