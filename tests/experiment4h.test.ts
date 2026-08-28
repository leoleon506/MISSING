import {describe,expect,it} from "vitest";
import {prepareRequestGraph4H} from "../src/experiment4hRequest.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4hSource} from "../src/experiment4hDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string,extra:any={})=>({evidence_id:extra.evidence_id||"ev1",provider_candidate_id:"synthetic",requested_url:"https://docs.example.test/reference",resolved_url:"https://docs.example.test/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok",...extra} as any);

describe("4H task-operation alignment",()=>{
  it("retains package morphology with metadata context",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Package metadata API endpoint</h2><code>GET https://api.example.test/package/{package}</code>')],"npm_package_metadata",new RecoveryLedger());expect(g.hypotheses.length).toBeGreaterThan(0)});
  it("rejects unrelated generic id",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Webhook endpoint</h2><code>GET https://api.example.test/webhooks/{id}</code>')],"chemical_element_metadata",new RecoveryLedger());expect(g.probe_packet).toHaveLength(0)});
  it("accepts barcode-like product code only with product support",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Product metadata lookup API</h2><code>GET https://api.example.test/products/{barcode}</code>')],"food_barcode_metadata",new RecoveryLedger());expect(g.hypotheses.length).toBeGreaterThan(0)});
  it("accepts VIN influence with vehicle/decode context",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Vehicle VIN decode API</h2><code>GET https://api.example.test/vehicles/decode/{vin}</code>')],"vin_vehicle_metadata",new RecoveryLedger());expect(g.hypotheses.length).toBeGreaterThan(0)});
  it("prunes optional auth slot before render",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Age estimate API</h2>Anonymous requests are supported; API keys increase rate limits.<code>GET https://api.example.test/age?name=michael&key=optional</code>')],"age_estimate_by_name",new RecoveryLedger());expect(g.metrics.knownAuthProbeAttempts).toBe(0);expect(g.metrics.authLikeRenderedRequests).toBe(0)});
  it("required auth blocks",async()=>{const g=await prepareRequestGraph4H([ev('<h2>Age estimate API</h2>API key required.<code>GET https://api.example.test/age?name=michael&key=123</code>')],"age_estimate_by_name",new RecoveryLedger());expect(g.probe_packet).toHaveLength(0)});
});

describe("4H benchmark derivation",()=>{it("uses frozen base and decision names",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4hSource(src);expect(out).toContain('GO_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT');expect(out).toContain('base_sha:"547e72a94345b978cc64fdb18c3330736742a927"');expect(out).toContain('alignmentAccepted');expect(out).toContain('optionalAuthSlotsPruned')})});
