import {describe,expect,it} from "vitest";
import {buildVerifiedReport,hasFingerprintEvidence,runFingerprintControl,verifyAllControls} from "../src/experiment3p2rVerifier.js";

function recipes(){return [
  {case_id:"a",spec_fingerprint:"spec-a",recipe_fingerprint:"recipe-a"},
  {case_id:"b",spec_fingerprint:"spec-b",recipe_fingerprint:"recipe-b"}
];}

function coreReport(){return {
  experiment:"MISSING Experiment 3P2 — Contract-Aware Retrieval + Typed Binding Compiler",
  decision:"GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT",
  metrics:{
    specs_fetched_and_parsed:3,
    case_source_mapping_count:0,
    procured_cases:3,
    distinct_live_providers:3,
    replay_successes:3,
    persisted_recipes:3,
    replay_success_rate:1,
    replay_planner_calls:0,
    replay_procurement_calls:0,
    unknown_operations_accepted:0,
    undeclared_parameters_accepted:0,
    invalid_typed_bindings_accepted:0,
    unsupported_transforms_accepted:0,
    non_get_accepted:0,
    host_policy_violations_accepted:0,
    redirects_followed:0,
    credentials_supplied:0,
    arbitrary_code_executed:0
  },
  negative_controls:[
    {control:"unknown_operation",rejected:true,evidence:["unknown_operation"]},
    {control:"undeclared_parameter",rejected:true,evidence:["undeclared_parameter:x"]},
    {control:"non_get",rejected:true,evidence:["non_get_method"]},
    {control:"wrong_host",rejected:true,evidence:"Error: execution_host_not_allowed"},
    {control:"empty_spec_fingerprint",rejected:true,evidence:"synthetic legacy record must be ignored"},
    {control:"missing_input_direct",rejected:true,evidence:["missing_input:foo"]},
    {control:"split_index_out_of_range",rejected:true,evidence:["split_index_out_of_range:foo"]},
    {control:"schema_incompatible_typed_value",rejected:true,evidence:["schema_type_number:foo"]},
    {control:"unsupported_transform",rejected:true,evidence:["unsupported_transform:foo"]}
  ]
};}

describe("3P2R fingerprint evidence",()=>{
  it("requires at least two fully fingerprinted recipes",()=>{
    expect(hasFingerprintEvidence(recipes())).toBe(true);
    expect(hasFingerprintEvidence([recipes()[0]])).toBe(false);
    const malformed=recipes();malformed[0].spec_fingerprint="";
    expect(hasFingerprintEvidence(malformed)).toBe(false);
  });

  it("actively mutates spec_fingerprint and leaves originals unchanged",()=>{
    const original=recipes();
    const before=JSON.stringify(original);
    const control=runFingerprintControl(original);
    expect(control.executed).toBe(true);
    expect(control.rejected).toBe(true);
    expect(control.original_predicate).toBe(true);
    expect(control.malformed_predicate).toBe(false);
    expect(control.recipe_fingerprint_mutation_predicate).toBe(false);
    expect(control.mutation).toBe("spec_fingerprint -> empty string");
    expect(JSON.stringify(original)).toBe(before);
  });

  it("does not accept the legacy synthetic fingerprint control as execution evidence",()=>{
    const controls=verifyAllControls(coreReport(),recipes());
    const fingerprint=controls.find(c=>c.control==="empty_spec_fingerprint");
    expect(fingerprint?.source).toBe("active_3p2r");
    expect(fingerprint?.executed).toBe(true);
    expect(fingerprint?.rejected).toBe(true);
    expect(controls).toHaveLength(9);
    expect(controls.every(c=>c.executed&&c.rejected)).toBe(true);
  });

  it("recomputes GO only when the active control and frozen core thresholds pass",()=>{
    const core=coreReport(),r=recipes();
    const verified=buildVerifiedReport(core,r,JSON.stringify(core),JSON.stringify(r));
    expect(verified.decision).toBe("GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED");
    expect(verified.metrics.negative_controls_executed).toBe(9);
    expect(verified.metrics.negative_controls_verified).toBe(9);
    expect(verified.criteria.active_empty_spec_fingerprint_rejected).toBe(true);

    const broken=recipes();broken[0].spec_fingerprint="";
    const reassess=buildVerifiedReport(core,broken,JSON.stringify(core),JSON.stringify(broken));
    expect(reassess.decision).toBe("REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED");
  });

  it("fails verification when a core control lacks execution evidence",()=>{
    const core=coreReport();
    const record=core.negative_controls.find(c=>c.control==="undeclared_parameter")!;
    record.evidence=[];
    const verified=buildVerifiedReport(core,recipes(),JSON.stringify(core),JSON.stringify(recipes()));
    expect(verified.criteria.negative_controls_verified).toBe(false);
    expect(verified.decision).toBe("REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED");
  });
});
