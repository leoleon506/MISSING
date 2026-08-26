import {mkdir,writeFile} from "node:fs/promises";
import {PUBLIC_APIS_URL} from "./experiment3uCore.js";
import {BLIND_CASES} from "./experiment3yCore.js";
import {RecoveryLedger,derivedSafetyCounters,sha3yr} from "./experiment3yrCore.js";
import {fetchTextSafeR2,recoveredBroadRetrieveR2,safetyGateFromLedger,validatePublicHostname} from "./experiment3yr2Core.js";

const OUTDIR="results/experiment-3yr2f";
async function main(){
  await mkdir(OUTDIR,{recursive:true});
  const started_at=new Date().toISOString(),ledger=new RecoveryLedger();
  const fetched=await fetchTextSafeR2(PUBLIC_APIS_URL,PUBLIC_APIS_URL,4*1024*1024,ledger);
  const catalog=fetched.text;
  const retrieval=BLIND_CASES.map(c=>{const ranked=recoveredBroadRetrieveR2(c as any,catalog);return {case_id:c.case_id,known_target_ranks:{rest_countries:ranked.find(x=>/rest countries/i.test(x.name))?.lexical_rank??null,pokeapi:ranked.find(x=>/pok[eé]api/i.test(x.name))?.lexical_rank??null,open_brewery:ranked.find(x=>/open brewery/i.test(x.name))?.lexical_rank??null}};});
  const targetRanks={country:retrieval.find(x=>x.case_id==="country_metadata")?.known_target_ranks.rest_countries??null,pokemon:retrieval.find(x=>x.case_id==="pokemon_metadata")?.known_target_ranks.pokeapi??null,brewery:retrieval.find(x=>x.case_id==="brewery_metadata")?.known_target_ranks.open_brewery??null};
  const rejectEvidence:any[]=[];
  for(const [name,address] of [["loopback","127.0.0.1"],["rfc1918","10.1.2.3"]] as const){const resolver=async()=>[{address,family:4}] as any;try{await validatePublicHostname("docs.example.com",ledger,resolver as any);rejectEvidence.push({name,rejected:false});}catch(e){rejectEvidence.push({name,rejected:true,error:String(e)});}}
  const counters=derivedSafetyCounters(ledger);
  const gates={catalog_via_safe_fetch:ledger.events.some(e=>e.layer==="network"&&e.kind==="fetch"&&e.accepted),public_dns_evidence:ledger.events.some(e=>e.layer==="guard"&&e.kind==="public_dns"&&e.accepted),private_dns_rejection_evidence:rejectEvidence.every(x=>x.rejected)&&ledger.events.some(e=>e.kind==="private_hosts"&&!e.accepted),ledger_non_empty:ledger.events.length>0,retrieval_unchanged:Object.values(targetRanks).every(x=>typeof x==="number"&&x<=120),event_derived_safety_gate:safetyGateFromLedger(ledger,counters)};
  const decision=Object.values(gates).every(Boolean)?"GO_3Y_R2F_FREEZE_AUDIT":"REASSESS_3Y_R2F_FREEZE_AUDIT";
  const report={experiment:"3Y-R2F",purpose:"freeze_audit_only_no_algorithm_change",started_at,finished_at:new Date().toISOString(),fetched:{final_url:fetched.final_url,content_type:fetched.content_type,bytes:Buffer.byteLength(catalog)},targetRanks,rejectEvidence,ledger:{events:ledger.events,fingerprint:ledger.fingerprint()},safety_counters:counters,gates,decision};
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(decision);console.log(`fingerprint=${sha3yr(report)}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
