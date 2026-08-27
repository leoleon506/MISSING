import type {Config} from "./config/index.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {materializeSelectionP1} from "./experiment4ap1Core.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,type P1ObservedField,type P1ProbeProof,type P1SemanticSelection} from "./experiment4ap1Model.js";
import {probeHypothesisP1} from "./experiment4ap1Probe.js";
import {buildRequestHypothesesP1,lexicalTokensP1} from "./experiment4ap1Request.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(row=>[row.case_id,row]));
function overlap(a:string,b:string){const x=new Set(lexicalTokensP1(a)),y=new Set(lexicalTokensP1(b));let n=0;for(const t of x)if(y.has(t))n++;return n;}
function echoCompatible(output:string,input:string){const out=lexicalTokensP1(output),inp=new Set(lexicalTokensP1(input));return out.length>0&&out.every(token=>inp.has(token));}

function fieldPacket(proof:P1ProbeProof,required:readonly string[]){
  return [...proof.record.observed_fields].map(field=>({field,score:Math.max(0,...required.map(output=>overlap(output,field.leaf)))*100+field.build_value_relations.length*20-Math.min(30,field.path.split(".").length)})).sort((a,b)=>b.score-a.score||a.field.path.length-b.field.path.length||a.field.path.localeCompare(b.field.path)).slice(0,48).map(row=>row.field);
}

function publicProof(proof:P1ProbeProof,required:readonly string[]){
  return {hypothesis_id:proof.hypothesis.id,origin:proof.hypothesis.origin,full_path:proof.hypothesis.full_path,proof_type:proof.hypothesis.proof_type,request_score:proof.hypothesis.score,input_bindings:proof.hypothesis.input_bindings,literal_bindings:proof.hypothesis.literal_bindings,probe_schema_fingerprint:proof.record.schema_fingerprint,probe_body_fingerprint:proof.record.response_body_fingerprint,fields:fieldPacket(proof,required).map(field=>({field_id:field.id,path:field.path,leaf:field.leaf,sample_type:field.sample_type,sample_value:field.sample_value,build_value_relations:field.build_value_relations}))};
}

function deterministicSelection(proofs:P1ProbeProof[],inputNames:readonly string[],required:readonly string[]):{selection:P1SemanticSelection;proof:P1ProbeProof}|null{
  for(const proof of proofs){
    const bindings:{task_output:string;source_id:string}[]=[];const used=new Set<string>();let ok=true;
    for(const output of required){
      const echoes=inputNames.filter(input=>echoCompatible(output,input)).map(input=>`TASK_INPUT:${input}`);
      const positive=proof.record.observed_fields.filter(field=>overlap(output,field.leaf)>0).sort((a,b)=>overlap(output,b.leaf)-overlap(output,a.leaf)||a.path.length-b.path.length);
      let source:string|null=null;
      if(echoes.length===1&&positive.length===0)source=echoes[0];
      else if(echoes.length===0&&positive.length===1)source=positive[0].id;
      else if(echoes.length===1&&positive.length===1&&positive[0].build_value_relations.some(row=>row.startsWith(echoes[0]+":")))source=positive[0].id;
      if(!source||(!source.startsWith("TASK_INPUT:")&&used.has(source))){ok=false;break;}
      if(!source.startsWith("TASK_INPUT:"))used.add(source);bindings.push({task_output:output,source_id:source});
    }
    if(ok)return {proof,selection:{decision:"SELECT",hypothesis_id:proof.hypothesis.id,output_bindings:bindings,reason:"P1_DETERMINISTIC_OBSERVED_MAPPING"}};
  }
  return null;
}

async function callStructured(config:Config,payload:any,jsonSchema:any){
  const started=Date.now();const response=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,temperature:0,messages:[{role:"system",content:["You are MISSING's semantic mapper over successful anonymous GET probes.","The request has already been proved from public documentation and executed safely. You cannot modify it.","Choose exactly one supplied hypothesis_id and only field_id values observed in that hypothesis, or TASK_INPUT echoes.","Never invent URLs, paths, parameter names, literals, response paths, fields, credentials, or numeric indices.","Map every required output exactly once. Do not reuse one observed field for two distinct outputs.","Use field path names, sample values, task intent, and build-value relations only for semantic correspondence. REJECT if not defensible."].join(" ")},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:jsonSchema}})});const latency_ms=Date.now()-started,text=await response.text();let body:any=null;try{body=JSON.parse(text);}catch{}const message=body?.choices?.[0]?.message;return {status:response.status,ok:response.ok,latency_ms,usage:body?.usage??null,raw:message?.content??null,refusal:message?.refusal??null};
}

function schema(proofs:P1ProbeProof[],inputNames:readonly string[],required:readonly string[]){
  const hypothesisIds=proofs.map(proof=>proof.hypothesis.id),fieldIds=[...new Set(proofs.flatMap(proof=>fieldPacket(proof,required).map(field=>field.id)))],sourceIds=[...fieldIds,...inputNames.map(input=>`TASK_INPUT:${input}`)];
  return {name:"missing_4ap1_observed_schema_mapping",strict:true,schema:{type:"object",additionalProperties:false,properties:{decision:{type:"string",enum:["SELECT","REJECT"]},hypothesis_id:{type:"string",enum:hypothesisIds},output_bindings:{type:"array",minItems:required.length,maxItems:required.length,items:{type:"object",additionalProperties:false,properties:{task_output:{type:"string",enum:required},source_id:{type:"string",enum:sourceIds}},required:["task_output","source_id"]}},reason:{type:"string"}},required:["decision","hypothesis_id","output_bindings","reason"]}};
}

function parse(raw:any):P1SemanticSelection{if(typeof raw!=="string")throw new Error("p1_planner_missing_content");const value=JSON.parse(raw);return {decision:value.decision,hypothesis_id:String(value.hypothesis_id),output_bindings:(value.output_bindings||[]).map((row:any)=>({task_output:String(row.task_output),source_id:String(row.source_id)})),reason:String(value.reason||"")};}

export async function synthesize4ap1(config:Config,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
  const c=BY_ID[provider.case_id];if(!c)throw new Error(`p1_unknown_case:${provider.case_id}`);
  const request=buildRequestHypothesesP1(evidence,provider.case_id),probeRecords:P1ProbeProof[]=[];
  for(const hypothesis of request.probe_packet.slice(0,FOUR_AP1_MAX_PROBES_PER_PROVIDER))probeRecords.push(await probeHypothesisP1(hypothesis,c.build,ledger));
  const successful=probeRecords.filter(row=>row.record.disposition==="success");
  const probeMetrics={schemaProbeCalls:probeRecords.length,schemaProbe2xxJson:successful.length,schemaProbeRejected:probeRecords.length-successful.length,schemaProbeBytes:successful.reduce((sum,row)=>sum+row.record.bytes,0)};
  const attribution={request_inventory_count:request.hypotheses.length,request_packet_count:request.probe_packet.length,request_inventory_fingerprint:request.inventory_fingerprint,request_hypothesis_fingerprint:request.request_fingerprint,request_hypotheses:request.probe_packet,probe_records:probeRecords.map(row=>row.record),...probeMetrics,no_numeric_indices:true};
  if(!successful.length)return {http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:{case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:"P1_NO_SUCCESSFUL_SCHEMA_PROBE"},parse_error:null,usage:null,latency_ms:0,probe_proof:null,semantic_selection:null,planner_skipped:true,deterministic_mapping:false,...attribution};

  const deterministic=deterministicSelection(successful,c.input_names,c.required);
  if(deterministic){
    try{const materialized=materializeSelectionP1(provider.case_id,provider.candidate_id,deterministic.proof,deterministic.selection);return {http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:materialized.raw,parse_error:null,usage:null,latency_ms:0,probe_proof:deterministic.proof,semantic_selection:deterministic.selection,operation_proof:materialized.proof,planner_skipped:true,deterministic_mapping:true,...attribution};}catch{}
  }

  const call=await callStructured(config,{case:{case_id:provider.case_id,intent:c.intent,input_names:c.input_names,required_outputs:c.required,build_input:c.build,replay_input:c.replay},provider:{candidate_id:provider.candidate_id,name:provider.name},successful_probe_hypotheses:successful.map(proof=>publicProof(proof,c.required))},schema(successful,c.input_names,c.required));
  let selection:P1SemanticSelection|null=null,parsed_json:any=null,probe_proof:P1ProbeProof|null=null,operation_proof:any=null,parse_error:string|null=null;
  try{selection=parse(call.raw);if(selection.decision==="REJECT")parsed_json={case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:`P1_SEMANTIC_REJECT:${selection.reason}`};else{probe_proof=successful.find(row=>row.hypothesis.id===selection!.hypothesis_id)||null;if(!probe_proof)throw new Error("p1_selected_probe_missing");const materialized=materializeSelectionP1(provider.case_id,provider.candidate_id,probe_proof,selection);parsed_json=materialized.raw;operation_proof=materialized.proof;}}catch(error){parse_error=String(error).replace(/^Error:\s*/,"");}
  return {http_status:call.status,http_ok:call.ok,refusal:call.refusal,raw_content:call.raw,parsed_json,parse_error,usage:call.usage,latency_ms:call.latency_ms,probe_proof,semantic_selection:selection,operation_proof,planner_skipped:false,deterministic_mapping:false,...attribution};
}
