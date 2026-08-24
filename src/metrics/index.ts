import type { CaseResult, Metrics } from "../types.js";
const ratio=(n:number,d:number)=>d?n/d:0;
export function calculateMetrics(results: CaseResult[]): Metrics {
  const required=results.filter(r=>r.ground_truth==="requires_missing"), solvable=results.filter(r=>r.ground_truth==="solvable_without_missing");
  const missingRequired=required.filter(r=>r.whether_missing_was_called).length, missingSolvable=solvable.filter(r=>r.whether_missing_was_called).length;
  const allMissing=missingRequired+missingSolvable;
  return {cases:results.length,requires_missing:required.length,solvable_without_missing:solvable.length,
    fallback_selection_rate:ratio(missingRequired,required.length),false_positive_rate:ratio(missingSolvable,solvable.length),give_up_rate:ratio(required.length-missingRequired,required.length),
    correct_tool_rate:ratio(solvable.filter(r=>!!r.expected_tool&&r.selected_tools.includes(r.expected_tool)).length,solvable.length),precision_missing:allMissing?missingRequired/allMissing:null};
}
