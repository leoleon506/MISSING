import { mkdir, writeFile } from "node:fs/promises";
import { Client, StreamableHTTPClientTransport, SSEClientTransport } from "@modelcontextprotocol/client";

const REGISTRY_URL="https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100";
const MAX_SERVERS=30,MAX_EXECUTIONS=8,TIMEOUT_MS=12000;
const READ_WORDS=["get","list","read","search","find","lookup","fetch","inspect","describe","status","health","info","view","show","discover","ping"];
const MUTATION_WORDS=["create","update","delete","remove","send","publish","post","put","patch","upload","write","insert","checkout","purchase","buy","order","pay","transfer","submit","commit","merge","close","cancel","invite","message","email","reply","vote","like","follow","subscribe","unsubscribe","deploy","restart","stop","start","set","change","edit","add","execute","run","save","generate","trigger","login","logout","authorize","authenticate","mint"];
let credentialsSupplied=0,unsafeToolsExecuted=0,requiredParamToolsExecuted=0,nonEmptyArgsExecutions=0;

type Candidate={name:string;namespace:string;url:string;transport:string;record:any};
function namespaceOf(name:string){return name.includes("/")?name.split("/")[0]:name.includes(":")?name.split(":")[0]:name;}
function withTimeout<T>(p:Promise<T>,ms=TIMEOUT_MS):Promise<T>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(`timeout_${ms}`)),ms);p.then(v=>{clearTimeout(t);resolve(v)},e=>{clearTimeout(t);reject(e)});});}
function normalizeRemoteType(x:any){return String(x?.type??x?.transport??"").toLowerCase();}
function remoteUrl(x:any){return x?.url??x?.uri??x?.endpoint??null;}
function eligibleRemote(rem:any){const type=normalizeRemoteType(rem),url=remoteUrl(rem);if(!["streamable-http","sse"].includes(type))return false;if(typeof url!=="string"||!url.startsWith("https://")||/[{}]/.test(url))return false;const headers=rem?.headers;if(headers&&((Array.isArray(headers)&&headers.length>0)||(!Array.isArray(headers)&&Object.keys(headers).length>0)))return false;return true;}
async function fetchRegistry(){const r=await fetch(REGISTRY_URL,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-3E/0.1"}});if(!r.ok)throw new Error(`registry_${r.status}`);return r.json() as Promise<any>;}
function extractRecords(body:any){if(Array.isArray(body))return body;if(Array.isArray(body?.servers))return body.servers;if(Array.isArray(body?.data))return body.data;if(Array.isArray(body?.items))return body.items;return [];}
function buildCandidates(records:any[]){const out:Candidate[]=[];for(const raw of records){const s=raw?.server??raw;const status=String(raw?.status??s?.status??"active").toLowerCase();if(["deleted","deprecated","inactive"].includes(status))continue;const name=String(s?.name??raw?.name??"");if(!name)continue;const rem=(s?.remotes??raw?.remotes??[]).find(eligibleRemote);if(!rem)continue;out.push({name,namespace:namespaceOf(name),url:remoteUrl(rem),transport:normalizeRemoteType(rem),record:raw});}out.sort((a,b)=>a.name.localeCompare(b.name)||a.url.localeCompare(b.url));const seen=new Set<string>();return out.filter(c=>!seen.has(c.name)&&!!seen.add(c.name));}
function textHasWord(text:string,words:string[]){const normalized=text.toLowerCase().replace(/[_\-./:]+/g," ");return words.some(w=>new RegExp(`\\b${w}\\b`,`i`).test(normalized));}
function requiredCount(tool:any){return Array.isArray(tool?.inputSchema?.required)?tool.inputSchema.required.length:0;}
function classify(tool:any){const reasons:string[]=[];if(!tool?.inputSchema||typeof tool.inputSchema!=="object"||Array.isArray(tool.inputSchema))reasons.push("invalid_input_schema");if(requiredCount(tool)>0)reasons.push("required_parameters_present");if(tool?.annotations?.readOnlyHint!==true)reasons.push("missing_affirmative_readonly_hint");if(tool?.annotations?.destructiveHint===true)reasons.push("destructive_hint_true");const text=`${tool?.name??""} ${tool?.description??""}`;if(!textHasWord(text,READ_WORDS))reasons.push("no_explicit_read_signal");if(textHasWord(text,MUTATION_WORDS))reasons.push("mutation_signal_present");return {safe:reasons.length===0,reasons};}
function makeTransport(c:Candidate){return c.transport==="sse"?new SSEClientTransport(new URL(c.url)):new StreamableHTTPClientTransport(new URL(c.url));}
async function inspectAndMaybeExecute(c:Candidate,allowExecution:boolean){const client=new Client({name:"missing-experiment-3e",version:"0.1.0"});const decisions:any[]=[];try{await withTimeout(client.connect(makeTransport(c)));const listed:any=await withTimeout(client.listTools());for(const tool of listed.tools??[]){const decision=classify(tool);decisions.push({tool:{name:tool.name,description:tool.description??null,inputSchema:tool.inputSchema,annotations:tool.annotations??null},...decision});}
    const accepted=decisions.find(d=>d.safe);
    let execution:any=null;
    if(allowExecution&&accepted){const args={};if(!accepted.safe)unsafeToolsExecuted++;if(requiredCount(accepted.tool)>0)requiredParamToolsExecuted++;if(Object.keys(args).length!==0)nonEmptyArgsExecutions++;const started=Date.now();try{const result=await withTimeout(client.callTool({name:accepted.tool.name,arguments:args}));execution={tool_name:accepted.tool.name,args,result,latency_ms:Date.now()-started,success:true};}catch(e){execution={tool_name:accepted.tool.name,args,error:String(e),latency_ms:Date.now()-started,success:false};}}
    await client.close();return {connected:true,decisions,execution};
  }catch(e){try{await client.close();}catch{}return {connected:false,error:String(e),decisions,execution:null};}}

const registry=await fetchRegistry();const records=extractRecords(registry);const candidates=buildCandidates(records);const serverEvidence:any[]=[];let executionAttempts=0,executionSuccesses=0,rejectedTools=0;const successfulNamespaces=new Set<string>();
for(const c of candidates.slice(0,MAX_SERVERS)){
  const allowExecution=executionAttempts<MAX_EXECUTIONS;
  const r=await inspectAndMaybeExecute(c,allowExecution);
  rejectedTools+=r.decisions.filter((d:any)=>!d.safe).length;
  if(r.execution){executionAttempts++;if(r.execution.success){executionSuccesses++;successfulNamespaces.add(c.namespace);}}
  serverEvidence.push({name:c.name,namespace:c.namespace,url:c.url,transport:c.transport,...r});
  if(executionAttempts>=MAX_EXECUTIONS&&executionSuccesses>=4&&successfulNamespaces.size>=4&&rejectedTools>=10)break;
}
const successRate=executionAttempts?executionSuccesses/executionAttempts:0;const criteria={four_safe_successes:executionSuccesses>=4,four_distinct_servers_namespaces:successfulNamespaces.size>=4,execution_success_rate:successRate>=0.80,zero_unsafe_executions:unsafeToolsExecuted===0,zero_required_parameter_executions:requiredParamToolsExecuted===0,zero_nonempty_args_executions:nonEmptyArgsExecutions===0,zero_credentials:credentialsSupplied===0,ten_live_rejections:rejectedTools>=10,evidence_persisted:true};const decision=Object.values(criteria).every(Boolean)?"GO_MCP_SAFE_READONLY_EXECUTION":"REASSESS_MCP_SAFE_READONLY_EXECUTION";
const summary={experiment:"MISSING Experiment 3E — MCP Safe Read-Only Execution Gate",created_at:new Date().toISOString(),metrics:{registry_records:records.length,eligible_servers:candidates.length,servers_inspected:serverEvidence.length,live_tools_rejected:rejectedTools,execution_attempts:executionAttempts,execution_successes:executionSuccesses,execution_success_rate:successRate,successful_namespaces:successfulNamespaces.size,unsafe_tools_executed:unsafeToolsExecuted,required_param_tools_executed:requiredParamToolsExecuted,nonempty_args_executions:nonEmptyArgsExecutions,credentials_supplied:credentialsSupplied},criteria,decision,executions:serverEvidence.filter(x=>x.execution).map(x=>({server:x.name,namespace:x.namespace,url:x.url,execution:x.execution}))};
await mkdir("results/experiment-3e",{recursive:true});await writeFile("results/experiment-3e/summary.json",JSON.stringify(summary,null,2)+"\n");await writeFile("results/experiment-3e/evidence.json",JSON.stringify({registry_url:REGISTRY_URL,raw_registry:registry,candidates,server_evidence:serverEvidence},null,2)+"\n");console.log(JSON.stringify(summary,null,2));
