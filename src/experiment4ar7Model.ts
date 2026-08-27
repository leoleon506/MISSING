import {createHash} from "node:crypto";

export const FOUR_AR7_BASE_SHA="aa661eb494a2d1bf4c50ee2987da518d8713ed09";
export const FOUR_AR7_FROZEN_RUN=33069961373;
export const FOUR_AR7_FROZEN_ARTIFACT=9646571570;
export const FOUR_AR7_FROZEN_DIGEST="sha256:b1780a752b6c0df096d5200d8e567e7c6225f8e7ff1371a345ad042651edf67f";
export const FOUR_AR7_FROZEN_REPORT_FP="6c553252de92ef6581e9e3084d872c8305b8dca72f0e5c8c9438f0614f706eb6";
export const FOUR_AR7_FROZEN_LEDGER_FP="fd680f36e3c225190cba967f1ff46b388192608583d27ab5264f354658e84641";
export const FOUR_AR7_MAX_FEASIBLE_OPERATIONS=12;

export const fourAr7Sha=(value:any)=>createHash("sha256")
  .update(typeof value==="string"?value:JSON.stringify(value))
  .digest("hex");

export type GraphNodeType=
  |"EVIDENCE"|"ORIGIN"|"OPERATION"|"INPUT_SLOT"|"OUTPUT_SLOT"|"LITERAL"
  |"TASK_INPUT"|"TASK_OUTPUT"|"IDENTIFIER_NAMESPACE";
export type GraphEdgeType=
  |"PROVES_ORIGIN"|"PROVES_OPERATION"|"OPERATION_CONSUMES"|"OPERATION_PRODUCES"
  |"PARAMETER_HAS_LITERAL"|"TASK_INPUT_CANDIDATE_FOR"|"OUTPUT_CANDIDATE_FOR"
  |"SAME_EVIDENCE_BLOCK"|"SAME_EXPLICIT_TEMPLATE_EXAMPLE"|"NAMESPACE_REQUIRES"|"NAMESPACE_PROVIDES";

export type R7GraphNode={id:string;type:GraphNodeType;label:string;data:Record<string,any>};
export type R7GraphEdge={id:string;type:GraphEdgeType;from:string;to:string;data?:Record<string,any>};

export type R7ParameterSlot={
  id:string;
  operation_id:string;
  name:string;
  in:"path"|"query";
  required:boolean;
  auth_like:boolean;
  literals:{id:string;value:string}[];
};

export type R7ResponseSlot={
  id:string;
  operation_id:string;
  path:string;
  leaf:string;
  tokens:string[];
};

export type R7Operation={
  id:string;
  origin:string;
  full_path:string;
  proof_type:string;
  evidence_ids:string[];
  source_urls:string[];
  parameter_slots:R7ParameterSlot[];
  response_slots:R7ResponseSlot[];
  request_offset:number|null;
  response_offset:number|null;
  response_join:"openapi"|"r6r_paired"|"r7_same_block"|"none";
  namespace:string|null;
  mechanical_score:number;
};

export type R7Feasibility={
  operation:R7Operation;
  feasible:boolean;
  reasons:string[];
  candidate_parameters_by_input:Record<string,string[]>;
  candidate_sources_by_output:Record<string,string[]>;
  deterministic_input_bindings:Record<string,string>;
  deterministic_output_bindings:Record<string,string>;
  deterministic_literal_bindings:Record<string,string>;
};

export type R7ProofGraph={
  nodes:R7GraphNode[];
  edges:R7GraphEdge[];
  operations:R7Operation[];
  feasibility:R7Feasibility[];
  feasible_operations:R7Feasibility[];
  infeasibility_reason_counts:Record<string,number>;
  node_counts:Record<string,number>;
  edge_counts:Record<string,number>;
  response_join_counts:Record<string,number>;
  fingerprint:string;
};

export type R7SemanticSelection={
  decision:"SELECT"|"REJECT";
  operation_id:string;
  input_bindings:{task_input:string;parameter_id:string}[];
  literal_bindings:{parameter_id:string;literal_id:string}[];
  output_bindings:{task_output:string;source_id:string}[];
  reason:string;
};
