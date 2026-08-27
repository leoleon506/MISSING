import {createHash} from "node:crypto";

export const FOUR_AP1_BASE_SHA="c152a2370ec3640f85e54f435980208f934baef8";
export const FOUR_AP1_FROZEN_RUN=33077407071;
export const FOUR_AP1_FROZEN_ARTIFACT=9650003904;
export const FOUR_AP1_FROZEN_DIGEST="sha256:c2406e85e2cba0a5b909266b788d6125260ea8e3d41159d4cf76083bb004a8a9";
export const FOUR_AP1_FROZEN_REPORT_FP="7245bbeffce545eefa33b0b8e54cac46c0749fa37ff4e7b4d4ceeb82655dbeb8";
export const FOUR_AP1_FROZEN_LEDGER_FP="4951327d1aeea30fae590350c1fbd762d07952364733297d07246c1800d805b4";
export const FOUR_AP1_MAX_PROBES_PER_PROVIDER=3;
export const FOUR_AP1_MAX_OBSERVED_FIELDS=80;

export const fourAp1Sha=(value:any)=>createHash("sha256")
  .update(typeof value==="string"?value:JSON.stringify(value))
  .digest("hex");

export type P1RequestSlot={
  id:string;
  name:string;
  in:"path"|"query";
  required:boolean;
  auth_like:boolean;
  literals:{id:string;value:string}[];
};

export type P1RequestHypothesis={
  id:string;
  source_operation_id:string;
  origin:string;
  full_path:string;
  proof_type:string;
  evidence_ids:string[];
  source_urls:string[];
  slots:P1RequestSlot[];
  input_bindings:Record<string,string>;
  literal_bindings:Record<string,string>;
  score:number;
  concrete_relation:boolean;
};

export type P1ObservedField={
  id:string;
  path:string;
  leaf:string;
  tokens:string[];
  sample_type:string;
  sample_value:string|null;
  build_value_relations:string[];
};

export type P1ProbeRecord={
  hypothesis_id:string;
  disposition:"success"|"rejected";
  requested_url:string;
  requested_at:string;
  final_url:string|null;
  content_type:string|null;
  response_body_fingerprint:string|null;
  schema_fingerprint:string|null;
  observed_fields:P1ObservedField[];
  observed_path_count:number;
  bytes:number;
  error:string|null;
};

export type P1ProbeProof={
  hypothesis:P1RequestHypothesis;
  record:P1ProbeRecord;
};

export type P1SemanticSelection={
  decision:"SELECT"|"REJECT";
  hypothesis_id:string;
  output_bindings:{task_output:string;source_id:string}[];
  reason:string;
};
