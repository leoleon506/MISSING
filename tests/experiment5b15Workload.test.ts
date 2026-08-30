import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {recomputeFiveB15WorkloadFingerprints} from "../src/experiment5b15Harness.js";

describe("Experiment 5B15 frozen replay workload",()=>{
 const workload=JSON.parse(readFileSync("experiments/5b15/frozen-5b14-replay-workload.json","utf8"));
 it("contains exactly the seven consumed 5B14 recipes",()=>{expect(workload.recipes).toHaveLength(7);expect(new Set(workload.recipes.map((r:any)=>r.recipe_fingerprint)).size).toBe(7)});
 it("matches the post-prereg frozen fingerprints",()=>{const fp=recomputeFiveB15WorkloadFingerprints(workload);expect(fp.recipe_fingerprint_set_fingerprint).toBe("05ea0e575d00da1a5846df2d6efa78515796a688bfecf86f85a9175f180911c7");expect(fp.changed_input_workload_fingerprint).toBe("562e0a754b29e72a9077a79eecf59bb9988628bbaf2c0256857882fd17b0b857");expect(fp.recipe_fingerprint_set_fingerprint).toBe(workload.recipe_fingerprint_set_fingerprint);expect(fp.changed_input_workload_fingerprint).toBe(workload.changed_input_workload_fingerprint)});
 it("keeps the observed failing dictionary replay and documentary TVMaze replay unchanged",()=>{const dictionary=workload.recipes.find((r:any)=>r.case_id==="english_word_definition_metadata"),documentary=workload.recipes.find((r:any)=>r.documentary_witness_5b12);expect(dictionary.changed_input).toEqual({word:"world"});expect(documentary.case_id).toBe("television_show_metadata");expect(documentary.changed_input).toEqual({show_name:"Severance"});expect(documentary.documentary_witness_5b12.beam_position).toBe(2)});
});
