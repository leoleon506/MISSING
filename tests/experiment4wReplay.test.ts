import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import {sha4u} from "../src/experiment4uOpenApi.js";
import {verifySchemaRoleWitnessReplayBody4W} from "../src/experiment4wReplay.js";
import {deriveExperiment4wSource} from "../src/experiment4wDerivation.js";

function witness(path="0.sub"){const mappings=[{output_role:"country_name",candidate_id:"field_1",schema_path:"sub",observed_path:path,confidence:.95,evidence_fields:["sub"]}];return {spec_fingerprint:"s",operation_pointer:"#/paths/x/get",response_schema_fingerprint:"r",mappings,semantic_evidence_fingerprint:"e",resolver_output_fingerprint:sha4u(mappings)}}

describe("Experiment 4W frozen schema witness replay",()=>{
  it("accepts a frozen observed path that still exists in replay body",()=>{expect(verifySchemaRoleWitnessReplayBody4W(witness(),[{sub:"Country"}])).toBe(true)});
  it("rejects replay when the frozen observed path disappears",()=>{expect(verifySchemaRoleWitnessReplayBody4W(witness(),[{other:"Country"}])).toBe(false)});
  it("rejects a mutated frozen witness fingerprint",()=>{const w=witness();w.mappings[0].observed_path="0.other";expect(verifySchemaRoleWitnessReplayBody4W(w,[{other:"Country"}])).toBe(false)});
  it("persists the witness into recipes and verifies it without replay LLM calls",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4wSource(src);expect(out).toContain("schema_role_witness_4w:syn.schema_role_witness_4w??null");expect(out).toContain("verifySchemaRoleWitnessReplayBody4W(recipe.schema_role_witness_4w,got.body)");expect(out).toContain("schemaRoleResolverReplayLlmCalls4w=0")});
});
