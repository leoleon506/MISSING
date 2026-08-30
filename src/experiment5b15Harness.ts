import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fiveB15Sha} from "./experiment5b15Policy.js";

export const FIVE_B15_BASE_SHA="b2a3289c6929233eb2ac56f706ad8b8eb6413100";
export const FIVE_B15_PREREG_COMMIT="9c18edad8d47bf2b7a1404cbd7a2fc4b22834070";
export const FIVE_B15_WORKLOAD_COMMIT="8de79a42819f42a8112da1a04f481db8d8c38d02";
export const FIVE_B15_SOURCE_RUN_ID=33283645154;
export const FIVE_B15_SOURCE_REPORT_FINGERPRINT="ba1ed1e8aa6152568734096a39396bc43d46de1d0290d1b40ec901d5dba27e43";
const WORKLOAD_PATH="experiments/5b15/frozen-5b14-replay-workload.json";
const RESERVED=[".invalid",".test",".example",".localhost"];

export function fiveB15PathAllowed(path:string){return path.startsWith("experiments/5b15/")||/^src\/experiment5b15[^/]*\.ts$/.test(path)||/^tests\/experiment5b15[^/]*\.test\.ts$/.test(path)||path===".github/workflows/run-experiment-5b15.yml"}
function git(args:string[],cwd=process.cwd()){return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()}
function lines(v:string){return v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
export function countRuntimeProviderUrlLiterals5B15(source:string){let count=0;for(const raw of source.match(/https?:\/\/[^\s"'`<>)]+/g)||[]){try{const host=new URL(raw).hostname.toLowerCase();if(host==="localhost"||RESERVED.some(s=>host.endsWith(s)))continue;count++}catch{count++}}return count}
export function recomputeFiveB15WorkloadFingerprints(workload:any){const recipes=Array.isArray(workload?.recipes)?workload.recipes:[];return {recipe_fingerprint_set_fingerprint:fiveB15Sha(recipes.map((r:any)=>String(r.recipe_fingerprint)).sort()),changed_input_workload_fingerprint:fiveB15Sha(recipes.map((r:any)=>({case_id:r.case_id,recipe_fingerprint:r.recipe_fingerprint,changed_input:r.changed_input,required:r.required,contract:r.contract,projection:r.projection})))}}

export type FiveB15Integrity={ok:boolean;base_sha:string;prereg_commit:string;workload_commit:string;head_sha:string;base_is_ancestor:boolean;changed_files:string[];unexpected_files:string[];first_5b15_commit:string|null;prereg_unchanged:boolean;workload_first_commit:string|null;workload_unchanged:boolean;workload_file_sha256:string;frozen_recipe_count:number;recipe_fingerprint_set_fingerprint:string;changed_input_workload_fingerprint:string;recipe_fingerprint_set_matches:boolean;changed_input_workload_matches:boolean;source_run_matches:boolean;source_report_matches:boolean;semantic_verifier_unchanged:boolean;semantic_verifier_source_fingerprint:string;runtime_provider_url_literals:number;errors:string[]};

export function inspectFiveB15Integrity(cwd=process.cwd()):FiveB15Integrity{
 const errors:string[]=[];let head="",ancestor=false,changed:string[]=[],first:string|null=null,prereg=true,workloadFirst:string|null=null,workloadUnchanged=true,urlLiterals=0,verifierUnchanged=true;
 try{head=git(["rev-parse","HEAD"],cwd)}catch(e){errors.push(`head_unavailable:${String(e)}`)}
 try{execFileSync("git",["merge-base","--is-ancestor",FIVE_B15_BASE_SHA,"HEAD"],{cwd,stdio:"ignore"});ancestor=true}catch{errors.push("base_not_ancestor")}
 try{changed=lines(git(["diff","--name-only",`${FIVE_B15_BASE_SHA}..HEAD`],cwd))}catch(e){errors.push(`diff_unavailable:${String(e)}`)}
 const unexpected=changed.filter(p=>!fiveB15PathAllowed(p));if(unexpected.length)errors.push(`unexpected_changed_files:${unexpected.join(",")}`);
 try{const commits=lines(git(["log","--reverse","--format=%H",`${FIVE_B15_BASE_SHA}..HEAD`,`--`,`experiments/5b15`,`src`,`tests`,`.github/workflows/run-experiment-5b15.yml`],cwd));first=commits[0]||null;if(first!==FIVE_B15_PREREG_COMMIT)errors.push(`prereg_not_first:${first||"none"}`)}catch(e){errors.push(`history_unavailable:${String(e)}`)}
 try{prereg=!git(["diff","--name-only",`${FIVE_B15_PREREG_COMMIT}..HEAD`,`--`,`experiments/5b15/README.md`],cwd);if(!prereg)errors.push("prereg_modified")}catch(e){errors.push(`prereg_diff_unavailable:${String(e)}`)}
 try{const commits=lines(git(["log","--reverse","--format=%H",`${FIVE_B15_BASE_SHA}..HEAD`,`--`,WORKLOAD_PATH],cwd));workloadFirst=commits[0]||null;if(workloadFirst!==FIVE_B15_WORKLOAD_COMMIT)errors.push(`workload_commit_mismatch:${workloadFirst||"none"}`)}catch(e){errors.push(`workload_history_unavailable:${String(e)}`)}
 try{workloadUnchanged=!git(["diff","--name-only",`${FIVE_B15_WORKLOAD_COMMIT}..HEAD`,`--`,WORKLOAD_PATH],cwd);if(!workloadUnchanged)errors.push("frozen_workload_modified")}catch(e){errors.push(`workload_diff_unavailable:${String(e)}`)}
 try{verifierUnchanged=!git(["diff","--name-only",`${FIVE_B15_BASE_SHA}..HEAD`,`--`,`src/experiment5aCore.ts`],cwd);if(!verifierUnchanged)errors.push("semantic_verifier_modified")}catch(e){verifierUnchanged=false;errors.push(`verifier_diff_unavailable:${String(e)}`)}
 for(const file of changed.filter(p=>/^src\/experiment5b15.*\.ts$/.test(p))){try{urlLiterals+=countRuntimeProviderUrlLiterals5B15(readFileSync(`${cwd}/${file}`,"utf8"))}catch{}}if(urlLiterals)errors.push(`runtime_provider_url_literals:${urlLiterals}`);
 let workload:any={recipes:[]},workloadText="";try{workloadText=readFileSync(`${cwd}/${WORKLOAD_PATH}`,"utf8");workload=JSON.parse(workloadText)}catch(e){errors.push(`workload_unreadable:${String(e)}`)}
 const fps=recomputeFiveB15WorkloadFingerprints(workload),recipeCount=Array.isArray(workload?.recipes)?workload.recipes.length:0,recipeMatches=fps.recipe_fingerprint_set_fingerprint===String(workload?.recipe_fingerprint_set_fingerprint||""),inputMatches=fps.changed_input_workload_fingerprint===String(workload?.changed_input_workload_fingerprint||""),sourceRun=Number(workload?.source_run_id)===FIVE_B15_SOURCE_RUN_ID,sourceReport=String(workload?.source_report_fingerprint||"")===FIVE_B15_SOURCE_REPORT_FINGERPRINT;
 if(recipeCount!==7)errors.push(`frozen_recipe_count:${recipeCount}`);if(!recipeMatches)errors.push("recipe_fingerprint_set_mismatch");if(!inputMatches)errors.push("changed_input_workload_mismatch");if(!sourceRun)errors.push("source_run_mismatch");if(!sourceReport)errors.push("source_report_mismatch");
 let verifierSource="";try{verifierSource=readFileSync(`${cwd}/src/experiment5aCore.ts`,"utf8")}catch(e){errors.push(`verifier_unreadable:${String(e)}`)}
 return {ok:errors.length===0,base_sha:FIVE_B15_BASE_SHA,prereg_commit:FIVE_B15_PREREG_COMMIT,workload_commit:FIVE_B15_WORKLOAD_COMMIT,head_sha:head,base_is_ancestor:ancestor,changed_files:changed,unexpected_files:unexpected,first_5b15_commit:first,prereg_unchanged:prereg,workload_first_commit:workloadFirst,workload_unchanged:workloadUnchanged,workload_file_sha256:fiveB15Sha(workloadText),frozen_recipe_count:recipeCount,recipe_fingerprint_set_fingerprint:fps.recipe_fingerprint_set_fingerprint,changed_input_workload_fingerprint:fps.changed_input_workload_fingerprint,recipe_fingerprint_set_matches:recipeMatches,changed_input_workload_matches:inputMatches,source_run_matches:sourceRun,source_report_matches:sourceReport,semantic_verifier_unchanged:verifierUnchanged,semantic_verifier_source_fingerprint:fiveB15Sha(verifierSource),runtime_provider_url_literals:urlLiterals,errors};
}
