import {describe,expect,it} from "vitest";
import {buildReservedRecoveryQueue5B18,FIVE_B18_ORDINARY_FETCH_LIMIT,FIVE_B18_RESERVED_RECOVERY_LIMIT,FIVE_B18_TOTAL_FETCH_LIMIT,RESERVED_STANDARD_PATHS_5B18,reservedRecoveryOrderingDeterminism5B18} from "../src/experiment5b18Recovery.js";

const provider:any={case_id:"synthetic_case",candidate_id:"candidate",name:"Synthetic",start_url:"https://docs.example.test/start"};

describe("Experiment 5B18 reserved executable-surface recovery",()=>{
 it("freezes the 4+4 allocation without increasing the total budget",()=>{expect(FIVE_B18_ORDINARY_FETCH_LIMIT).toBe(4);expect(FIVE_B18_RESERVED_RECOVERY_LIMIT).toBe(4);expect(FIVE_B18_TOTAL_FETCH_LIMIT).toBe(8);expect(FIVE_B18_ORDINARY_FETCH_LIMIT+FIVE_B18_RESERVED_RECOVERY_LIMIT).toBe(FIVE_B18_TOTAL_FETCH_LIMIT)});
 it("uses exactly the five preregistered fixed machine-contract paths",()=>{expect(RESERVED_STANDARD_PATHS_5B18).toEqual(["/openapi.json","/swagger.json","/api/openapi.json","/v3/api-docs","/.well-known/openapi.json"])});
 it("builds a deterministic standard recovery queue when ordinary evidence has no links",()=>{const a=buildReservedRecoveryQueue5B18([],provider,new Set(),new Map()),b=buildReservedRecoveryQueue5B18([],provider,new Set(),new Map());expect(a.queue).toHaveLength(5);expect(a.fingerprint).toBe(b.fingerprint);expect(a.queue).toEqual(b.queue);expect(reservedRecoveryOrderingDeterminism5B18([],provider,new Set(),new Map()).ok).toBe(true)});
 it("does not re-add already fetched fixed paths",()=>{const seen=new Set(["https://docs.example.test/openapi.json"]),q=buildReservedRecoveryQueue5B18([],provider,seen,new Map());expect(q.queue.some(x=>x.target_url==="https://docs.example.test/openapi.json")).toBe(false);expect(q.queue).toHaveLength(4)});
});
