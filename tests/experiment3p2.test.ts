import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const readme=readFileSync("experiments/3p2/README.md","utf8");
const code=readFileSync("src/experiment3p2.ts","utf8");
const casesBlock=code.slice(code.indexOf("const CASES="),code.indexOf("type CaseDef="));
const retrievalBlock=code.slice(code.indexOf("function operationScore"),code.indexOf("function exactKeys"));

describe("Experiment 3P2 preregistration",()=>{
  it("keeps the frozen 3P cases free of source and operation mappings",()=>{
    expect(readme).toContain("same candidate specification index, same three cases, same build/replay inputs");
    expect(casesBlock).not.toContain("required_provider");
    expect(casesBlock).not.toContain("required_source");
    expect(casesBlock).not.toContain("provider_id");
    expect(casesBlock).not.toContain("operation_path");
  });

  it("freezes the same core procurement and replay thresholds",()=>{
    expect(readme).toContain("at least 2 distinct providers reach deterministic static validation and live JSON execution");
    expect(readme).toContain("at least 2 persisted recipes replay successfully");
    expect(readme).toContain("planner calls during replay = 0");
    expect(readme).toContain("source procurement/spec-fetch calls during replay = 0");
    expect(readme).toContain("GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT");
  });

  it("uses generic contract-aware retrieval rather than provider-specific path bonuses",()=>{
    expect(code).toContain("response_properties");
    expect(code).toContain("operation_not_in_retrieved_candidates");
    expect(retrievalBlock).not.toContain("/repos/");
    expect(retrievalBlock).not.toContain("/points/");
    expect(retrievalBlock).not.toContain("monitoring-locations");
  });

  it("bounds typed binding compilation and exercises all nine controls",()=>{
    expect(code).toContain('type BindingKind="DIRECT"|"SPLIT"|"LITERAL"|"UNUSED"');
    expect(code).toContain("split_index_out_of_range");
    expect(code).toContain("invalid_typed_bindings_accepted");
    expect(code).toContain("unsupported_transforms_accepted");
    for(const control of ["unknown_operation","undeclared_parameter","non_get","wrong_host","empty_spec_fingerprint","missing_input_direct","split_index_out_of_range","schema_incompatible_typed_value","unsupported_transform"]){
      expect(code).toContain(`control:\"${control}\"`);
    }
    expect(readme).toContain("all nine frozen negative controls are rejected");
  });
});
