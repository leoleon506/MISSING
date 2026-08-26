import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {BROAD_TOP_K,RERANK_TOP_K,broadRetrieve,plannerVisibleCandidates,relevantOperation,resolveSelected,validateRerankObject} from "../src/experiment3vCore.js";
import {runNegativeControls} from "../src/experiment3vControls.js";

const readme=readFileSync("experiments/3v/README.md","utf8"),runner=readFileSync("src/experiment3v.ts","utf8");
describe("Experiment 3V",()=>{
  it("freezes top80 to opaque top12 semantic retrieval",()=>{expect(BROAD_TOP_K).toBe(80);expect(RERANK_TOP_K).toBe(12);expect(readme).toContain("top **80** entries per case");expect(readme).toContain("at most **12 opaque candidate IDs**");});
  it("bounds broad retrieval at eighty providers",()=>{const c:any={case_id:"x",intent:"metadata",input_names:["id"],required_output_leaf_names:["name"]};const md=["### Data",...Array.from({length:100},(_,i)=>`| [API${i}](https://api${i}.example/docs) | metadata name id | No | Yes | Yes |`)].join("\n");expect(broadRetrieve(c,md)).toHaveLength(80);});
  it("hides provider URLs from reranker",()=>{const c:any={case_id:"x",intent:"currency metadata",input_names:["currency_id"],required_output_leaf_names:["code","name"]};const md="### Finance\n| [Money](https://money.example/docs) | Currency metadata | No | Yes | Yes |";const broad=broadRetrieve(c,md);const visible:any=plannerVisibleCandidates(broad)[0];expect(visible).toBeTruthy();expect(visible.link).toBeUndefined();expect(visible.url).toBeUndefined();});
  it("rejects unknown duplicates extras too many and wrong case identity",()=>{const broad:any[]=[{candidate_id:"p1"},{candidate_id:"p2"}];expect(validateRerankObject({case_id:"x",selected:[{candidate_id:"x",reason:""}]},broad,"x").error).toContain("unknown_candidate_id");expect(validateRerankObject({case_id:"x",selected:[{candidate_id:"p1",reason:""},{candidate_id:"p1",reason:""}]},broad,"x").error).toContain("duplicate_candidate_id");expect(validateRerankObject({case_id:"x",selected:[],url:"https://x"},broad,"x").error).toContain("extra:url");expect(validateRerankObject({case_id:"wrong",selected:[]},broad,"x").error).toContain("case_id_mismatch");});
  it("resolves only selected broad candidates",()=>{const broad:any[]=[{candidate_id:"a",name:"A"},{candidate_id:"b",name:"B"}];expect(resolveSelected({case_id:"x",selected:[{candidate_id:"b",reason:"fit"}]},broad)[0].name).toBe("B");});
  it("requires both input and output evidence",()=>{expect(relevantOperation({method:"GET",input_hits:1,output_hits:1})).toBe(true);expect(relevantOperation({method:"GET",input_hits:0,output_hits:1})).toBe(false);expect(relevantOperation({method:"GET",input_hits:1,output_hits:0})).toBe(false);});
  it("executes all eighteen negative controls",async()=>{const controls=await runNegativeControls();expect(controls).toHaveLength(18);expect(controls.every(x=>x.executed&&x.rejected)).toBe(true);});
  it("contains no frozen provider rescue strings",()=>{for(const s of ["dnd5eapi","openfintech","api.github.com","frankfurter"])expect(runner.toLowerCase()).not.toContain(s);expect(readme).toContain("GO_SEMANTIC_PROVIDER_RETRIEVAL");});
});
