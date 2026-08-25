import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

type ExpectedType="string"|"number"|"boolean"|"object"|"array";
type Contract={contract_id:string;expected:"ACCEPT"|"REJECT";url:string;host:string;exports:Record<string,{path:string;type:ExpectedType}>};

const ALLOWED_HOSTS=new Set(["api.github.com","geocoding-api.open-meteo.com","api.frankfurter.dev","restcountries.com"]);
const contracts=JSON.parse(await readFile(resolve("experiments/experiment-3a/contracts.json"),"utf8")) as Contract[];

function pathGet(v:any,path:string){return path.split(".").reduce((x,k)=>x?.[k],v);}
function observedType(v:any):ExpectedType|"null"|"undefined"{if(v===undefined)return "undefined";if(v===null)return "null";if(Array.isArray(v))return "array";return typeof v as any;}
function shape(v:any,depth=0):any{if(depth>=3)return observedType(v);if(Array.isArray(v))return {type:"array",item:v.length?shape(v[0],depth+1):"empty"};if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().slice(0,50).map(k=>[k,shape(v[k],depth+1)]));return observedType(v);}
function fingerprint(v:any){return createHash("sha256").update(JSON.stringify(shape(v))).digest("hex");}

const results:any[]=[];let hostPolicyViolations=0;
for(const c of contracts){
  const errors:string[]=[];let status:number|null=null;let contentType="";let fp:string|null=null;let body:any=null;
  try{
    const u=new URL(c.url);
    if(u.protocol!=="https:"||u.hostname!==c.host||!ALLOWED_HOSTS.has(u.hostname)){errors.push("host_policy");hostPolicyViolations++;}
    if(!errors.length){
      const r=await fetch(c.url,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-3A/0.1"}});status=r.status;contentType=r.headers.get("content-type")??"";
      if(!r.ok)errors.push(`http_${r.status}`);
      if(!contentType.toLowerCase().includes("json"))errors.push("non_json_content_type");
      const text=await r.text();
      try{body=JSON.parse(text);}catch{errors.push("json_parse_failure");}
      if(body!==null){fp=fingerprint(body);for(const [name,spec] of Object.entries(c.exports)){const value=pathGet(body,spec.path);const actual=observedType(value);if(actual==="undefined")errors.push(`missing_export:${name}`);else if(actual!==spec.type)errors.push(`wrong_type:${name}:${actual}->${spec.type}`);}}
    }
  }catch(e){errors.push(`exception:${String(e)}`);}
  const decision=errors.length?"REJECT":"ACCEPT";
  results.push({contract_id:c.contract_id,expected:c.expected,decision,pass:decision===c.expected,status,content_type:contentType,shape_fingerprint:fp,errors});
}
const valid=results.filter(r=>r.expected==="ACCEPT"),invalid=results.filter(r=>r.expected==="REJECT");
const validAcceptance=valid.filter(r=>r.decision==="ACCEPT").length/valid.length;
const invalidRejection=invalid.filter(r=>r.decision==="REJECT").length/invalid.length;
const falseAcceptance=invalid.filter(r=>r.decision==="ACCEPT").length/invalid.length;
const falseRejection=valid.filter(r=>r.decision==="REJECT").length/valid.length;
const criteria={valid_contract_acceptance_rate:validAcceptance===1,invalid_stale_contract_rejection_rate:invalidRejection===1,false_acceptance_rate_zero:falseAcceptance===0,false_rejection_rate_zero:falseRejection===0,host_policy_violations_zero:hostPolicyViolations===0,evidence_fingerprints_persisted:results.every(r=>r.shape_fingerprint||r.errors.length)};
const decision=Object.values(criteria).every(Boolean)?"GO_PRIMITIVE_CONTRACT_GATE":"REASSESS_PRIMITIVE_CONTRACT_GATE";
const summary={experiment:"MISSING Experiment 3A — Primitive Contract Gate",created_at:new Date().toISOString(),metrics:{contracts:results.length,valid_contracts:valid.length,invalid_contracts:invalid.length,valid_acceptance_rate:validAcceptance,invalid_rejection_rate:invalidRejection,false_acceptance_rate:falseAcceptance,false_rejection_rate:falseRejection,host_policy_violations:hostPolicyViolations},criteria,decision,results};
await mkdir("results/experiment-3a",{recursive:true});await writeFile("results/experiment-3a/summary.json",JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify(summary,null,2));
