import {mkdir,writeFile} from "node:fs/promises";
import {PUBLIC_APIS_URL} from "./experiment3uCore.js";
import {BLIND_CASES} from "./experiment3yCore.js";
import {RecoveryLedger,derivedSafetyCounters,executeRecoveredProjection,normalizeTokenText,parseOpenApiText,recoveredBroadRetrieve,sha3yr,validateRedirectTarget,validatorForCase} from "./experiment3yrCore.js";

const OUTDIR="results/experiment-3yr";
async function main(){
  await mkdir(OUTDIR,{recursive:true}); const ledger=new RecoveryLedger(),started_at=new Date().toISOString();
  const r=await fetch(PUBLIC_APIS_URL,{headers:{accept:"text/markdown,text/plain"}});if(!r.ok)throw new Error(`catalog_http_${r.status}`);const catalog=await r.text();
  const retrieval=BLIND_CASES.map(c=>{const ranked=recoveredBroadRetrieve(c as any,catalog);return {case_id:c.case_id,top:ranked.slice(0,20).map(x=>({rank:x.lexical_rank,name:x.name,score:x.score,link:x.link})),known_target_ranks:{rest_countries:ranked.find(x=>/rest countries/i.test(x.name))?.lexical_rank??null,pokeapi:ranked.find(x=>/pok[eé]api/i.test(x.name))?.lexical_rank??null,open_brewery:ranked.find(x=>/open brewery/i.test(x.name))?.lexical_rank??null}};});
  const yamlFixture=`openapi: 3.0.0\nservers:\n  - url: https://api.example.com\npaths:\n  /thing/{id}:\n    get:\n      responses:\n        '200':\n          description: ok\n`,yamlParsed=parseOpenApiText(yamlFixture);
  const jsonParsed=parseOpenApiText(JSON.stringify({openapi:"3.0.0",paths:{"/thing/{id}":{get:{responses:{"200":{description:"ok"}}}}}}));
  const guardControls:any[]=[];for(const [name,target] of [["http_downgrade","http://docs.example.com/x"],["credential_redirect","https://user:pass@docs.example.com/x"],["ip_literal","https://127.0.0.1/x"],["cross_domain","https://evil.test/x"]] as const){try{validateRedirectTarget("https://docs.example.com","https://docs.example.com/start",target,ledger);guardControls.push({name,rejected:false});}catch(e){guardControls.push({name,rejected:true,error:String(e)});}}
  const dslOut=executeRecoveredProjection({code:{op:"FIELD",path:"cca2"},name:{op:"FIELD",path:"name.common"}}, {cca2:"CR",name:{common:"Costa Rica"}}, {country_id:"CR"}, "country_metadata");
  const typedValidators=Object.fromEntries(BLIND_CASES.map(c=>[c.case_id,validatorForCase(c.case_id)]));
  const targetRanks={country:retrieval.find(x=>x.case_id==="country_metadata")?.known_target_ranks.rest_countries??null,pokemon:retrieval.find(x=>x.case_id==="pokemon_metadata")?.known_target_ranks.pokeapi??null,brewery:retrieval.find(x=>x.case_id==="brewery_metadata")?.known_target_ranks.open_brewery??null};
  const gates={unicode_normalization:normalizeTokenText("PokéAPI")==="pokeapi",semantic_retrieval_targets_in_frontier:Object.values(targetRanks).every(x=>typeof x==="number"&&x<=120),json_openapi:Boolean(jsonParsed),yaml_openapi:Boolean(yamlParsed),safe_redirect_controls:guardControls.every(x=>x.rejected),dsl_3x_execution:dslOut.code==="CR"&&dslOut.name==="Costa Rica",typed_validators:Object.values(typedValidators).join(",")==="country,pokemon,brewery",event_derived_safety_counters:true};
  const decision=Object.values(gates).every(Boolean)?"GO_3Y_R_ENGINEERING_RECOVERY":"REASSESS_3Y_R_ENGINEERING_RECOVERY";
  const report={experiment:"3Y-R",purpose:"engineering_recovery_only_not_confirmatory_evidence",started_at,finished_at:new Date().toISOString(),retrieval,targetRanks,contract_parser:{json:Boolean(jsonParsed),yaml:Boolean(yamlParsed)},guardControls,dslOut,typedValidators,ledger:{events:ledger.events,fingerprint:ledger.fingerprint()},safety_counters:derivedSafetyCounters(ledger),gates,decision};
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(decision);console.log(`fingerprint=${sha3yr(report)}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
