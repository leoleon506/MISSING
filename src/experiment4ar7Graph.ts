import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {extractOperationInventoryR6R} from "./experiment4ar6rEvidence.js";
import type {R6ROperation} from "./experiment4ar6rModel.js";
import {
  FOUR_AR7_MAX_FEASIBLE_OPERATIONS,
  fourAr7Sha,
  type R7Feasibility,
  type R7GraphEdge,
  type R7GraphNode,
  type R7Operation,
  type R7ParameterSlot,
  type R7ProofGraph,
  type R7ResponseSlot
} from "./experiment4ar7Model.js";

const AUTH_LIKE=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;

function decodeHtml(text:string){
  return text
    .replace(/&quot;|&#34;|&#x22;/gi,'"')
    .replace(/&#39;|&apos;|&#x27;/gi,"'")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">");
}

function stripTags(text:string){return decodeHtml(text).replace(/<[^>]+>/g," ").trim();}

export function lexicalTokensR7(value:string){
  return [...new Set(value
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g,"$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token=>token.endsWith("ies")&&token.length>4?`${token.slice(0,-3)}y`:token.endsWith("s")&&token.length>3?token.slice(0,-1):token)
    .filter(token=>token.length>=2))];
}

function overlap(a:string,b:string){
  const left=new Set(lexicalTokensR7(a)),right=new Set(lexicalTokensR7(b));
  let count=0;
  for(const token of left)if(right.has(token))count++;
  return count;
}

function leaf(path:string){return path.split(".").filter(Boolean).at(-1)||path;}

function echoCompatible(output:string,input:string){
  const out=lexicalTokensR7(output),inp=new Set(lexicalTokensR7(input));
  if(!out.length)return false;
  return out.every(token=>inp.has(token));
}

function jsonPaths(value:any,prefix="",depth=0):string[]{
  if(depth>7||value===null||value===undefined)return [];
  const out:string[]=[];
  if(Array.isArray(value)){
    if(value.length){const p=prefix?`${prefix}.0`:"0";out.push(p,...jsonPaths(value[0],p,depth+1));}
  }else if(typeof value==="object"){
    for(const [key,child] of Object.entries(value)){
      const p=prefix?`${prefix}.${key}`:key;
      out.push(p,...jsonPaths(child,p,depth+1));
    }
  }
  return [...new Set(out)];
}

type StructuredBlock={start:number;end:number;text:string;paths:string[];request_like:boolean};

function parseJsonCandidate(raw:string){
  const text=stripTags(raw).trim();
  const attempts=[text];
  const firstObj=text.indexOf("{"),lastObj=text.lastIndexOf("}");
  if(firstObj>=0&&lastObj>firstObj)attempts.push(text.slice(firstObj,lastObj+1));
  const firstArr=text.indexOf("["),lastArr=text.lastIndexOf("]");
  if(firstArr>=0&&lastArr>firstArr)attempts.push(text.slice(firstArr,lastArr+1));
  for(const candidate of attempts){
    try{return jsonPaths(JSON.parse(candidate));}catch{}
  }
  return [];
}

function structuredBlocks(text0:string){
  const text=decodeHtml(text0),out:StructuredBlock[]=[];
  const regexes=[/```[\w-]*\s*([\s\S]*?)```/gi,/<pre[^>]*>([\s\S]*?)<\/pre>/gi,/<code[^>]*>([\s\S]*?)<\/code>/gi];
  for(const regex of regexes){
    for(const match of text.matchAll(regex)){
      const body=stripTags(match[1]);
      out.push({
        start:match.index??0,
        end:(match.index??0)+match[0].length,
        text:body,
        paths:parseJsonCandidate(body),
        request_like:/(?:^|\s)(?:GET|curl)\s+|https:\/\/|\/[A-Za-z0-9_.~:-]+(?:\/|\?|\{|\[)/i.test(body)
      });
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}

function joinedResponsePaths(operation:R6ROperation,evidence:DocEvidence[]){
  if(operation.response_paths.length)return {paths:operation.response_paths,join:operation.proof_type==="openapi"?"openapi" as const:"r6r_paired" as const};
  if(operation.request_offset===null)return {paths:[] as string[],join:"none" as const};
  for(const evidenceId of operation.evidence_ids){
    const item=evidence.find(value=>value.evidence_id===evidenceId&&value.state==="ok");
    if(!item)continue;
    const blocks=structuredBlocks(item.text);
    const start=operation.request_offset;
    const nextRequest=blocks.find(block=>block.start>start+20&&block.request_like)?.start??Infinity;
    const candidates=blocks.filter(block=>block.paths.length&&block.start>=start&&block.start<nextRequest&&block.start-start<=5000);
    if(candidates.length){
      candidates.sort((a,b)=>(a.start-start)-(b.start-start));
      return {paths:candidates[0].paths,join:"r7_same_block" as const};
    }
  }
  return {paths:[] as string[],join:"none" as const};
}

function responseSlots(operationId:string,paths:string[],required:string[]){
  const scored=paths.map(path=>({path,score:Math.max(...required.map(output=>overlap(output,leaf(path))),0)*100-Math.min(40,path.split(".").length)}));
  scored.sort((a,b)=>b.score-a.score||a.path.length-b.path.length||a.path.localeCompare(b.path));
  return scored.slice(0,48).map(({path}):R7ResponseSlot=>({
    id:`fld_${fourAr7Sha({operationId,path}).slice(0,14)}`,
    operation_id:operationId,
    path,
    leaf:leaf(path),
    tokens:lexicalTokensR7(leaf(path))
  }));
}

function parameterSlots(operationId:string,operation:R6ROperation):R7ParameterSlot[]{
  return [...operation.path_parameters,...operation.query_parameters].map(parameter=>({
    id:`par_${fourAr7Sha({operationId,name:parameter.name,in:parameter.in}).slice(0,14)}`,
    operation_id:operationId,
    name:parameter.name,
    in:parameter.in,
    required:parameter.required,
    auth_like:AUTH_LIKE.test(parameter.name),
    literals:parameter.literals.map(value=>({id:`lit_${fourAr7Sha({operationId,name:parameter.name,value}).slice(0,14)}`,value}))
  }));
}

function deriveNamespace(operation:R6ROperation,evidence:DocEvidence[]){
  const parameterNames=[...operation.path_parameters,...operation.query_parameters].map(value=>value.name).filter(name=>/(?:^|[_-])id$|identifier|accession|vin|isbn|doi|iata|barcode/i.test(name));
  if(!parameterNames.length)return null;
  const texts=operation.evidence_ids.map(id=>evidence.find(item=>item.evidence_id===id)?.text||"").join(" ");
  for(const name of parameterNames){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const match=texts.match(new RegExp(`(?:${escaped}|identifier)[^\\n.]{0,80}(?:for|of)\\s+([A-Za-z][A-Za-z0-9 _-]{2,40})`,"i"));
    if(match)return match[1].trim().toLowerCase().replace(/\s+/g,"_");
  }
  return null;
}

function operationFromR6R(operation:R6ROperation,evidence:DocEvidence[],required:string[]):R7Operation{
  const id=`op_${fourAr7Sha({origin:operation.origin,path:operation.full_path,e:operation.evidence_ids}).slice(0,16)}`;
  const joined=joinedResponsePaths(operation,evidence);
  return {
    id,
    origin:operation.origin,
    full_path:operation.full_path,
    proof_type:operation.proof_type,
    evidence_ids:[...operation.evidence_ids],
    source_urls:[...operation.source_urls],
    parameter_slots:parameterSlots(id,operation),
    response_slots:responseSlots(id,joined.paths,required),
    request_offset:operation.request_offset,
    response_offset:operation.response_offset,
    response_join:joined.join,
    namespace:deriveNamespace(operation,evidence),
    mechanical_score:0
  };
}

function feasibility(operation:R7Operation,inputNames:string[],required:string[]):R7Feasibility{
  const reasons:string[]=[];
  const assignable=operation.parameter_slots.filter(slot=>!slot.auth_like);
  const requiredParams=operation.parameter_slots.filter(slot=>slot.required);
  const credentialRequired=requiredParams.filter(slot=>slot.auth_like);
  if(credentialRequired.length)reasons.push("required_auth_parameter");
  if(inputNames.length&&!assignable.length)reasons.push("no_input_influence_path");
  if(assignable.length<inputNames.length)reasons.push("insufficient_request_slots_for_inputs");
  const requiredWithoutLiteral=requiredParams.filter(slot=>!slot.auth_like&&!slot.literals.length);
  if(requiredWithoutLiteral.length>inputNames.length)reasons.push("too_many_required_unbound_parameters");

  const candidateParametersByInput:Record<string,string[]>={};
  const deterministicInputBindings:Record<string,string>={};
  for(const input of inputNames){
    const ranked=assignable.map(slot=>({slot,score:overlap(input,slot.name)})).sort((a,b)=>b.score-a.score||Number(b.slot.in==="path")-Number(a.slot.in==="path")||a.slot.name.localeCompare(b.slot.name));
    const positive=ranked.filter(row=>row.score>0);
    const candidates=(positive.length?positive:ranked).slice(0,12).map(row=>row.slot.id);
    candidateParametersByInput[input]=candidates;
    if(positive.length===1)deterministicInputBindings[input]=positive[0].slot.id;
  }

  const deterministicLiteralBindings:Record<string,string>={};
  for(const slot of requiredParams){
    if(slot.auth_like)continue;
    if(slot.literals.length===1)deterministicLiteralBindings[slot.id]=slot.literals[0].id;
  }

  const candidateSourcesByOutput:Record<string,string[]>={};
  const deterministicOutputBindings:Record<string,string>={};
  for(const output of required){
    const echoes=inputNames.filter(input=>echoCompatible(output,input)).map(input=>`TASK_INPUT:${input}`);
    const fields=operation.response_slots
      .map(slot=>({slot,score:overlap(output,slot.leaf)}))
      .sort((a,b)=>b.score-a.score||a.slot.path.length-b.slot.path.length)
      .slice(0,24);
    const positive=fields.filter(row=>row.score>0);
    const sources=[...echoes,...(positive.length?positive:fields).map(row=>row.slot.id)];
    candidateSourcesByOutput[output]=[...new Set(sources)];
    if(echoes.length===1&&positive.length===0)deterministicOutputBindings[output]=echoes[0];
    else if(echoes.length===0&&positive.length===1)deterministicOutputBindings[output]=positive[0].slot.id;
    if(!sources.length)reasons.push(`no_output_source:${output}`);
  }

  const nonEchoOutputs=required.filter(output=>!inputNames.some(input=>echoCompatible(output,input)));
  if(nonEchoOutputs.length&&!operation.response_slots.length)reasons.push("no_proven_response_fields");
  const uniqueSourceUniverse=new Set(required.flatMap(output=>candidateSourcesByOutput[output]||[]));
  if(uniqueSourceUniverse.size<required.length)reasons.push("insufficient_unique_output_sources");

  let score=0;
  for(const input of inputNames)score+=Math.max(0,...assignable.map(slot=>overlap(input,slot.name)))*30;
  for(const output of required)score+=Math.max(0,...operation.response_slots.map(slot=>overlap(output,slot.leaf)))*35;
  score+=operation.proof_type==="openapi"?80:operation.response_join==="r7_same_block"?65:operation.response_join==="r6r_paired"?55:15;
  score+=operation.response_slots.length?25:-25;
  score-=Math.max(0,assignable.length-inputNames.length)*2;
  operation.mechanical_score=score;

  return {
    operation,
    feasible:reasons.length===0,
    reasons:[...new Set(reasons)],
    candidate_parameters_by_input:candidateParametersByInput,
    candidate_sources_by_output:candidateSourcesByOutput,
    deterministic_input_bindings:deterministicInputBindings,
    deterministic_output_bindings:deterministicOutputBindings,
    deterministic_literal_bindings:deterministicLiteralBindings
  };
}

function bump(map:Record<string,number>,key:string){map[key]=(map[key]||0)+1;}

export function buildProofGraphR7(evidence:DocEvidence[],caseId:string):R7ProofGraph{
  const c=FOUR_A_CASES.find(value=>value.case_id===caseId);
  if(!c)throw new Error(`r7_unknown_case:${caseId}`);
  const inventory=extractOperationInventoryR6R(evidence,caseId);
  const operations=inventory.inventory.map(operation=>operationFromR6R(operation,evidence,[...c.required]));
  const feasibilityRows=operations.map(operation=>feasibility(operation,[...c.input_names],[...c.required]));
  const feasible=feasibilityRows.filter(row=>row.feasible).sort((a,b)=>b.operation.mechanical_score-a.operation.mechanical_score||a.operation.id.localeCompare(b.operation.id)).slice(0,FOUR_AR7_MAX_FEASIBLE_OPERATIONS);

  const nodes:R7GraphNode[]=[],edges:R7GraphEdge[]=[];
  const addNode=(node:R7GraphNode)=>{if(!nodes.some(x=>x.id===node.id))nodes.push(node);};
  const addEdge=(type:R7GraphEdge["type"],from:string,to:string,data?:Record<string,any>)=>edges.push({id:`edge_${fourAr7Sha({type,from,to,data}).slice(0,16)}`,type,from,to,data});

  for(const input of c.input_names)addNode({id:`task_in_${input}`,type:"TASK_INPUT",label:input,data:{}});
  for(const output of c.required)addNode({id:`task_out_${output}`,type:"TASK_OUTPUT",label:output,data:{}});
  for(const operation of operations){
    const originId=`origin_${fourAr7Sha(operation.origin).slice(0,14)}`;
    addNode({id:originId,type:"ORIGIN",label:operation.origin,data:{}});
    addNode({id:operation.id,type:"OPERATION",label:operation.full_path,data:{proof_type:operation.proof_type,response_join:operation.response_join,score:operation.mechanical_score}});
    addEdge("PROVES_ORIGIN",originId,operation.id);
    for(const evidenceId of operation.evidence_ids){
      const item=evidence.find(x=>x.evidence_id===evidenceId);
      addNode({id:`evidence_${evidenceId}`,type:"EVIDENCE",label:evidenceId,data:{source_url:item?.resolved_url??null}});
      addEdge("PROVES_OPERATION",`evidence_${evidenceId}`,operation.id);
    }
    for(const slot of operation.parameter_slots){
      addNode({id:slot.id,type:"INPUT_SLOT",label:slot.name,data:{in:slot.in,required:slot.required,auth_like:slot.auth_like}});
      addEdge("OPERATION_CONSUMES",operation.id,slot.id);
      for(const literal of slot.literals){
        addNode({id:literal.id,type:"LITERAL",label:literal.value,data:{}});
        addEdge("PARAMETER_HAS_LITERAL",slot.id,literal.id);
      }
    }
    for(const field of operation.response_slots){
      addNode({id:field.id,type:"OUTPUT_SLOT",label:field.path,data:{leaf:field.leaf}});
      addEdge("OPERATION_PRODUCES",operation.id,field.id);
    }
    if(operation.namespace){
      const nsId=`ns_${fourAr7Sha(operation.namespace).slice(0,14)}`;
      addNode({id:nsId,type:"IDENTIFIER_NAMESPACE",label:operation.namespace,data:{}});
      addEdge("NAMESPACE_REQUIRES",operation.id,nsId);
    }
  }

  for(const row of feasibilityRows){
    for(const [input,ids] of Object.entries(row.candidate_parameters_by_input))for(const id of ids)addEdge("TASK_INPUT_CANDIDATE_FOR",`task_in_${input}`,id);
    for(const [output,ids] of Object.entries(row.candidate_sources_by_output))for(const id of ids.filter(x=>!x.startsWith("TASK_INPUT:")))addEdge("OUTPUT_CANDIDATE_FOR",id,`task_out_${output}`);
  }

  const infeasibilityReasonCounts:Record<string,number>={},nodeCounts:Record<string,number>={},edgeCounts:Record<string,number>={},responseJoinCounts:Record<string,number>={};
  for(const row of feasibilityRows.filter(x=>!x.feasible))for(const reason of row.reasons)bump(infeasibilityReasonCounts,reason);
  for(const node of nodes)bump(nodeCounts,node.type);
  for(const edge of edges)bump(edgeCounts,edge.type);
  for(const operation of operations)bump(responseJoinCounts,operation.response_join);
  const graphWithoutFp={nodes,edges,operations,feasibility:feasibilityRows,feasible_operations:feasible,infeasibility_reason_counts:infeasibilityReasonCounts,node_counts:nodeCounts,edge_counts:edgeCounts,response_join_counts:responseJoinCounts};
  return {...graphWithoutFp,fingerprint:fourAr7Sha(graphWithoutFp)};
}
