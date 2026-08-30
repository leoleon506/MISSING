import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {inspectFiveB20Integrity} from "./experiment5b20Harness.js";
import {buildFiveB20Report} from "./experiment5b20Decision.js";
import {loadFiveB20Workload} from "./experiment5b20Workload.js";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const outDir=fileURLToPath(new URL("../results/experiment-5b20/",import.meta.url));
const engineOutDir=fileURLToPath(new URL("../results/experiment-5b20-engine/",import.meta.url));
const frozenCorePath=fileURLToPath(new URL("./experiment4aCore.ts",import.meta.url));
const developmentCorePath=fileURLToPath(new URL("./experiment5aCore.ts",import.meta.url));
const generatedPath=fileURLToPath(new URL("./.generated-experiment5b20.ts",import.meta.url));
const generatedPlannerPath=fileURLToPath(new URL("./.generated-experiment5b20Planner.ts",import.meta.url));

await mkdir(outDir,{recursive:true});const integrity=inspectFiveB20Integrity();if(!integrity.ok){const report={experiment:"5B20",decision:"REASSESS_5B20_STRICT_REQUEST_LOCAL_TYPED_QUALIFICATION",integrity};await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));throw new Error(`5b20_integrity_failed:${integrity.errors.join("|")}`)}
const originalCore=await readFile(frozenCorePath,"utf8"),developmentCore=await readFile(developmentCorePath,"utf8");await rm(engineOutDir,{recursive:true,force:true});await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true});let engineError:any=null;
try{await writeFile(frozenCorePath,developmentCore,"utf8");execFileSync(process.execPath,["--import","tsx","src/experiment5b20Engine.ts"],{cwd:repoRoot,env:process.env,stdio:"inherit"})}catch(e){engineError=e}finally{await writeFile(frozenCorePath,originalCore,"utf8");await rm(generatedPath,{force:true});await rm(generatedPlannerPath,{force:true})}
if(engineError){const failure={experiment:"5B20",decision:"REASSESS_5B20_STRICT_REQUEST_LOCAL_TYPED_QUALIFICATION",integrity,harness_error:String(engineError?.stack||engineError)};await writeFile(`${outDir}/harness-failure.json`,JSON.stringify(failure,null,2));throw engineError}
const engineReportPath=`${engineOutDir}/report.json`,raw=JSON.parse(await readFile(engineReportPath,"utf8")),workload=loadFiveB20Workload();await cp(engineReportPath,`${outDir}/engine-report.json`);const report=buildFiveB20Report(raw,integrity,workload);(report as any).started_at=raw.started_at||null;(report as any).finished_at=raw.finished_at||null;await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({experiment:"5B20",decision:report.decision,fingerprint:report.fingerprint,metrics:report.metrics,gates:report.gates},null,2));
