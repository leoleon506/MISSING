import {describe,expect,it} from "vitest";
import {FIVE_B18_PUBLIC_APIS_COMMIT,FIVE_B18_WORKLOAD_FINGERPRINT,frozenCandidatesForCase5b18,loadFiveB18Workload,recomputeFiveB18WorkloadFingerprint,workloadShapeValid5b18} from "../src/experiment5b18Workload.js";

describe("Experiment 5B18 frozen selected-provider workload",()=>{
 it("locks seven capabilities and exactly twenty-one 5B17 selections",()=>{const w=loadFiveB18Workload();expect(workloadShapeValid5b18(w)).toBe(true);expect(w.primaries).toHaveLength(7);expect(w.candidates).toHaveLength(21);expect(new Set(w.candidates.map(x=>x.candidate_id)).size).toBe(21)});
 it("locks snapshot and workload fingerprint",()=>{const w=loadFiveB18Workload();expect(w.public_apis_snapshot.commit).toBe(FIVE_B18_PUBLIC_APIS_COMMIT);expect(w.workload_fingerprint).toBe(FIVE_B18_WORKLOAD_FINGERPRINT);expect(recomputeFiveB18WorkloadFingerprint(w)).toBe(FIVE_B18_WORKLOAD_FINGERPRINT)});
 it("preserves selected-position ordering within each capability",()=>{const w=loadFiveB18Workload();for(const p of w.primaries){const rows=frozenCandidatesForCase5b18(w.candidates,p.case_id);expect(rows.map(x=>x.selected_position)).toEqual([...rows].map(x=>x.selected_position).sort((a,b)=>a-b))}});
 it("contains the frozen unhealthy primary and its four dictionary selections",()=>{const w=loadFiveB18Workload(),u=w.primaries.filter(x=>x.unhealthy_after_5b15);expect(u).toHaveLength(1);expect(frozenCandidatesForCase5b18(w.candidates,u[0].case_id)).toHaveLength(4)});
});
