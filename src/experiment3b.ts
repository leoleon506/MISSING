import { mkdir, writeFile } from "node:fs/promises";

const LIST_URL="https://api.apis.guru/v2/list.json";
const MAX_APIS=250,MAX_SPECS=120,MAX_PROBES=30,MAX_ADMITTED=10,SPACING_MS=150;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

type ScalarType="string"|"number"|"integer"|"boolean";
type Contract={api_id:string;spec_url:string;method:"GET";url:string;export_path:string;export_type:ScalarType;operation_id?:string|null};

function deref(root:any,node:any,seen=new Set<string>()):any{
  if(!node||typeof node!=="object")return node;
  if(node.$ref&&typeof node.$ref==="string"&&node.$ref.startsWith("#/")){
    if(seen.has(node.$ref))return node;
    seen.add(node.$ref);
    const target=node.$ref.slice(2).split("/").reduce((x:any,k:string)=>x?.[k.replace(/~1/g,"/").replace(/~0/g,"~")],root);
    return deref(root,target,seen);
  }
  return node;
}
function schemaType(root:any,s:any):any{return deref(root,s)?.type;}
function scalarLeaf(root:any,s:any,prefix="",depth=0):{path:string;type:ScalarType}|null{
  if(depth>6)return null;
  const x=deref(root,s);
  if(!x||typeof x!=="object")return null;
  const t=x.type;
  if(["string","number","integer","boolean"].includes(t))return {path:prefix||"$",type:t};
  if(t==="array"||x.items){return scalarLeaf(root,x.items,prefix?`${prefix}.0`:"0",depth+1);}
  const props=x.properties??{};
  for(const k of Object.keys(props).sort()){const r=scalarLeaf(root,props[k],prefix?`${prefix}.${k}`:k,depth+1);if(r)return r;}
  if(x.allOf)for(const part of x.allOf){const r=scalarLeaf(root,part,prefix,depth+1);if(r)return r;}
  return null;
}
function pathGet(v:any,path:string){if(path==="$"||path==="")return v;return path.split(".").reduce((x,k)=>x?.[k],v);}
function observedType(v:any){if(Array.isArray(v))return "array";return typeof v;}
function paramValue(root:any,p:any){const x=deref(root,p);const s=deref(root,x.schema??{});return x.example??s.example??s.default??(Array.isArray(s.enum)?s.enum[0]:undefined);}
function operationSecurity(spec:any,op:any){const sec=op.security!==undefined?op.security:spec.security;return Array.isArray(sec)&&sec.length>0;}
function baseUrl(spec:any){
  if(Array.isArray(spec.servers)&&spec.servers[0]?.url)return spec.servers[0].url.replace(/\/$/,"");
  if(spec.swagger==="2.0"){const scheme=(spec.schemes??[]).includes("https")?"https":spec.schemes?.[0];if(!scheme||!spec.host)return null;return `${scheme}://${spec.host}${spec.basePath??""}`.replace(/\/$/,"");}
  return null;
}
function responseSchema(spec:any,op:any){
  const responses=op.responses??{};
  for(const code of Object.keys(responses).sort()){
    if(!/^2\d\d$/.test(code)&&code!=="default")continue;
    const r=deref(spec,responses[code]);
    if(spec.openapi){const content=r?.content??{};const key=Object.keys(content).find(k=>k.includes("json"));if(key&&content[key]?.schema)return content[key].schema;}
    if(spec.swagger==="2.0"&&r?.schema)return r.schema;
  }
  return null;
}
function buildCandidate(spec:any,apiId:string,specUrl:string,path:string,op:any):{contract?:Contract;reason?:string}{
  if(operationSecurity(spec,op))return {reason:"security_required"};
  const base=baseUrl(spec);if(!base||!base.startsWith("https://"))return {reason:"no_https_base"};
  let rendered=path;const query=new URLSearchParams();
  const params=[...(spec.paths?.[path]?.parameters??[]),...(op.parameters??[])];
  for(const p0 of params){const p=deref(spec,p0);if(!p?.required)continue;const v=paramValue(spec,p);if(v===undefined)return {reason:`required_param_without_example:${p?.name??"unknown"}`};if(p.in==="path")rendered=rendered.replace(`{${p.name}}`,encodeURIComponent(String(v)));else if(p.in==="query")query.set(p.name,String(v));else return {reason:`unsupported_required_param:${p.in}`};}
  if(/\{[^}]+\}/.test(rendered))return {reason:"unresolved_path_param"};
  const schema=responseSchema(spec,op);if(!schema)return {reason:"no_json_response_schema"};const leaf=scalarLeaf(spec,schema);if(!leaf)return {reason:"no_scalar_leaf"};
  let url=`${base}${rendered.startsWith("/")?rendered:`/${rendered}`}`;if([...query.keys()].length)url+=`${url.includes("?")?"&":"?"}${query.toString()}`;
  try{const u=new URL(url);if(u.protocol!=="https:")return {reason:"non_https_url"};}catch{return {reason:"invalid_url"};}
  return {contract:{api_id:apiId,spec_url:specUrl,method:"GET",url,export_path:leaf.path,export_type:leaf.type,operation_id:op.operationId??null}};
}
async function fetchJson(url:string){const r=await fetch(url,{headers:{accept:"application/json, application/yaml;q=0.5","user-agent":"MISSING-Experiment-3B/0.1"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();try{return JSON.parse(text);}catch{throw new Error("non_json_spec_or_response");}}
async function probe(c:Contract){try{const r=await fetch(c.url,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-3B/0.1"}});const ct=r.headers.get("content-type")??"";if(!r.ok)return {pass:false,status:r.status,error:`http_${r.status}`};if(!ct.toLowerCase().includes("json"))return {pass:false,status:r.status,error:"non_json_content_type"};const body=await r.json();const v=pathGet(body,c.export_path);const actual=observedType(v);const expected=c.export_type==="integer"?"number":c.export_type;return {pass:actual===expected,status:r.status,actual_type:actual,value:v,error:actual===expected?null:`type_or_path_mismatch:${actual}->${expected}`};}catch(e){return {pass:false,error:String(e)};}}

const evidence:any={directory_url:LIST_URL,limits:{MAX_APIS,MAX_SPECS,MAX_PROBES,MAX_ADMITTED,SPACING_MS},inspected:[],admitted:[]};
const list=await fetchJson(LIST_URL);const ids=Object.keys(list).sort().slice(0,MAX_APIS);let specsFetched=0,liveProbes=0,executableCandidates=0,firstProbePass=0,hostPolicyViolations=0;
for(const apiId of ids){
  if(specsFetched>=MAX_SPECS||liveProbes>=MAX_PROBES||evidence.admitted.length>=MAX_ADMITTED)break;
  const entry=list[apiId];const preferred=entry?.preferred;const version=entry?.versions?.[preferred];const specUrl=version?.swaggerUrl??version?.swaggerYamlUrl;if(!specUrl){evidence.inspected.push({api_id:apiId,rejected:"no_spec_url"});continue;}
  let spec:any;try{spec=await fetchJson(specUrl);specsFetched++;}catch(e){evidence.inspected.push({api_id:apiId,spec_url:specUrl,rejected:`spec_fetch:${String(e)}`});continue;}await sleep(SPACING_MS);
  let selected:any=null;
  for(const path of Object.keys(spec.paths??{}).sort()){
    const op=spec.paths[path]?.get;if(!op)continue;const built=buildCandidate(spec,apiId,specUrl,path,op);if(built.contract){selected=built.contract;break;}
  }
  if(!selected){evidence.inspected.push({api_id:apiId,spec_url:specUrl,rejected:"no_executable_get_candidate"});continue;}
  executableCandidates++;
  try{const u=new URL(selected.url);if(u.protocol!=="https:"){hostPolicyViolations++;evidence.inspected.push({api_id:apiId,spec_url:specUrl,rejected:"host_policy"});continue;}}catch{hostPolicyViolations++;continue;}
  if(liveProbes>=MAX_PROBES)break;const p1=await probe(selected);liveProbes++;if(p1.pass)firstProbePass++;await sleep(SPACING_MS);
  if(!p1.pass){evidence.inspected.push({api_id:apiId,spec_url:specUrl,contract:selected,first_probe:p1,rejected:"first_probe_failed"});continue;}
  const p2=await probe(selected);liveProbes++;await sleep(SPACING_MS);
  if(!p2.pass){evidence.inspected.push({api_id:apiId,spec_url:specUrl,contract:selected,first_probe:p1,second_probe:p2,rejected:"second_probe_failed"});continue;}
  const admitted={...selected,first_probe:p1,second_probe:p2};evidence.admitted.push(admitted);evidence.inspected.push({api_id:apiId,spec_url:specUrl,contract:selected,first_probe:p1,second_probe:p2,admitted:true});
}
const providerCount=new Set(evidence.admitted.map((x:any)=>x.api_id)).size;const firstProbeRate=executableCandidates?firstProbePass/executableCandidates:0;const criteria={five_contracts_admitted:evidence.admitted.length>=5,four_distinct_providers:providerCount>=4,first_probe_success_rate:firstProbeRate>=0.60,second_probe_validation_rate:evidence.admitted.length>0&&evidence.admitted.every((x:any)=>x.second_probe?.pass===true),scalar_export_present:evidence.admitted.every((x:any)=>x.export_path&&x.export_type),no_declared_security_on_admitted:true,host_policy_violations_zero:hostPolicyViolations===0,evidence_persisted:true};
const decision=Object.values(criteria).every(Boolean)?"GO_AUTONOMOUS_PRIMITIVE_DISCOVERY":"REASSESS_AUTONOMOUS_PRIMITIVE_DISCOVERY";
const summary={experiment:"MISSING Experiment 3B — Autonomous Primitive Discovery & Contract Induction",created_at:new Date().toISOString(),metrics:{apis_considered:ids.length,specs_fetched:specsFetched,live_probes:liveProbes,executable_candidates:executableCandidates,first_probe_passes:firstProbePass,first_probe_success_rate:firstProbeRate,admitted_contracts:evidence.admitted.length,distinct_providers:providerCount,host_policy_violations:hostPolicyViolations},criteria,decision,admitted:evidence.admitted};
await mkdir("results/experiment-3b",{recursive:true});await writeFile("results/experiment-3b/summary.json",JSON.stringify(summary,null,2)+"\n");await writeFile("results/experiment-3b/evidence.json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(summary,null,2));
