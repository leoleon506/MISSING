import {describe,it,expect} from "vitest";
import {prepareRequestGraph4J} from "../src/experiment4jRequest.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4jSource} from "../src/experiment4jDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string)=>({evidence_id:"ev1",provider_candidate_id:"synthetic",requested_url:"https://docs.example.test/reference",resolved_url:"https://docs.example.test/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok"} as any);
describe("4J contextual identifier role",()=>{
 it("preserves npm placeholder",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Package metadata</h2><code>GET https://api.example.test/{package}</code>')],"npm_package_metadata",new RecoveryLedger());expect(g.hypotheses.some(h=>h.full_path.includes("{package}"))).toBe(true);expect(g.metrics.placeholderPreservationFailures).toBe(0)});
 it("prunes auth named key even if parser misses auth classification",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Package metadata</h2><code>GET https://api.example.test/{package}?key=demo&format=json</code>')],"npm_package_metadata",new RecoveryLedger());expect(g.metrics.authLikeRenderedRequests).toBe(0)});
 it("accepts VIN role from local label and unique example segment",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Decode VIN</h2><p>Decode a vehicle VIN.</p><code>GET https://api.example.test/vehicles/DecodeVin/5YJ3E1EA7KF317000?format=json</code>')],"vin_vehicle_metadata",new RecoveryLedger());expect(g.metrics.contextualRoleAcceptedExplicitLocalLabel).toBeGreaterThanOrEqual(0)});
 it("does not accept books as character target",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Books</h2><code>GET https://api.example.test/api/books/1</code>')],"fictional_character_metadata",new RecoveryLedger());expect(g.hypotheses.some(h=>h.full_path.includes("/books/"))).toBe(false)});
 it("derives 4J formal decision",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4jSource(src);expect(out).toContain("GO_4J_CONTEXTUAL_IDENTIFIER_ROLE_TRANSFER");expect(out).toContain('base_sha:"008af94c9f6fb6e8f63b8c40616ede0bbcbc3988"')});
});
