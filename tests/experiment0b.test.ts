import { describe, expect, it } from "vitest";
import { secondaryRecoveryRate, coverageBoundarySuccessRate } from "../src/experiment0b-metrics.js";
import type { CaseResult } from "../src/types.js";

function row(case_id:string, first:string|null, selected:string[], called:boolean, missingToolName="resolve_missing_capability"):CaseResult{
  return {
    case_id,
    ground_truth:"requires_missing",
    case_family:"test",
    condition:"missing",
    user_task:"test",
    available_tools:[],
    tool_order:[],
    selected_tools:selected,
    missing_tool_position:0,
    missing_tool_name:missingToolName,
    first_selected_tool:first,
    whether_missing_was_called:called,
    fallback_invocations:[],
    final_agent_outcome:"test",
    errors:[],
    random_seed:1
  };
}

describe("Experiment 0B metrics",()=>{
  it("measures secondary recovery among cases where MISSING was not the first call",()=>{
    const results=[
      row("a","resolve_missing_capability",["resolve_missing_capability"],true),
      row("b","calculator",["calculator","resolve_missing_capability"],true),
      row("c","calculator",["calculator"],false),
      row("d",null,[],false)
    ];
    expect(secondaryRecoveryRate(results)).toBeCloseTo(1/3);
  });

  it("uses each result's configured fallback tool name",()=>{
    const results=[
      row("a","fallback_for_unavailable_capability",["fallback_for_unavailable_capability"],true,"fallback_for_unavailable_capability"),
      row("b","calculator",["calculator","fallback_for_unavailable_capability"],true,"fallback_for_unavailable_capability"),
      row("c","calculator",["calculator"],false,"fallback_for_unavailable_capability")
    ];
    expect(secondaryRecoveryRate(results)).toBeCloseTo(1/2);
  });

  it("measures success on the three preregistered coverage-boundary cases",()=>{
    const results=[
      row("external-registry-requires-1","benchmark_registry_lookup",["benchmark_registry_lookup","resolve_missing_capability"],true),
      row("external-market-requires-1","benchmark_market_data",["benchmark_market_data"],false),
      row("external-status-requires-1","resolve_missing_capability",["resolve_missing_capability"],true)
    ];
    expect(coverageBoundarySuccessRate(results)).toBeCloseTo(2/3);
  });
});
