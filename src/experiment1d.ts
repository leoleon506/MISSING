import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Config={source_base_url:string;days:number;changes_per_page:number;services_per_page:number;request_spacing_ms:number;min_change_events:number;min_changed_services:number;min_schema_changes:number;min_repeat_churn_services:number;min_changed_service_share:number};
type Change={service_slug?:string;slug?:string;service?:string;type?:string;change_type?:string;created_at?:string;[key:string]:unknown};
type Service={slug?:string;id?:string;name?:string;[key:string]:unknown};

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const arr=(v:any):any[]=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.changes)?v.changes:Array.isArray(v?.services)?v.services:Array.isArray(v?.items)?v.items:[];
async function getJson(url:string){const r=await fetch(url,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-1D/0.1"}});if(!r.ok)throw new Error(`${r.status} ${r.statusText} for ${url}`);return r.json();}
const changeSlug=(c:Change)=>String(c.service_slug??c.slug??c.service??"");
const changeType=(c:Change)=>String(c.type??c.change_type??"unknown");

async function fetchAllChanges(cfg:Config){const all:Change[]=[];let page=1;for(;;){const u=new URL(`${cfg.source_base_url}/changes`);u.searchParams.set("days",String(cfg.days));u.searchParams.set("per_page",String(cfg.changes_per_page));u.searchParams.set("page",String(page));const rows=arr(await getJson(u.toString())) as Change[];if(!rows.length)break;all.push(...rows);if(rows.length<cfg.changes_per_page)break;page++;await sleep(cfg.request_spacing_ms);}return all;}
async function fetchAllServices(cfg:Config){const all:Service[]=[];let page=1;for(;;){const u=new URL(`${cfg.source_base_url}/services`);u.searchParams.set("per_page",String(cfg.services_per_page));u.searchParams.set("page",String(page));const rows=arr(await getJson(u.toString())) as Service[];if(!rows.length)break;all.push(...rows);if(rows.length<cfg.services_per_page)break;page++;await sleep(cfg.request_spacing_ms);}return all;}

const cfg=JSON.parse(await readFile(resolve("experiments/experiment-1d/config.json"),"utf8")) as Config;
const [changes,services]=await Promise.all([fetchAllChanges(cfg),fetchAllServices(cfg)]);
const byType=new Map<string,number>();const byService=new Map<string,number>();
for(const c of changes){const t=changeType(c);byType.set(t,(byType.get(t)??0)+1);const s=changeSlug(c);if(s)byService.set(s,(byService.get(s)??0)+1);}
const changedServices=byService.size;
const repeatChurn=[...byService.values()].filter(n=>n>=2).length;
const schemaChanges=byType.get("schema_changed")??0;
const changedShare=services.length?changedServices/services.length:0;
const criteria={enough_change_events:changes.length>=cfg.min_change_events,enough_changed_services:changedServices>=cfg.min_changed_services,enough_schema_changes:schemaChanges>=cfg.min_schema_changes,enough_repeat_churn_services:repeatChurn>=cfg.min_repeat_churn_services,enough_changed_service_share:changedShare>=cfg.min_changed_service_share,raw_evidence_persisted:true};
const decision=Object.values(criteria).every(Boolean)?"GO_CAPABILITY_CONTINUITY":"NO_GO_CAPABILITY_CONTINUITY";
const result={experiment:"MISSING Experiment 1D — Capability Continuity",created_at:new Date().toISOString(),config:cfg,metrics:{catalog_services:services.length,total_change_events:changes.length,changed_services:changedServices,changed_service_share:changedShare,schema_changes:schemaChanges,repeat_churn_services:repeatChurn,change_types:Object.fromEntries([...byType.entries()].sort((a,b)=>b[1]-a[1]))},criteria,decision};
const evidence={created_at:new Date().toISOString(),source:cfg.source_base_url,changes,services};
await mkdir("results/experiment-1d",{recursive:true});
await writeFile("results/experiment-1d/summary.json",JSON.stringify(result,null,2)+"\n");
await writeFile("results/experiment-1d/evidence.json",JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
