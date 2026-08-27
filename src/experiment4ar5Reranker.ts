import type {CaseDef} from "./experiment3qCore.js";
import type {ProviderCandidate} from "./experiment3vCore.js";
import {deterministicRerankR5,FOUR_AR5_RERANK_COUNT,fourAr5Sha,type R5ScoreRow} from "./experiment4ar5Core.js";

function schema(ids:string[]){
  return {
    name:"missing_4ar5_provider_scoring",
    strict:true,
    schema:{
      type:"object",
      additionalProperties:false,
      required:["case_id","scores"],
      properties:{
        case_id:{type:"string"},
        scores:{
          type:"array",
          minItems:ids.length,
          maxItems:ids.length,
          items:{
            type:"object",
            additionalProperties:false,
            required:["candidate_id","functional_fit","evidence_likelihood","anonymous_get_likelihood"],
            properties:{
              candidate_id:{type:"string",enum:ids},
              functional_fit:{type:"integer",enum:[0,1,2,3,4,5]},
              evidence_likelihood:{type:"integer",enum:[0,1,2,3,4,5]},
              anonymous_get_likelihood:{type:"integer",enum:[0,1,2,3,4,5]}
            }
          }
        }
      }
    }
  } as const;
}
function visible(xs:ProviderCandidate[]){return xs.map(x=>({candidate_id:x.candidate_id,lexical_rank:x.lexical_rank,name:x.name,description:x.description,category:x.category,auth:x.auth,https:x.https}));}
function validateScores(x:any,broad:ProviderCandidate[],caseId:string){if(!x||typeof x!=="object"||Array.isArray(x))throw new Error("r5_rerank_not_object");if(x.case_id!==caseId)throw new Error("r5_rerank_case_mismatch");if(!Array.isArray(x.scores)||x.scores.length!==broad.length)throw new Error("r5_rerank_score_count");const allowed=new Set(broad.map(c=>c.candidate_id)),seen=new Set<string>();for(const r of x.scores){if(!r||typeof r!=="object"||!allowed.has(r.candidate_id)||seen.has(r.candidate_id))throw new Error("r5_rerank_candidate_set");seen.add(r.candidate_id);for(const k of ["functional_fit","evidence_likelihood","anonymous_get_likelihood"])if(!Number.isInteger(r[k])||r[k]<0||r[k]>5)throw new Error(`r5_rerank_score_invalid:${k}`);}if(seen.size!==allowed.size)throw new Error("r5_rerank_candidate_set");return x.scores as R5ScoreRow[];}
export async function callProviderRerankerR5(config:any,c:CaseDef,broad:ProviderCandidate[],phase:"initial"|"repair",previous?:string){
 const frontier=broad.slice(0,FOUR_AR5_RERANK_COUNT),ids=frontier.map(x=>x.candidate_id),packet={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,required_output_leaf_names:c.required_output_leaf_names},providers:visible(frontier)},packetFingerprint=fourAr5Sha(packet);
 const system=["You are MISSING's frozen provider scoring model.","Score EVERY supplied candidate exactly once; never add, remove, duplicate, or reorder the candidate universe conceptually.","functional_fit: 0-5 for whether the provider category/description can satisfy the requested inputs and outputs.","evidence_likelihood: 0-5 for likelihood that its public site exposes machine-readable API documentation, examples, schemas, OpenAPI/Swagger, or reference material sufficient to ground a contract.","anonymous_get_likelihood: 0-5 for likelihood the capability is available through anonymous HTTPS GET without credentials.","Use only supplied metadata. Do not infer URLs, hosts, endpoints, headers, credentials, or providers outside the list.","Return exact case_id and strict scores only."].join(" ");
 const payload={...packet,phase,previous_contract_failure:previous??null};const t0=Date.now();const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,temperature:0,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:schema(ids)}})});const latency_ms=Date.now()-t0,text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;try{if(typeof raw!=="string")throw new Error("r5_rerank_no_content");parsed=JSON.parse(raw);validateScores(parsed,frontier,c.case_id);}catch(e){parse_error=String(e).replace(/^Error:\s*/,"");}
 return {phase,expected_case_id:c.case_id,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error,usage:body?.usage??null,latency_ms,reranker_packet_fingerprint:packetFingerprint,frontier_count:frontier.length};
}
export function parseRerankAttemptR5(attempt:any,broad:ProviderCandidate[],expectedCaseId?:string){if(!attempt.http_ok)return {selection:null,error:`planner_http_${attempt.http_status}`};if(attempt.refusal)return {selection:null,error:"planner_refusal"};if(attempt.parse_error)return {selection:null,error:attempt.parse_error};let rows:R5ScoreRow[];try{rows=validateScores(attempt.parsed_json,broad.slice(0,FOUR_AR5_RERANK_COUNT),expectedCaseId??attempt.expected_case_id);}catch(e){return {selection:null,error:String(e).replace(/^Error:\s*/,"")};}const ranked=deterministicRerankR5(rows,broad.slice(0,FOUR_AR5_RERANK_COUNT));const selected=ranked.slice(0,12).map(x=>({candidate_id:x.candidate_id,reason:`r5_score=${x.r5_score};fit=${x.r5_functional_fit};evidence=${x.r5_evidence_likelihood};anonymous_get=${x.r5_anonymous_get_likelihood}`,r5_score:x.r5_score,r5_functional_fit:x.r5_functional_fit,r5_evidence_likelihood:x.r5_evidence_likelihood,r5_anonymous_get_likelihood:x.r5_anonymous_get_likelihood,lexical_rank:x.lexical_rank}));return {selection:{case_id:expectedCaseId??attempt.expected_case_id,selected,reranker_packet_fingerprint:attempt.reranker_packet_fingerprint},error:null};}
export function resolveSelectedR5(selection:any,broad:ProviderCandidate[]){const by=new Map(broad.map(x=>[x.candidate_id,x]));return selection.selected.map((r:any)=>({...by.get(r.candidate_id),r5_score:r.r5_score,r5_functional_fit:r.r5_functional_fit,r5_evidence_likelihood:r.r5_evidence_likelihood,r5_anonymous_get_likelihood:r.r5_anonymous_get_likelihood})).filter((x:any)=>x.candidate_id);}
export function providerSelectionFingerprintR5(c:CaseDef,selection:any){return fourAr5Sha({case_id:c.case_id,reranker_packet_fingerprint:selection.reranker_packet_fingerprint,selected:selection.selected.map((x:any)=>({candidate_id:x.candidate_id,r5_score:x.r5_score,lexical_rank:x.lexical_rank}))});}
