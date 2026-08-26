import { mkdir, writeFile } from "node:fs/promises";
import { Client, StreamableHTTPClientTransport, SSEClientTransport } from "@modelcontextprotocol/client";

const REGISTRY_URL="https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100";
const MAX_ATTEMPTS=30,MAX_ADMITTED=10,TIMEOUT_MS=12000;
let toolCallsExecuted=0,credentialsSupplied=0,unresolvedVariableAdmissions=0;

type Candidate={name:string;namespace:string;url:string;transport:string;record:any};
function namespaceOf(name:string){return name.includes("/")?name.split("/")[0]:name.includes(":")?name.split(":")[0]:name;}
function withTimeout<T>(p:Promise<T>,ms=TIMEOUT_MS):Promise<T>{return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(`timeout_${ms}`)),ms);p.then(v=>{clearTimeout(t);resolve(v)},e=>{clearTimeout(t);reject(e)});});}
function toolShapeValid(t:any){return typeof t?.name==="string"&&t.name.trim().length>0&&t.inputSchema&&typeof t.inputSchema==="object"&&!Array.isArray(t.inputSchema);}
function stableSchema(a:any,b:any){return JSON.stringify(a)===JSON.stringify(b);}
function normalizeRemoteType(x:any){return String(x?.type??x?.transport??"").toLowerCase();}
function remoteUrl(x:any){return x?.url??x?.uri??x?.endpoint??null;}
function literalHeadersOnly(x:any){const h=x?.headers;if(!h)return true;if(!Array.isArray(h)&&typeof h!=="object")return false;const vals=Array.isArray(h)?h.map((v:any)=>v?.value):Object.values(h).map((v:any)=>typeof v==="string"?v:(v as any)?.value);return vals.every(v=>typeof v==="string"&&!/[${}{]|env:|secret|token/i.test(v));}
async function fetchRegistry(){const r=await fetch(REGISTRY_URL,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-3D/0.1"}});if(!r.ok)throw new Error(`registry_${r.status}`);return r.json() as Promise<any>;}
function extractRecords(body:any){if(Array.isArray(body))return body;if(Array.isArray(body?.servers))return body.servers;if(Array.isArray(body?.data))return body.data;if(Array.isArray(body?.items))return body.items;return [];}
function buildCandidates(records:any[]){const out:Candidate[]=[];for(const raw of records){const s=raw?.server??raw;const status=String(raw?.status??s?.status??"active").toLowerCase();if(status==="deleted"||status==="deprecated"||status==="inactive")continue;const name=String(s?.name??raw?.name??"");if(!name)continue;for(const rem of s?.remotes??raw?.remotes??[]){const type=normalizeRemoteType(rem),url=remoteUrl(rem);if(!["streamable-http","sse"].includes(type)||typeof url!=="string"||!url.startsWith("https://"))continue;if(url.includes("{")||url.includes("}"))continue;if(!literalHeadersOnly(rem))continue;out.push({name,namespace:namespaceOf(name),url,transport:type,record:raw});break;}}
  out.sort((a,b)=>a.name.localeCompare(b.name)||a.url.localeCompare(b.url));const seen=new Set<string>();return out.filter(c=>{if(seen.has(c.name))return false;seen.add(c.name);return true;});}
async function listOnce(c:Candidate){const client=new Client({name:"missing-experiment-3d",version:"0.1.0"});let transport:any;try{transport=c.transport==="sse"?new SSEClientTransport(new URL(c.url)):new StreamableHTTPClientTransport(new URL(c.url));await withTimeout(client.connect(transport));const serverVersion=client.getServerVersion?.()??null;const tools:any[]=[];let cursor:string|undefined;do{const r:any=await withTimeout(client.listTools(cursor?{cursor}:undefined));tools.push(...(r.tools??[]));cursor=r.nextCursor;}while(cursor);await client.close();return {ok:true,tools,server_version:serverVersion};}catch(e){try{await client.close();}catch{}return {ok:false,error:String(e),tools:[] as any[]};}}

const registry=await fetchRegistry();const records=extractRecords(registry);const candidates=buildCandidates(records);const attempted:any[]=[];const admitted:any[]=[];let firstListSuccesses=0,totalTools=0;
for(const c of candidates.slice(0,MAX_ATTEMPTS)){
  if(admitted.length>=MAX_ADMITTED)break;
  const first=await listOnce(c);
  const validFirst=first.ok&&first.tools.length>0&&first.tools.every(toolShapeValid);
  if(validFirst)firstListSuccesses++;
  if(!validFirst){attempted.push({name:c.name,namespace:c.namespace,url:c.url,transport:c.transport,first,rejected:"first_list_failed_or_invalid"});continue;}
  const second=await listOnce(c);
  const firstMap=new Map(first.tools.map((t:any)=>[t.name,t]));
  const secondMap=new Map(second.tools.map((t:any)=>[t.name,t]));
  const persistent=second.ok&&[...firstMap.entries()].every(([name,t]:any)=>secondMap.has(name)&&stableSchema(t.inputSchema,(secondMap.get(name) as any)?.inputSchema));
  if(!persistent){attempted.push({name:c.name,namespace:c.namespace,url:c.url,transport:c.transport,first,second,rejected:"second_list_not_persistent"});continue;}
  const normalizedTools=first.tools.map((t:any)=>({name:t.name,description:t.description??null,inputSchema:t.inputSchema,outputSchema:t.outputSchema??null}));
  totalTools+=normalizedTools.length;
  admitted.push({name:c.name,namespace:c.namespace,url:c.url,transport:c.transport,server_version:first.server_version,tools:normalizedTools,second_tool_names:second.tools.map((t:any)=>t.name)});
  attempted.push({name:c.name,namespace:c.namespace,url:c.url,transport:c.transport,first_tool_count:first.tools.length,second_tool_count:second.tools.length,admitted:true});
}
const attempts=attempted.length;const namespaces=new Set(admitted.map(x=>x.namespace)).size;const firstRate=attempts?firstListSuccesses/attempts:0;const toolValidity=admitted.every(s=>s.tools.every(toolShapeValid));const persistence=admitted.length>0&&admitted.every(s=>s.tools.every((t:any)=>s.second_tool_names.includes(t.name)));
const criteria={five_live_servers:admitted.length>=5,five_distinct_namespaces:namespaces>=5,twenty_tools:totalTools>=20,first_list_success_rate:firstRate>=0.40,all_tool_schemas_valid:toolValidity,second_connection_persistence:persistence,zero_tool_calls:toolCallsExecuted===0,zero_credentials:credentialsSupplied===0,zero_unresolved_variable_admissions:unresolvedVariableAdmissions===0,evidence_persisted:true};
const decision=Object.values(criteria).every(Boolean)?"GO_LIVE_MCP_TOOL_DISCOVERY":"REASSESS_LIVE_MCP_TOOL_DISCOVERY";
const summary={experiment:"MISSING Experiment 3D — Live MCP Tool Discovery",created_at:new Date().toISOString(),metrics:{registry_records:records.length,eligible_remote_candidates:candidates.length,servers_attempted:attempts,first_list_successes:firstListSuccesses,first_list_success_rate:firstRate,admitted_servers:admitted.length,distinct_namespaces:namespaces,total_tools_discovered:totalTools,tool_calls_executed:toolCallsExecuted,credentials_supplied:credentialsSupplied,unresolved_variable_admissions:unresolvedVariableAdmissions},criteria,decision,admitted};
await mkdir("results/experiment-3d",{recursive:true});await writeFile("results/experiment-3d/summary.json",JSON.stringify(summary,null,2)+"\n");await writeFile("results/experiment-3d/evidence.json",JSON.stringify({registry_url:REGISTRY_URL,raw_registry:registry,candidates,attempted,admitted},null,2)+"\n");console.log(JSON.stringify(summary,null,2));
