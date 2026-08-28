import type {P1ProbeProof} from "./experiment4ap1Model.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import {uniqueRowLookup4O,validateRowLookupObserved4O,type RelationalSummary4O} from "./experiment4oRelational.js";
import {materialize4P} from "./experiment4pCore.js";
import {identityCompatible4Q} from "./experiment4qPreference.js";

export function allowedInputSources4Q(output:string,inputs:readonly string[]){return inputs.filter(input=>identityCompatible4Q(output,input))}

export function deterministicProjection4Q(proof:P1ProbeProof,summary:RelationalSummary4O|null,inputs:readonly string[],required:readonly string[]){
  (proof as any).relational_summary=summary;
  const projection:ProjectionPlan={},used=new Set<string>();let rowLookups=0,identityInputs=0;
  for(const output of required){
    const inputMatches=allowedInputSources4Q(output,inputs);
    if(inputMatches.length===1){projection[output]={op:"INPUT",name:inputMatches[0]} as any;identityInputs++;continue}
    const outTokens=new Set(output.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)),fieldMatches=proof.record.observed_fields.filter(f=>(f.tokens||[]).some(t=>outTokens.has(t))&&!used.has(f.id));
    if(fieldMatches.length===1){used.add(fieldMatches[0].id);projection[output]={op:"FIELD",path:fieldMatches[0].path} as any;continue}
    const row=summary?uniqueRowLookup4O(summary,output):null;
    if(row&&validateRowLookupObserved4O(row.expr,summary!)){projection[output]=row.expr as any;rowLookups++;continue}
    return null;
  }
  return {projection,rowLookups,identityInputs};
}

export function materialize4Q(caseId:string,providerId:string,proof:P1ProbeProof,projection:ProjectionPlan,summary:RelationalSummary4O|null=null){
  const m=materialize4P(caseId,providerId,proof,projection,summary);
  m.raw.reason=String(m.raw.reason||"").replace(/^4P_PROJECTION_COMPATIBILITY:/,"4Q_EVIDENCE_PREFERENCE_IDENTITY:");
  return m;
}
