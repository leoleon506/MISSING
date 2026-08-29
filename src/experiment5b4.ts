import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {inspectFiveB4Integrity} from "./experiment5b4Harness.js";
import {buildFiveB4Report} from "./experiment5b4Decision.js";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const outDir=fileURLToPath(new URL("../results/experiment-5b4/",import.meta.url));
const engineOutDir=fileURLToPath(new URL("../results/experiment-5b4-engine/",import.meta.url));
const frozenCorePath=fileURLToPath(new URL("./experiment4aCore.ts",import.meta.url));
const developmentCorePath=fileURLToPath(new URL("./experiment5aCore.ts",import.meta.url));
const generatedPath=fileURLToPath(new URL("./.generated-experiment5b4.ts",import.meta.url));
await mkdir(outDir,{recursive:true});
const integrity=inspectFiveB4Integrity();
if(!integrity.ok){const report={experiment:"5B4",decision:"REASSESS_5B4_STRUCTURED_COLLECTION_OPERATION_LOCAL_UTILITY",integrity};await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));throw new Error(`5b4_integrity_failed:${integrity.errors.join("|")}`)}
const originalCore=await readFile(frozenCorePath,"utf8"),developmentCore=await readFile(developmentCorePath,"utf8");
await rm(engineOutDir,{recursive:true,force:true});await rm(generatedPath,{force:true});let engineError:any=null;
try{await writeFile(frozenCorePath,developmentCore,"utf8");execFileSync(process.execPath,["--import","tsx","src/experiment5b4Engine.ts"],{cwd:repoRoot,env:process.env,stdio:"inherit"})}catch(e){engineError=e}finally{await writeFile(frozenCorePath,originalCore,"utf8");await rm(generatedPath,{force:true})}
if(engineError){const failure={experiment:"5B4",decision:"REASSESS_5B4_STRUCTURED_COLLECTION_OPERATION_LOCAL_UTILITY",integrity,harness_error:String(engineError?.stack||engineError)};await writeFile(`${outDir}/harness-failure.json`,JSON.stringify(failure,null,2));throw engineError}
const engineReportPath=`${engineOutDir}/report.json`,raw=JSON.parse(await readFile(engineReportPath,"utf8"));await cp(engineReportPath,`${outDir}/engine-report.json`);const report=buildFiveB4Report(raw,integrity);(report as any).started_at=raw.started_at||null;(report as any).finished_at=raw.finished_at||null;await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({experiment:"5B4",decision:report.decision,fingerprint:report.fingerprint,metrics:report.metrics,gates:report.gates},null,2));
