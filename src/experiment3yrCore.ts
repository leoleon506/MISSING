import {createHash} from "node:crypto";
import {isIP} from "node:net";
import {parsePublicApis} from "./experiment3tCore.js";
import {executeProgram,type ProjectionExpr} from "./experiment3xCore.js";
import {semanticValidate3y} from "./experiment3yCore.js";
import {registrableDomain,isValidContract} from "./experiment3uCore.js";

export const RECOVERY_TOP_K=120;
export const sha3yr=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");

const GENERIC=new Set(["api","public","name","id","code","metadata","machine","readable","canonical","return","given","identify","operation"]);
export function normalizeTokenText(s:string){return String(s).normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase();}
export function tokens(s:string){return (normalizeTokenText(s).match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>x.length>=2&&!GENERIC.has(x));}

export function recoveredBroadRetrieve(c:any,md:string){
  const entries=parsePublicApis(md),q=tokens(`${c.intent} ${c.input_names.join(" ")} ${c.required_output_leaf_names.join(" ")}`);
  const docs=entries.map(e=>tokens(`${e.name} ${e.description} ${e.category}`));
  const df=new Map<string,number>(); for(const d of docs){for(const w of new Set(d))df.set(w,(df.get(w)||0)+1);} const N=Math.max(entries.length,1);
  const scored=entries.map((e,i)=>{const d=docs[i],freq=new Map<string,number>();for(const w of d)freq.set(w,(freq.get(w)||0)+1);let score=0;for(const w of q){const n=df.get(w)||0,idf=Math.log(1+(N-n+0.5)/(n+0.5));const tf=freq.get(w)||0;if(tf)score+=idf*(tf/(tf+1.2));else if(w.length>=4&&d.some(x=>x.length>=4&&(x.includes(w)||w.includes(x))))score+=idf*0.22;}return {...e,score};});
  return scored.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,RECOVERY_TOP_K).map((e,i)=>({candidate_id:`r${String(i+1).padStart(3,"0")}_${sha3yr(`${c.case_id}|${e.name}|${e.link}`).slice(0,10)}`,lexical_rank:i+1,...e}));
}

export type RecoveryEvent={at:string;layer:"guard"|"network"|"acquisition"|"compiler"|"replay";kind:string;accepted:boolean;detail?:unknown};
export class RecoveryLedger{events:RecoveryEvent[]=[];record(layer:RecoveryEvent["layer"],kind:string,accepted:boolean,detail?:unknown){this.events.push({at:new Date().toISOString(),layer,kind,accepted,detail});}count(kind:string,accepted=true){return this.events.filter(x=>x.kind===kind&&x.accepted===accepted).length;}fingerprint(){return sha3yr(this.events);}}

function scalar(raw:string):any{const s=raw.trim();if(!s)return {};if(s==="null"||s==="~")return null;if(s==="true")return true;if(s==="false")return false;if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return Number(s);if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))return s.slice(1,-1);if(s.startsWith("[")&&s.endsWith("]"))return s.slice(1,-1).split(",").map(x=>scalar(x));return s;}
export function parseOpenApiText(text:string){
  try{const j=JSON.parse(text);return isValidContract(j)?j:null;}catch{}
  const root:any={},stack:{indent:number;value:any}[]=[{indent:-1,value:root}];
  const lines=text.replace(/\t/g,"  ").split(/\r?\n/);
  for(let idx=0;idx<lines.length;idx++){const raw=lines[idx];if(!raw.trim()||raw.trimStart().startsWith("#"))continue;const indent=raw.length-raw.trimStart().length,line=raw.trim();while(stack.length>1&&indent<=stack.at(-1)!.indent)stack.pop();const parent=stack.at(-1)!.value;
    if(line.startsWith("- ")){if(!Array.isArray(parent))continue;parent.push(scalar(line.slice(2)));continue;}
    const m=line.match(/^([^:]+):(.*)$/);if(!m)continue;const key=m[1].trim().replace(/^['"]|['"]$/g,""),rest=m[2].trim();if(rest){parent[key]=scalar(rest);continue;}
    let next:any={};for(let j=idx+1;j<lines.length;j++){const n=lines[j];if(!n.trim()||n.trimStart().startsWith("#"))continue;const ni=n.length-n.trimStart().length;if(ni<=indent)break;if(n.trim().startsWith("- "))next=[];break;}parent[key]=next;stack.push({indent,value:next});
  }
  return isValidContract(root)?root:null;
}

export function validateRedirectTarget(startRaw:string,currentRaw:string,location:string,ledger?:RecoveryLedger){let start:URL,current:URL,next:URL;try{start=new URL(startRaw);current=new URL(currentRaw);next=new URL(location,current);}catch{ledger?.record("guard","invalid_redirect",false,{currentRaw,location});throw new Error("invalid_redirect");}
  if(next.protocol!=="https:"){ledger?.record("guard","non_https",false,next.toString());throw new Error("redirect_non_https");}if(next.username||next.password){ledger?.record("guard","credentials",false);throw new Error("redirect_credentials");}if(isIP(next.hostname)){ledger?.record("guard","private_hosts",false,next.hostname);throw new Error("redirect_ip_literal");}if(registrableDomain(start.hostname)!==registrableDomain(next.hostname)){ledger?.record("guard","cross_domain_docs",false,next.hostname);throw new Error("redirect_cross_domain");}ledger?.record("guard","redirect",true,next.toString());return next.toString();}

export async function fetchTextSafe(startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger){let current=url;for(let hop=0;hop<=2;hop++){ledger.record("network","fetch",true,{url:current,hop});const r=await fetch(current,{redirect:"manual",headers:{accept:"application/json,application/yaml,text/yaml,text/html,text/plain,*/*"}});if(r.status>=300&&r.status<400){const loc=r.headers.get("location");if(!loc)throw new Error("redirect_without_location");if(hop===2)throw new Error("redirect_limit_exceeded");current=validateRedirectTarget(startUrl,current,loc,ledger);continue;}if(!r.ok)throw new Error(`http_${r.status}`);const text=await r.text();if(Buffer.byteLength(text)>maxBytes)throw new Error("body_too_large");return {text,content_type:r.headers.get("content-type")||"",final_url:current};}throw new Error("redirect_limit_exceeded");}

export type RecoveryProgram=Record<string,ProjectionExpr>;
export function executeRecoveredProjection(program:RecoveryProgram,body:any,input:Record<string,unknown>,caseId:string){const out=executeProgram(program,body,input) as Record<string,any>;if(!semanticValidate3y(caseId,input,out))throw new Error("recovery_semantic_mismatch");return out;}

export function validatorForCase(caseId:string){if(caseId==="country_metadata")return "country";if(caseId==="pokemon_metadata")return "pokemon";if(caseId==="brewery_metadata")return "brewery";throw new Error(`unknown_case:${caseId}`);}

export function derivedSafetyCounters(ledger:RecoveryLedger){const kinds=["credentials","authorization_headers","non_get","non_https","private_hosts","cross_domain_docs","endpoint_mutations","invented_parameters","invented_output_fields","arbitrary_code","ungrounded_projection_fields","replay_external_calls"];return Object.fromEntries(kinds.map(k=>[k,ledger.count(k,true)]));}
