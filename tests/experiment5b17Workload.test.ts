import {describe,expect,it} from "vitest";
import {FIVE_B17_PUBLIC_APIS_COMMIT,FIVE_B17_WORKLOAD_FINGERPRINT,loadFiveB17Workload,recomputeFiveB17WorkloadFingerprint,workloadShapeValid5b17} from "../src/experiment5b17Workload.js";

describe("Experiment 5B17 frozen capability workload",()=>{
 it("contains exactly the seven consumed primary capabilities",()=>{const w=loadFiveB17Workload();expect(workloadShapeValid5b17(w)).toBe(true);expect(w.primaries).toHaveLength(7);expect(new Set(w.primaries.map(x=>x.case_id)).size).toBe(7);expect(w.unhealthy_primary_recipe_fingerprints).toHaveLength(1)});
 it("locks the frozen catalog snapshot and workload fingerprint",()=>{const w=loadFiveB17Workload();expect(w.public_apis_snapshot.commit).toBe(FIVE_B17_PUBLIC_APIS_COMMIT);expect(w.workload_fingerprint).toBe(FIVE_B17_WORKLOAD_FINGERPRINT);expect(recomputeFiveB17WorkloadFingerprint(w)).toBe(FIVE_B17_WORKLOAD_FINGERPRINT)});
 it("derives unhealthy status only from the frozen workload",()=>{const w=loadFiveB17Workload(),unhealthy=w.primaries.filter(x=>x.unhealthy_after_5b15);expect(unhealthy).toHaveLength(1);expect(w.unhealthy_primary_recipe_fingerprints).toEqual(unhealthy.map(x=>x.primary_recipe_fingerprint))});
});
