import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {FIVE_A_CASES} from "./experiment5aCore.js";
import {loadFiveB16Workload,workloadShapeValid5b16} from "./experiment5b16Workload.js";

export const FIVE_B16_BASE_SHA="a6c1f471e2067108fa929cff52d6245051d687e0";
export const FIVE_B16_PREREG_COMMIT="89b0ab500319e704e7312e410152cff0777173e0";
export const FIVE_B16_WORKLOAD_COMMIT="c288ef7f494477b08534d670966f236ab69fe0f0";
const WORKLOAD_PATH="experiments/5b16/frozen-redundancy-workload.json";
const RESERVED=[".invalid",".test",".example",".localhost"];

export function fiveB16PathAllowed(path:string){return path.startsWith("experiments/5b16/")||/^src\/experiment5b16[^/]*\.ts$/.test(path)||/^tests\/experiment5b16[^/]*\.test\.ts$/.test(path)||path===".github/workflows/run-experiment-5b16.yml"}
function git(args:string[],cwd=process.cwd()){return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()}
function lines(v:string){return v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
export function countRuntimeProviderUrlLiterals5B16(source:string){let count=0;for(const raw of source.match(/https?:\/\/[^\s"'`<>)]+/g)||[]){try{const host=new URL(raw).hostname.toLowerCase();if(host==="localhost"||RESERVED.some(s=>host.endsWith(s)))continue;count++}catch{count++}}return count}
export function countRuntimeCaseFamilyHardcoding5B16(source:string){const values=new Set<string>();for(const c of FIVE_A_CASES){values.add(String(c.case_id));values.add(String(c.family))}let count=0;for(const value of values){const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),re=new RegExp(`["'\\x60]${escaped}["'\\x60]`,"g");count+=(source.match(re)||[]).length}return count}

export type FiveB16Integrity={ok:boolean;base_sha:string;prereg_commit:string;workload_commit:string;head_sha:string;base_is_ancestor:boolean;changed_files:string[];unexpected_files:string[];first_5b16_commit:string|null;prereg_unchanged:boolean;workload_first_commit:string|null;workload_unchanged:boolean;workload_shape_valid:boolean;development_verifier_unchanged:boolean;runtime_provider_url_literals:number;runtime_case_family_hardcoding:number;errors:string[]};

export function inspectFiveB16Integrity(cwd=process.cwd()):FiveB16Integrity{
 const errors:string[]=[];let head="",ancestor=false,changed:string[]=[],first:string|null=null,prereg=true,workloadFirst:string|null=null,workloadUnchanged=true,verifierUnchanged=true,urlLiterals=0,hardcoding=0;
 try{head=git(["rev-parse","HEAD"],cwd)}catch(e){errors.push(`head_unavailable:${String(e)}`)}
 try{execFileSync("git",["merge-base","--is-ancestor",FIVE_B16_BASE_SHA,"HEAD"],{cwd,stdio:"ignore"});ancestor=true}catch{errors.push("base_not_ancestor")}
 try{changed=lines(git(["diff","--name-only",`${FIVE_B16_BASE_SHA}..HEAD`],cwd))}catch(e){errors.push(`diff_unavailable:${String(e)}`)}
 const unexpected=changed.filter(p=>!fiveB16PathAllowed(p));if(unexpected.length)errors.push(`unexpected_changed_files:${unexpected.join(",")}`);
 try{const commits=lines(git(["log","--reverse","--format=%H",`${FIVE_B16_BASE_SHA}..HEAD`,`--`,`experiments/5b16`,`src`,`tests`,`.github/workflows/run-experiment-5b16.yml`],cwd));first=commits[0]||null;if(first!==FIVE_B16_PREREG_COMMIT)errors.push(`prereg_not_first:${first||"none"}`)}catch(e){errors.push(`history_unavailable:${String(e)}`)}
 try{prereg=!git(["diff","--name-only",`${FIVE_B16_PREREG_COMMIT}..HEAD`,`--`,`experiments/5b16/README.md`],cwd);if(!prereg)errors.push("prereg_modified")}catch(e){errors.push(`prereg_diff_unavailable:${String(e)}`)}
 try{const commits=lines(git(["log","--reverse","--format=%H",`${FIVE_B16_BASE_SHA}..HEAD`,`--`,WORKLOAD_PATH],cwd));workloadFirst=commits[0]||null;if(workloadFirst!==FIVE_B16_WORKLOAD_COMMIT)errors.push(`workload_commit_mismatch:${workloadFirst||"none"}`)}catch(e){errors.push(`workload_history_unavailable:${String(e)}`)}
 try{workloadUnchanged=!git(["diff","--name-only",`${FIVE_B16_WORKLOAD_COMMIT}..HEAD`,`--`,WORKLOAD_PATH],cwd);if(!workloadUnchanged)errors.push("frozen_workload_modified")}catch(e){errors.push(`workload_diff_unavailable:${String(e)}`)}
 try{verifierUnchanged=!git(["diff","--name-only",`${FIVE_B16_BASE_SHA}..HEAD`,`--`,`src/experiment5aCore.ts`],cwd);if(!verifierUnchanged)errors.push("development_verifier_modified")}catch(e){verifierUnchanged=false;errors.push(`verifier_diff_unavailable:${String(e)}`)}
 let shape=false;try{shape=workloadShapeValid5b16(loadFiveB16Workload());if(!shape)errors.push("frozen_workload_shape_invalid")}catch(e){errors.push(`workload_unreadable:${String(e)}`)}
 for(const file of changed.filter(p=>/^src\/experiment5b16.*\.ts$/.test(p))){try{const source=readFileSync(`${cwd}/${file}`,"utf8");urlLiterals+=countRuntimeProviderUrlLiterals5B16(source);hardcoding+=countRuntimeCaseFamilyHardcoding5B16(source)}catch{}}
 if(urlLiterals)errors.push(`runtime_provider_url_literals:${urlLiterals}`);if(hardcoding)errors.push(`runtime_case_family_hardcoding:${hardcoding}`);
 return {ok:errors.length===0,base_sha:FIVE_B16_BASE_SHA,prereg_commit:FIVE_B16_PREREG_COMMIT,workload_commit:FIVE_B16_WORKLOAD_COMMIT,head_sha:head,base_is_ancestor:ancestor,changed_files:changed,unexpected_files:unexpected,first_5b16_commit:first,prereg_unchanged:prereg,workload_first_commit:workloadFirst,workload_unchanged:workloadUnchanged,workload_shape_valid:shape,development_verifier_unchanged:verifierUnchanged,runtime_provider_url_literals:urlLiterals,runtime_case_family_hardcoding:hardcoding,errors};
}
