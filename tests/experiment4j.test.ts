import {describe,it,expect} from "vitest";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import type {P1RequestHypothesis} from "../src/experiment4ap1Model.js";
import {prepareRequestGraph4J} from "../src/experiment4jRequest.js";
import {deriveExperiment4jSource} from "../src/experiment4jDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string)=>({evidence_id:"ev1",provider_candidate_id:"synthetic",requested_url:"https://docs.example.test/reference",resolved_url:"https://docs.example.test/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok"} as any);
describe("4J variable role and entity compatibility",()=>{
 it("rejects book operation for character task",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Books</h2><p>Get a book by id</p><code>GET https://api.example.test/books/{id}</code>')],"fictional_character_metadata",new RecoveryLedger());expect(g.hypotheses.some((h:P1RequestHypothesis)=>h.full_path.includes("/books/"))).toBe(false)});
 it("accepts character generic id with character context",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Characters</h2><p>Get a fictional character by id</p><code>GET https://api.example.test/characters/{id}</code>')],"fictional_character_metadata",new RecoveryLedger());expect(g.hypotheses.some((h:P1RequestHypothesis)=>h.full_path.includes("/characters/{id}"))).toBe(true)});
 it("accepts VIN placeholder without build-value example",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Vehicle VIN Decoder</h2><p>Decode a vehicle identification number.</p><code>GET https://api.example.test/vehicles/decode/{vin}</code>')],"vin_vehicle_metadata",new RecoveryLedger());expect(g.hypotheses.some((h:P1RequestHypothesis)=>h.full_path.includes("{vin}"))).toBe(true)});
 it("accepts contextual product code",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Product lookup</h2><p>Lookup retail food product information by code.</p><code>GET https://api.example.test/products/{code}</code>')],"food_barcode_metadata",new RecoveryLedger());expect(g.hypotheses.some((h:P1RequestHypothesis)=>h.full_path.includes("{code}"))).toBe(true)});
 it("keeps auth-like requests out of packet",async()=>{const g=await prepareRequestGraph4J([ev('<h2>Product lookup</h2><code>GET https://api.example.test/products/{code}?api_key={key}</code>')],"food_barcode_metadata",new RecoveryLedger());expect(g.metrics.authLikeRenderedRequests).toBe(0);expect(g.probe_packet.every((h:P1RequestHypothesis)=>!h.full_path.includes("api_key"))).toBe(true)});
 it("derives exact 4J base and decision",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4jSource(src);expect(out).toContain("GO_4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY");expect(out).toContain('base_sha:"008af94c9f6fb6e8f63b8c40616ede0bbcbc3988"')});
});
