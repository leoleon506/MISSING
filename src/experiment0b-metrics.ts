import type { CaseResult } from "./types.js";

const ratio=(n:number,d:number)=>d?n/d:0;
const boundaryIds=new Set([
  "external-registry-requires-1",
  "external-market-requires-1",
  "external-status-requires-1"
]);

function missingToolName(result:CaseResult){
  return result.missing_tool_name || "resolve_missing_capability";
}

export function secondaryRecoveryRate(results:CaseResult[]){
  const required=results.filter(r=>r.condition==="missing"&&r.ground_truth==="requires_missing");
  const opportunities=required.filter(r=>r.first_selected_tool!==missingToolName(r));
  const recovered=opportunities.filter(r=>r.whether_missing_was_called).length;
  return ratio(recovered,opportunities.length);
}

export function coverageBoundarySuccessRate(results:CaseResult[]){
  const boundary=results.filter(r=>r.condition==="missing"&&boundaryIds.has(r.case_id));
  return ratio(boundary.filter(r=>r.whether_missing_was_called).length,boundary.length);
}
