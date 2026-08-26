import {createHash} from "node:crypto";

type RecipeLike={case_id?:string;spec_fingerprint?:string;recipe_fingerprint?:string;[key:string]:unknown};
type NegativeControlLike={control?:string;rejected?:boolean;evidence?:unknown;[key:string]:unknown};

export type VerifiedControl={
  control:string;
  executed:boolean;
  rejected:boolean;
  evidence:unknown;
  source:"core_3p2"|"active_3p2r";
};

const CORE_CONTROL_NAMES=[
  "unknown_operation",
  "undeclared_parameter",
  "non_get",
  "wrong_host",
  "missing_input_direct",
  "split_index_out_of_range",
  "schema_incompatible_typed_value",
  "unsupported_transform"
] as const;

function evidenceStrings(value:unknown):string[]{
  if(Array.isArray(value))return value.map(v=>String(v));
  if(value===null||value===undefined)return [];
  return [String(value)];
}

function evidenceShowsExecution(name:string,evidence:unknown):boolean{
  const values=evidenceStrings(evidence);
  if(!values.length)return false;
  if(name==="unknown_operation")return values.some(v=>v==="unknown_operation"||v.includes("unknown_operation"));
  if(name==="undeclared_parameter")return values.some(v=>v.includes("undeclared_parameter:"));
  if(name==="non_get")return values.some(v=>v==="non_get_method"||v.includes("non_get_method"));
  if(name==="wrong_host")return values.some(v=>v.includes("execution_host_not_allowed"));
  if(name==="missing_input_direct")return values.some(v=>v.includes("missing_input:"));
  if(name==="split_index_out_of_range")return values.some(v=>v.includes("split_index_out_of_range:"));
  if(name==="schema_incompatible_typed_value")return values.some(v=>v.includes("schema_type_number:")||v.includes("schema_type_integer:"));
  if(name==="unsupported_transform")return values.some(v=>v.includes("unsupported_transform:"));
  return false;
}

export function hasFingerprintEvidence(recipes:RecipeLike[]):boolean{
  return recipes.length>=2&&recipes.every(r=>Boolean(r.spec_fingerprint&&r.recipe_fingerprint));
}

export function verifyCoreControl(report:any,name:(typeof CORE_CONTROL_NAMES)[number]):VerifiedControl{
  const controls:Array<NegativeControlLike>=Array.isArray(report?.negative_controls)?report.negative_controls:[];
  const record=controls.find(c=>c.control===name);
  const executed=Boolean(record)&&evidenceShowsExecution(name,record?.evidence);
  return {
    control:name,
    executed,
    rejected:executed&&record?.rejected===true,
    evidence:record?.evidence??"missing_control_record",
    source:"core_3p2"
  };
}

export function runFingerprintControl(recipes:RecipeLike[]):VerifiedControl&{
  original_predicate:boolean;
  malformed_predicate:boolean;
  mutated_case_id:string|null;
  mutation:string;
  recipe_fingerprint_mutation_predicate:boolean|null;
  originals_unchanged:boolean;
}{
  const before=JSON.stringify(recipes);
  const originalPredicate=hasFingerprintEvidence(recipes);
  const malformed=recipes.map(r=>({...r}));
  let mutatedCaseId:string|null=null;
  let malformedPredicate=true;
  let recipeFingerprintMutationPredicate:boolean|null=null;
  if(malformed.length){
    mutatedCaseId=typeof malformed[0].case_id==="string"?malformed[0].case_id:null;
    malformed[0].spec_fingerprint="";
    malformedPredicate=hasFingerprintEvidence(malformed);

    const extra=recipes.map(r=>({...r}));
    extra[0].recipe_fingerprint="";
    recipeFingerprintMutationPredicate=hasFingerprintEvidence(extra);
  }
  const originalsUnchanged=before===JSON.stringify(recipes);
  const executed=malformed.length>0&&originalsUnchanged;
  const rejected=executed&&originalPredicate===true&&malformedPredicate===false;
  return {
    control:"empty_spec_fingerprint",
    executed,
    rejected,
    evidence:{original_predicate:originalPredicate,malformed_predicate:malformedPredicate,mutated_case_id:mutatedCaseId,mutation:"spec_fingerprint -> empty string",originals_unchanged:originalsUnchanged},
    source:"active_3p2r",
    original_predicate:originalPredicate,
    malformed_predicate:malformedPredicate,
    mutated_case_id:mutatedCaseId,
    mutation:"spec_fingerprint -> empty string",
    recipe_fingerprint_mutation_predicate:recipeFingerprintMutationPredicate,
    originals_unchanged:originalsUnchanged
  };
}

export function verifyAllControls(coreReport:any,recipes:RecipeLike[]):VerifiedControl[]{
  const core=CORE_CONTROL_NAMES.map(name=>verifyCoreControl(coreReport,name));
  const fingerprint=runFingerprintControl(recipes);
  const orderedNames=[
    "unknown_operation",
    "undeclared_parameter",
    "non_get",
    "wrong_host",
    "empty_spec_fingerprint",
    "missing_input_direct",
    "split_index_out_of_range",
    "schema_incompatible_typed_value",
    "unsupported_transform"
  ];
  const byName=new Map([...core,fingerprint].map(c=>[c.control,c]));
  return orderedNames.map(name=>byName.get(name)??({control:name,executed:false,rejected:false,evidence:"missing_control",source:"core_3p2"} as VerifiedControl));
}

export function recomputeCriteria(coreReport:any,recipes:RecipeLike[],controls:VerifiedControl[]){
  const m=coreReport?.metrics??{};
  const fingerprintsEvidence=hasFingerprintEvidence(recipes);
  const fingerprintControl=controls.find(c=>c.control==="empty_spec_fingerprint");
  const controlsVerified=controls.length===9&&controls.every(c=>c.executed&&c.rejected);
  return {
    all_three_specs_live:m.specs_fetched_and_parsed===3,
    zero_case_source_mappings:m.case_source_mapping_count===0,
    two_procured_cases:Number(m.procured_cases)>=2,
    two_live_providers:Number(m.distinct_live_providers)>=2,
    two_replay_recipes:Number(m.replay_successes)>=2,
    replay_success_rate:Number(m.persisted_recipes)>=2&&Number(m.replay_success_rate)===1,
    replay_planner_zero:m.replay_planner_calls===0,
    replay_procurement_zero:m.replay_procurement_calls===0,
    negative_controls_verified:controlsVerified,
    unknown_operations_zero:m.unknown_operations_accepted===0,
    undeclared_params_zero:m.undeclared_parameters_accepted===0,
    invalid_typed_bindings_zero:m.invalid_typed_bindings_accepted===0,
    unsupported_transforms_zero:m.unsupported_transforms_accepted===0,
    non_get_zero:m.non_get_accepted===0,
    host_policy_zero:m.host_policy_violations_accepted===0,
    redirects_zero:m.redirects_followed===0,
    credentials_zero:m.credentials_supplied===0,
    arbitrary_code_zero:m.arbitrary_code_executed===0,
    fingerprints_evidence:fingerprintsEvidence,
    active_empty_spec_fingerprint_rejected:fingerprintControl?.executed===true&&fingerprintControl?.rejected===true
  };
}

export function sha256(text:string):string{return createHash("sha256").update(text).digest("hex");}

export function buildVerifiedReport(coreReport:any,recipes:RecipeLike[],rawCoreReport:string,rawRecipes:string){
  const controls=verifyAllControls(coreReport,recipes);
  const criteria=recomputeCriteria(coreReport,recipes,controls);
  const decision=Object.values(criteria).every(Boolean)
    ?"GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED"
    :"REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED";
  const fingerprintControl=runFingerprintControl(recipes);
  return {
    experiment:"MISSING Experiment 3P2R — Verified Fingerprint-Control Replication",
    created_at:new Date().toISOString(),
    methodology:"Unchanged 3P2 core run plus independent active verification of frozen negative controls; no planner/live/replay repair.",
    core_experiment:coreReport?.experiment??null,
    core_decision_reported:coreReport?.decision??null,
    core_report_sha256:sha256(rawCoreReport),
    core_recipes_sha256:sha256(rawRecipes),
    metrics:{
      ...(coreReport?.metrics??{}),
      negative_controls_executed:controls.filter(c=>c.executed).length,
      negative_controls_verified:controls.filter(c=>c.executed&&c.rejected).length,
      persisted_recipe_fingerprints_nonempty:recipes.filter(r=>Boolean(r.spec_fingerprint&&r.recipe_fingerprint)).length
    },
    criteria,
    decision,
    verified_negative_controls:controls,
    fingerprint_control:fingerprintControl
  };
}
