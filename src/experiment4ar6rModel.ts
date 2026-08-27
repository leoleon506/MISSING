import {createHash} from "node:crypto";

export const FOUR_AR6R_BASE_SHA="f5c34c8598698ad9ee9e2cff856a298b7dd00690";
export const FOUR_AR6R_FROZEN_RUN=33038630313;
export const FOUR_AR6R_FROZEN_ARTIFACT=9633749547;
export const FOUR_AR6R_FROZEN_DIGEST="sha256:bf9b49a2b17cff695b676c50d2f733242cd93c834c257d46f5ec70e7bb576302";
export const FOUR_AR6R_FROZEN_REPORT_FP="9402d2488cfc71e83bc9c80595bf42ebe1937007e1f679dce3d0de08f06f2df6";
export const FOUR_AR6R_FROZEN_LEDGER_FP="518a95d6f53dbbd819783609b0224737b289291415d4a82fc2d73655acd819ef";
export const FOUR_AR6R_MAX_INVENTORY=80;
export const FOUR_AR6R_MAX_PACKET=12;

export const fourAr6rSha=(value:any)=>createHash("sha256")
  .update(typeof value==="string"?value:JSON.stringify(value))
  .digest("hex");

export type R6RParam={
  name:string;
  in:"path"|"query";
  required:boolean;
  literals:string[];
};

export type R6ROperation={
  operation_id:string;
  origin:string;
  base_path:string;
  operation_path:string;
  full_path:string;
  method:"GET";
  path_parameters:R6RParam[];
  query_parameters:R6RParam[];
  response_paths:string[];
  evidence_ids:string[];
  source_urls:string[];
  proof_type:"openapi"|"endpoint_json_example"|"endpoint_template";
  score:number;
  api_confidence:number;
  request_offset:number|null;
  response_offset:number|null;
};

export type R6ROperationFacts=Omit<R6ROperation,"operation_id"|"score">;

export type EndpointReject={
  evidence_id:string;
  raw:string;
  offset:number;
  reason:string;
};

export type R6RInventory={
  raw_candidate_count:number;
  accepted_candidate_count:number;
  rejected_candidate_count:number;
  rejects:EndpointReject[];
  inventory:R6ROperation[];
  packet:R6ROperation[];
  inventory_fingerprint:string;
  packet_fingerprint:string;
};

export type R6RStageA={
  decision:"SELECT"|"REJECT";
  operation_index:number;
  reason:string;
};

export type R6RStageB={
  path_bindings:{parameter_index:number;input_name:string}[];
  query_bindings:{
    parameter_index:number;
    source_kind:"INPUT"|"LITERAL"|"OMIT";
    input_name:string|null;
    literal_index:number|null;
  }[];
  output_mappings:{
    output_name:string;
    source_kind:"FIELD"|"INPUT";
    response_path_index:number|null;
    input_name:string|null;
  }[];
  reason:string;
};

export function operationFacts(op:R6ROperation):R6ROperationFacts{
  const {operation_id:_operationId,score:_score,...facts}=op;
  return facts;
}
