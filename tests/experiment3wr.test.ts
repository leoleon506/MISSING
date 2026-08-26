import {describe,expect,it} from "vitest";
import {decideFrontier,enforceCrawlDepth,enforcePageBudget,enforceReplayBudget,frontierScore,isDocumentContentType,staticAssetUrl} from "../src/experiment3wrCore.js";
import {normalizeReject} from "../src/experiment3wrPlanner.js";
import {validateDocumentationRedirect} from "../src/experiment3wrNetwork.js";

const p:any={case_id:"currency_metadata",candidate_id:"p",name:"X",start_url:"https://docs.example.com"};
describe("experiment 3W-R",()=>{
 it("does not rank hostname keywords",()=>{expect(frontierScore("https://currencyfreaks.com/assets/logo","logo").score).toBe(0);});
 it("rejects static assets before frontier",()=>{expect(staticAssetUrl("https://x.test/a/logo.webp")).toBe(true);expect(decideFrontier("e","https://x.test/a/app.js","API docs").accepted).toBe(false);});
 it("accepts documentation content types",()=>{expect(isDocumentContentType("text/html; charset=utf-8")).toBe(true);expect(isDocumentContentType("image/png")).toBe(false);});
 it("uses production depth and budget guards",()=>{expect(()=>enforceCrawlDepth(3)).toThrow();expect(()=>enforcePageBudget(8)).toThrow();});
 it("uses production replay budget guard",()=>{expect(()=>enforceReplayBudget({documentation_fetches:1,synthesis_calls:0})).toThrow();expect(enforceReplayBudget({documentation_fetches:0,synthesis_calls:0})).toBe(true);});
 it("normalizes reject without endpoint claims",()=>{const r=normalizeReject({case_id:p.case_id,provider_candidate_id:p.candidate_id,decision:"REJECT",reason:"insufficient",base_url:"https://invented.test",path_template:"/x"},p);expect(r.changed).toBe(true);expect(r.normalized).toEqual({case_id:p.case_id,provider_candidate_id:p.candidate_id,decision:"REJECT",reason:"insufficient"});});
 it("allows one same-scope safe documentation redirect and rejects cross-domain",()=>{expect(validateDocumentationRedirect(p,"https://docs.example.com","https://docs.example.com/reference",[])).toContain("reference");expect(()=>validateDocumentationRedirect(p,"https://docs.example.com","https://evil.example.net/docs",[])).toThrow();});
});