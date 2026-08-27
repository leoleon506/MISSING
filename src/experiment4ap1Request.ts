import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {extractOperationInventoryR6R} from "./experiment4ar6rEvidence.js";
import type {R6ROperation} from "./experiment4ar6rModel.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";

const AUTH_LIKE=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;
const GENERIC_SINGLE_SLOT=/^(?:id|name|q|s|query|search|term|value|input)$/i;

export function lexicalTokensP1(value:string){
  return [...new Set(String(value)
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g,"$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token=>token.endsWith("ies")&&token.length>4?`${token.slice(0,-3)}y`:token.endsWith("s")&&token.length>3?token.slice(0,-1):token)
    .filter(token=>token.length>=2))];
}

function overlap(a:string,b:string){
  const left=new Set(lexicalTokensP1(a)),right=new Set(lexicalTokensP1(b));
  let count=0;for(const token of left)if(right.has(token))count++;return count;
}

function normalizedScalar(value:any){return String(value??"").trim().toLowerCase();}
function buildMatchesLiteral(value:any,literal:string){return normalizedScalar(value)===normalizedScalar(literal);}

function slotsFor(operation:R6ROperation):P1RequestSlot[]{
  return [...operation.path_parameters,...operation.query_parameters].map(param=>{
    const id=`par_${fourAp1Sha({operation:operation.operation_id,name:param.name,in:param.in}).slice(0,14)}`;
    return {id,name:param.name,in:param.in,required:param.required,auth_like:AUTH_LIKE.test(param.name),literals:param.literals.map(value=>({id:`lit_${fourAp1Sha({id,value}).slice(0,14)}`,value}))};
  });
}

function evidenceContext(operation:R6ROperation,evidence:DocEvidence[]){
  if(operation.request_offset===null)return "";
  for(const id of operation.evidence_ids){
    const item=evidence.find(row=>row.evidence_id===id&&row.state==="ok");
    if(!item)continue;
    const start=Math.max(0,operation.request_offset-700),end=Math.min(item.text.length,operation.request_offset+1200);
    return item.text.slice(start,end);
  }
  return "";
}

function concretePathRelation(operation:R6ROperation,evidence:DocEvidence[],inputName:string,buildValue:any){
  const raw=String(buildValue??"").trim();
  if(raw.length<3||operation.full_path.includes("{"))return null;
  const segments=operation.full_path.split("/");
  const matches:number[]=[];
  for(let i=0;i<segments.length;i++){
    let decoded=segments[i];try{decoded=decodeURIComponent(decoded);}catch{}
    if(normalizedScalar(decoded)===normalizedScalar(raw))matches.push(i);
  }
  if(matches.length!==1)return null;
  const context=evidenceContext(operation,evidence);
  if(overlap(inputName,context)===0)return null;
  const idx=matches[0],path=[...segments];path[idx]=`{${inputName}}`;
  return path.join("/")||"/";
}

function enumerateAssignments(inputNames:string[],slots:P1RequestSlot[],build:Record<string,any>){
  const nonAuthSlots=slots.filter(slot=>!slot.auth_like);
  const rows=inputNames.map(input=>{
    const candidates=nonAuthSlots.map(slot=>{
      const lexical=overlap(input,slot.name);
      const example=slot.literals.some(literal=>buildMatchesLiteral(build[input],literal.value));
      let score=lexical*120+(example?180:0);
      if(!score&&inputNames.length===1&&nonAuthSlots.length===1&&GENERIC_SINGLE_SLOT.test(slot.name))score=35;
      return {slot,score};
    }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||Number(b.slot.in==="path")-Number(a.slot.in==="path")||a.slot.name.localeCompare(b.slot.name)).slice(0,4);
    return {input,candidates};
  });
  if(rows.some(row=>!row.candidates.length))return [] as {bindings:Record<string,string>;score:number}[];
  const out:{bindings:Record<string,string>;score:number}[]=[];
  const visit=(index:number,bindings:Record<string,string>,used:Set<string>,score:number)=>{
    if(index===rows.length){out.push({bindings:{...bindings},score});return;}
    const row=rows[index];
    for(const candidate of row.candidates){
      if(used.has(candidate.slot.id))continue;
      bindings[row.input]=candidate.slot.id;used.add(candidate.slot.id);
      visit(index+1,bindings,used,score+candidate.score);
      used.delete(candidate.slot.id);delete bindings[row.input];
    }
  };
  visit(0,{},new Set(),0);
  return out.sort((a,b)=>b.score-a.score).slice(0,8);
}

function hypothesisFrom(operation:R6ROperation,evidence:DocEvidence[],caseId:string){
  const c=FOUR_A_CASES.find(row=>row.case_id===caseId);if(!c)return [] as P1RequestHypothesis[];
  let slots=slotsFor(operation),fullPath=operation.full_path,concreteRelation=false;
  const nonAuth=slots.filter(slot=>!slot.auth_like);
  if(!nonAuth.length&&c.input_names.length===1){
    const input=c.input_names[0],related=concretePathRelation(operation,evidence,input,c.build[input]);
    if(related){
      fullPath=related;concreteRelation=true;
      const id=`par_${fourAp1Sha({operation:operation.operation_id,name:input,in:"path",concrete:true}).slice(0,14)}`;
      slots=[...slots,{id,name:input,in:"path",required:true,auth_like:false,literals:[]}];
    }
  }
  const requiredAuth=slots.filter(slot=>slot.required&&slot.auth_like);if(requiredAuth.length)return [];
  const assignments=enumerateAssignments([...c.input_names],slots,c.build);if(!assignments.length)return [];
  const out:P1RequestHypothesis[]=[];
  for(const assignment of assignments){
    const used=new Set(Object.values(assignment.bindings));
    const literalBindings:Record<string,string>={};let valid=true;
    for(const slot of slots){
      if(used.has(slot.id)||slot.auth_like)continue;
      if(slot.required){
        if(slot.literals.length===1)literalBindings[slot.id]=slot.literals[0].id;else{valid=false;break;}
      }else if(slot.literals.length===1&&/json/i.test(slot.literals[0].value)&&/(?:format|response|output|type)/i.test(slot.name)){
        literalBindings[slot.id]=slot.literals[0].id;
      }
    }
    if(!valid)continue;
    const baseScore=assignment.score+(operation.proof_type==="openapi"?100:operation.proof_type==="endpoint_json_example"?75:55)+operation.api_confidence*8+(concreteRelation?15:0)-Math.max(0,slots.length-c.input_names.length)*2;
    const identity={operation:operation.operation_id,path:fullPath,inputs:assignment.bindings,literals:literalBindings,evidence:operation.evidence_ids};
    out.push({id:`req_${fourAp1Sha(identity).slice(0,16)}`,source_operation_id:operation.operation_id,origin:operation.origin,full_path:fullPath,proof_type:operation.proof_type,evidence_ids:[...operation.evidence_ids],source_urls:[...operation.source_urls],slots,input_bindings:assignment.bindings,literal_bindings:literalBindings,score:baseScore,concrete_relation:concreteRelation});
  }
  return out;
}

export function buildRequestHypothesesP1(evidence:DocEvidence[],caseId:string){
  const inventory=extractOperationInventoryR6R(evidence,caseId);
  const all=inventory.inventory.flatMap(operation=>hypothesisFrom(operation,evidence,caseId));
  const dedup=new Map<string,P1RequestHypothesis>();
  for(const row of all){
    const key=fourAp1Sha({origin:row.origin,path:row.full_path,inputs:row.input_bindings,literals:row.literal_bindings});
    const prior=dedup.get(key);if(!prior||row.score>prior.score)dedup.set(key,row);
  }
  const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return {hypotheses,probe_packet:hypotheses.slice(0,FOUR_AP1_MAX_PROBES_PER_PROVIDER),inventory_fingerprint:inventory.inventory_fingerprint,request_fingerprint:fourAp1Sha(hypotheses)};
}

export function compileRequestHypothesisP1(hypothesis:P1RequestHypothesis,input:Record<string,any>){
  let path=hypothesis.full_path;
  const byId=new Map(hypothesis.slots.map(slot=>[slot.id,slot]));
  for(const [inputName,slotId] of Object.entries(hypothesis.input_bindings)){
    const slot=byId.get(slotId);if(!slot)throw new Error(`p1_unknown_input_slot:${slotId}`);
    const value=input[inputName];if(value===undefined||value===null)throw new Error(`p1_missing_input:${inputName}`);
    if(slot.in==="path")path=path.replace(new RegExp(`\\{${slot.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\}`,"g"),encodeURIComponent(String(value)));
  }
  if(/\{[^}]+\}/.test(path))throw new Error("p1_unbound_path_placeholder");
  const url=new URL(path,hypothesis.origin),query=new URLSearchParams(url.search);
  for(const [inputName,slotId] of Object.entries(hypothesis.input_bindings)){
    const slot=byId.get(slotId)!;if(slot.in==="query")query.set(slot.name,String(input[inputName]));
  }
  for(const [slotId,literalId] of Object.entries(hypothesis.literal_bindings)){
    const slot=byId.get(slotId);if(!slot||slot.in!=="query")throw new Error(`p1_invalid_literal_slot:${slotId}`);
    const literal=slot.literals.find(row=>row.id===literalId);if(!literal)throw new Error(`p1_unknown_literal:${literalId}`);
    query.set(slot.name,literal.value);
  }
  url.search=query.toString();return url.toString();
}
