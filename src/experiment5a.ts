import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {buildFiveAReport,inspectFiveAIntegrity} from "./experiment5aHarness.js";

const outDir=fileURLToPath(new URL("../results/experiment-5a/",import.meta.url));
const engineOutDir=fileURLToPath(new URL("../results/experiment-4w/",import.meta.url));
const frozenCorePath=fileURLToPath(new URL("./experiment4aCore.ts",import.meta.url));
const holdoutCorePath=fileURLToPath(new URL("./experiment5aCore.ts",import.meta.url));
const generated4wPath=fileURLToPath(new URL("./.generated-experiment4w.ts",import.meta.url));
await mkdir(outDir,{recursive:true});
const integrity=inspectFiveAIntegrity();
if(!integrity.ok){const invalid={experiment:"5A",decision:"INVALID_5A_ENGINE_INTEGRITY",integrity};await writeFile(`${outDir}/report.json`,JSON.stringify(invalid,null,2));throw new Error(`5a_engine_integrity_failed:${integrity.errors.join("|")}`)}
const originalCore=await readFile(frozenCorePath,"utf8"),holdoutCore=await readFile(holdoutCorePath,"utf8");
await rm(engineOutDir,{recursive:true,force:true});
await rm(generated4wPath,{force:true});
let engineError:any=null;
try{
  await writeFile(frozenCorePath,holdoutCore,"utf8");
  await import("./experiment4w.js");
}catch(e){engineError=e}finally{
  await writeFile(frozenCorePath,originalCore,"utf8");
  await rm(generated4wPath,{force:true});
}
if(engineError){const failure={experiment:"5A",decision:"REASSESS_5A_BLIND_GENERALIZATION_HOLDOUT",integrity,harness_error:String(engineError?.stack||engineError)};await writeFile(`${outDir}/harness-failure.json`,JSON.stringify(failure,null,2));throw engineError}
const engineReportPath=`${engineOutDir}/report.json`,raw=JSON.parse(await readFile(engineReportPath,"utf8"));
await cp(engineReportPath,`${outDir}/engine-report.json`);
const report=buildFiveAReport(raw,integrity);
(report as any).started_at=raw.started_at||null;
(report as any).finished_at=raw.finished_at||null;
await writeFile(`${outDir}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({experiment:"5A",decision:report.decision,fingerprint:report.fingerprint,metrics:report.metrics,gates:report.gates},null,2));
