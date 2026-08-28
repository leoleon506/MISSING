import type {P1RequestHypothesis} from "./experiment4ap1Model.js";
import {lexicalTokensP1} from "./experiment4ap1Request.js";
import type {ExecutedGetTrace4N} from "./experiment4nTrace.js";

export type RepresentationPreferenceMetrics4Q={
  representationPreferenceGroups:number;
  representationPreferenceSwaps:number;
  representationJsonPreferredGroups:number;
  lowerPreferenceEquivalentTraceBeforeJson:number;
};

const GENERIC_IDENTITY=new Set(["id","identifier","code","name","value"]);

export function identityCompatible4Q(output:string,input:string){
  const out=lexicalTokensP1(output),inp=lexicalTokensP1(input);
  if(!out.length||!inp.length)return false;
  if(out.join("_")===inp.join("_"))return true;
  const outSpecific=out.filter(t=>!GENERIC_IDENTITY.has(t)),inSpecific=inp.filter(t=>!GENERIC_IDENTITY.has(t));
  if(outSpecific.length&&inSpecific.length&&outSpecific.some(t=>inSpecific.includes(t)))return true;
  if(out.length===1&&GENERIC_IDENTITY.has(out[0])&&inp.includes(out[0]))return true;
  return false;
}

export function representationRank4Q(trace:ExecutedGetTrace4N|null|undefined){
  if(!trace||trace.disposition!=="success")return 0;
  let validJson=false;
  try{JSON.parse(trace.response_text);validJson=true}catch{}
  if(validJson)return 40;
  const ct=String(trace.content_type||"").toLowerCase();
  if(/(?:application|text)\/(?:[^;]+\+)?json/.test(ct))return 35;
  if(/xml/.test(ct)||/\.xml(?:$|[?#])/i.test(trace.requested_url))return 20;
  if(/csv/.test(ct)||/[?&]format=csv(?:&|$)/i.test(trace.requested_url)||/\.csv(?:$|[?#])/i.test(trace.requested_url))return 15;
  return 10;
}

function traceFor(h:P1RequestHypothesis,traces:ExecutedGetTrace4N[]){
  return traces.find(t=>h.source_operation_id===`trace4n_${t.trace_id}`)||null;
}
function equivalentSignature(h:P1RequestHypothesis){
  if(!String(h.proof_type||"").startsWith("4n_executed_trace_"))return null;
  let u:URL;try{u=new URL(h.origin+h.full_path)}catch{return null}
  const query=[...u.searchParams.entries()].map(([k,v])=>[k.toLowerCase(),k.toLowerCase()==="format"?"*":v] as const).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
  const slotShape=h.slots.map(s=>({in:s.in,name:s.name,required:s.required,auth_like:s.auth_like})).sort((a,b)=>`${a.in}:${a.name}`.localeCompare(`${b.in}:${b.name}`));
  const inputShape=Object.keys(h.input_bindings).sort();
  return JSON.stringify({origin:u.origin,path:u.pathname,query,slotShape,inputShape,proof_type:h.proof_type});
}

export function preferEquivalentExecutedTraces4Q(packet:P1RequestHypothesis[],traces:ExecutedGetTrace4N[]){
  const out=[...packet],metrics:RepresentationPreferenceMetrics4Q={representationPreferenceGroups:0,representationPreferenceSwaps:0,representationJsonPreferredGroups:0,lowerPreferenceEquivalentTraceBeforeJson:0};
  const groups=new Map<string,number[]>();
  out.forEach((h,i)=>{const sig=equivalentSignature(h);if(sig){const a=groups.get(sig)||[];a.push(i);groups.set(sig,a)}});
  for(const indexes of groups.values()){
    if(indexes.length<2)continue;
    metrics.representationPreferenceGroups++;
    const before=indexes.map(i=>out[i]),sorted=[...before].sort((a,b)=>representationRank4Q(traceFor(b,traces))-representationRank4Q(traceFor(a,traces))||b.score-a.score||a.id.localeCompare(b.id));
    const bestRank=representationRank4Q(traceFor(sorted[0],traces));
    if(bestRank>=35)metrics.representationJsonPreferredGroups++;
    for(let j=0;j<indexes.length;j++){if(out[indexes[j]].id!==sorted[j].id)metrics.representationPreferenceSwaps++;out[indexes[j]]=sorted[j]}
    if(bestRank>=35){let seenJson=false;for(const i of indexes){const rank=representationRank4Q(traceFor(out[i],traces));if(rank>=35)seenJson=true;else if(!seenJson)metrics.lowerPreferenceEquivalentTraceBeforeJson++}}
  }
  return {packet:out,metrics};
}
