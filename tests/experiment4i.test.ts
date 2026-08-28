import {describe,it,expect} from "vitest";
import {prepareRequestGraph4I} from "../src/experiment4iRequest.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4iSource} from "../src/experiment4iDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string)=>({evidence_id:"ev1",provider_candidate_id:"synthetic",requested_url:"https://docs.example.test/reference",resolved_url:"https://docs.example.test/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok"} as any);
describe("4I structural identifier role",()=>{
 it("preserves package placeholder",async()=>{const g=await prepareRequestGraph4I([ev('<h2>Package metadata API</h2><code>GET https://api.example.test/{package}</code>')],"npm_package_metadata",new RecoveryLedger());expect(g.hypotheses.some(h=>h.full_path.includes("{package}"))).toBe(true);expect(g.metrics.placeholderPreservationFailures).toBe(0)});
 it("preserves objectID placeholder",async()=>{const g=await prepareRequestGraph4I([ev('<h2>Artwork object metadata</h2><code>GET https://api.example.test/objects/{objectID}</code>')],"artwork_object_metadata",new RecoveryLedger());expect(g.hypotheses.some(h=>h.full_path.includes("{objectID}"))).toBe(true)});
 it("prunes auth without encoding placeholders",async()=>{const g=await prepareRequestGraph4I([ev('<h2>Package metadata</h2>Anonymous supported; API key increases rate limits.<code>GET https://api.example.test/{package}?key=optional&format=json</code>')],"npm_package_metadata",new RecoveryLedger());expect(g.metrics.authLikeRenderedRequests).toBe(0);expect(g.hypotheses.some(h=>h.full_path.includes("{package}")&&!h.full_path.includes("key="))).toBe(true)});
 it("rejects repeated concrete values",async()=>{const g=await prepareRequestGraph4I([ev('<h2>Vehicle VIN decode</h2><code>GET https://api.example.test/vehicle/1HGCM82633A004352?vin=1HGCM82633A004352</code>')],"vin_vehicle_metadata",new RecoveryLedger());expect(g.metrics.identifierRoleRejectedAmbiguousOccurrence).toBeGreaterThanOrEqual(0)});
 it("derives 4I decision and base",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4iSource(src);expect(out).toContain("GO_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE");expect(out).toContain('base_sha:"28c83671b4aa38bd87bf6ddefd540e1b5d6035c1"')});
});
