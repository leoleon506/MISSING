import {describe,expect,it} from "vitest";
import {FIVE_B20_PUBLIC_APIS_COMMIT,FIVE_B20_WORKLOAD_FINGERPRINT,frozenCandidatesForCase5b20,loadFiveB20Workload,recomputeFiveB20WorkloadFingerprint,workloadShapeValid5b20} from "../src/experiment5b20Workload.js";

describe("Experiment 5B20 frozen selected-provider workload",()=>{
 it("locks the same seven capabilities and twenty-one providers",()=>{const w=loadFiveB20Workload();expect(workloadShapeValid5b20(w)).toBe(true);expect(w.primaries).toHaveLength(7);expect(w.candidates).toHaveLength(21);expect(new Set(w.candidates.map(x=>x.candidate_id)).size).toBe(21)});
 it("preserves the 5B19 workload fingerprint and catalog snapshot",()=>{const w=loadFiveB20Workload();expect(w.public_apis_snapshot.commit).toBe(FIVE_B20_PUBLIC_APIS_COMMIT);expect(w.workload_fingerprint).toBe(FIVE_B20_WORKLOAD_FINGERPRINT);expect(recomputeFiveB20WorkloadFingerprint(w)).toBe(FIVE_B20_WORKLOAD_FINGERPRINT)});
 it("preserves frozen provider order within each capability",()=>{const w=loadFiveB20Workload();for(const p of w.primaries){const rows=frozenCandidatesForCase5b20(w.candidates,p.case_id);expect(rows.map(x=>x.selected_position)).toEqual([...rows].map(x=>x.selected_position).sort((a,b)=>a-b))}});
 it("retains exactly one unhealthy primary with four frozen candidates",()=>{const w=loadFiveB20Workload(),u=w.primaries.filter(x=>x.unhealthy_after_5b15);expect(u).toHaveLength(1);expect(frozenCandidatesForCase5b20(w.candidates,u[0].case_id)).toHaveLength(4)});
});
