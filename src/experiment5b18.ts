import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {inspectFiveB18Integrity} from "./experiment5b18Harness.js";
import {buildFiveB18Report} from "./experiment5b18Decision.js";
import {loadFiveB18Workload} from "./experiment5b18Workload.js";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const outDir=fileURLToPath(new URL("../results/experiment-5b18/",import.meta.url));
const engineOutDir=fileURLToPath(new URL("../results/experiment-5b18-engine/",import.meta.url));
const frozenCorePath=fileURLToPath(new URL("./experiment4aCore.ts",import.meta.url));
const developmentCorePath=fileURLToPath(new URL("./experiment5aCore.ts",import.meta.url));
const generatedPath=fileURLToPath(new URL("./.generated-experiment5b18.ts",import.meta.url));
const generatedPlannerPath=fileURLToPath(new URL("./.generated-experiment5b14Planner.ts",import.meta.url));

await mkdir(outDir,{recursive:true});const integrity=inspectFiveB18Integrity();if(!integrity.ok){const report={experiment:"5B18",decision:"REASSESS_5B18_EXECUTABLE_SURFACE_BUDGET_RESERVATION",integrity};await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));throw new Error(`5b18_integrity_failed:${integrity.errors.join("|")}`)}
const originalCore=await readFile(frozenCorePath,"utf8"),developmentCore=await readFile(developmentCorePath,"utf8");await rm(engineOutDir,{recursive:true,force:true});await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true});let engineError:any=null;
try{await writeFile(frozenCorePath,developmentCore,"utf8");execFileSync(process.execPath,["--import","tsx","src/experiment5b18Engine.ts"],{cwd:repoRoot,env:process.env,stdio:"inherit"})}catch(e){engineError=e}finally{await writeFile(frozenCorePath,originalCore,"utf8");await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true})}
if(engineError){const failure={experiment:"5B18",decision:"REASSESS_5B18_EXECUTABLE_SURFACE_BUDGET_RESERVATION",integrity,harness_error:String(engineError?.stack||engineError)};await writeFile(`${outDir}/harness-failure.json`,JSON.stringify(failure,null,2));throw engineError}
const engineReportPath=`${engineOutDir}/report.json`,raw=JSON.parse(await readFile(engineReportPath,"utf8")),workload=loadFiveB18Workload();await cp(engineReportPath,`${outDir}/engine-report.json`);const report=buildFiveB18Report(raw,integrity,workload);(report as any).started_at=raw.started_at||null;(report as any).finished_at=raw.finished_at||null;await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({experiment:"5B18",decision:report.decision,fingerprint:report.fingerprint,metrics:report.metrics,gates:report.gates},null,2));
