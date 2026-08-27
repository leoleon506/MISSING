import type {RecoveryLedger} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import {FOUR_A_BUDGET} from "./experiment4aCore.js";
import {compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";
import {FOUR_AP1_MAX_OBSERVED_FIELDS,fourAp1Sha,type P1ObservedField,type P1ProbeProof,type P1ProbeRecord,type P1RequestHypothesis} from "./experiment4ap1Model.js";

function scalar(value:any){return value===null||["string","number","boolean"].includes(typeof value);}
function sample(value:any){if(value===null)return "null";const text=String(value);return text.length<=120?text:`${text.slice(0,117)}...`;}
function norm(value:any){return String(value??"").trim().toLowerCase();}

function collect(value:any,prefix="",depth=0,out:{path:string;value:any}[]=[]){
  if(depth>7||out.length>=FOUR_AP1_MAX_OBSERVED_FIELDS*3)return out;
  if(scalar(value)){
    if(prefix)out.push({path:prefix,value});
    return out;
  }
  if(Array.isArray(value)){
    if(value.length)collect(value[0],prefix?`${prefix}.0`:"0",depth+1,out);
    return out;
  }
  if(value&&typeof value==="object"){
    for(const [key,child] of Object.entries(value)){
      const path=prefix?`${prefix}.${key}`:key;
      collect(child,path,depth+1,out);
      if(out.length>=FOUR_AP1_MAX_OBSERVED_FIELDS*3)break;
    }
  }
  return out;
}

function errorEnvelope(body:any){
  if(!body||typeof body!=="object"||Array.isArray(body))return false;
  if(body.success===false)return true;
  if(typeof body.status==="number"&&body.status>=400)return true;
  if(typeof body.statusCode==="number"&&body.statusCode>=400)return true;
  const keys=Object.keys(body).map(x=>x.toLowerCase());
  const hasError=keys.includes("error")||keys.includes("errors")||keys.includes("err");
  const substantive=keys.some(key=>!["error","errors","err","message","status","statuscode","code","success"].includes(key));
  return hasError&&!substantive;
}

function observedFields(hypothesis:P1RequestHypothesis,body:any,build:Record<string,any>,bodyFingerprint:string){
  const rows=collect(body).slice(0,FOUR_AP1_MAX_OBSERVED_FIELDS);
  return rows.map(({path,value}):P1ObservedField=>{
    const relations:string[]=[];
    for(const [name,inputValue] of Object.entries(build)){
      if(scalar(inputValue)&&norm(value)===norm(inputValue))relations.push(`TASK_INPUT:${name}:normalized_equal`);
      if(typeof value==="number"&&typeof inputValue==="number"&&value===inputValue)relations.push(`TASK_INPUT:${name}:numeric_equal`);
    }
    const leaf=path.split(".").filter(Boolean).at(-1)||path;
    return {
      id:`fld_${fourAp1Sha({hypothesis:hypothesis.id,path,bodyFingerprint}).slice(0,16)}`,
      path,
      leaf,
      tokens:lexicalTokensP1(leaf),
      sample_type:value===null?"null":typeof value,
      sample_value:sample(value),
      build_value_relations:[...new Set(relations)]
    };
  });
}

export async function probeHypothesisP1(hypothesis:P1RequestHypothesis,build:Record<string,any>,ledger:RecoveryLedger):Promise<P1ProbeProof>{
  const requested_at=new Date().toISOString();
  let requested_url="";
  try{
    requested_url=compileRequestHypothesisP1(hypothesis,build);
    const got=await fetchTextSafeR2(requested_url,requested_url,FOUR_A_BUDGET.max_bytes,ledger);
    const bytes=Buffer.byteLength(got.text);
    let body:any;
    try{body=JSON.parse(got.text);}catch{throw new Error("probe_response_not_json");}
    if(body===null||body===undefined)throw new Error("probe_response_empty");
    if(errorEnvelope(body))throw new Error("probe_error_envelope");
    const bodyFingerprint=fourAp1Sha(got.text);
    const fields=observedFields(hypothesis,body,build,bodyFingerprint);
    if(!fields.length)throw new Error("probe_no_scalar_fields");
    const schemaFingerprint=fourAp1Sha(fields.map(field=>({path:field.path,type:field.sample_type})));
    const record:P1ProbeRecord={
      hypothesis_id:hypothesis.id,
      disposition:"success",
      requested_url,
      requested_at,
      final_url:got.final_url,
      content_type:got.content_type,
      response_body_fingerprint:bodyFingerprint,
      schema_fingerprint:schemaFingerprint,
      observed_fields:fields,
      observed_path_count:fields.length,
      bytes,
      error:null
    };
    return {hypothesis,record};
  }catch(error){
    const record:P1ProbeRecord={hypothesis_id:hypothesis.id,disposition:"rejected",requested_url,requested_at,final_url:null,content_type:null,response_body_fingerprint:null,schema_fingerprint:null,observed_fields:[],observed_path_count:0,bytes:0,error:String(error).replace(/^Error:\s*/,"")};
    return {hypothesis,record};
  }
}
