import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {buildRequestGraph4B} from "../src/experiment4bRequest.js";
import {deriveExperiment4bSource} from "../src/experiment4bDerivation.js";

function evidence(text:string,url="https://docs.example.test/reference",id="p-e01"):any{return {evidence_id:id,provider_candidate_id:"p",requested_url:url,resolved_url:url,verified_at:"2026-01-01T00:00:00Z",status:200,content_type:"text/html",body_fingerprint:"x",text,state:"ok"};}

describe("4B provenance request graph",()=>{
  it("uses the API origin from an absolute documented request rather than the documentation origin",()=>{
    const result=buildRequestGraph4B([evidence('API request: GET https://api.example.test/estimate?name={name}')],"age_estimate_by_name");
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.hypotheses[0].origin).toBe("https://api.example.test");
    expect(result.hypotheses[0].origin).not.toBe("https://docs.example.test");
    expect(result.metrics.documentationOriginFallbacks).toBe(0);
  });

  it("does not join a relative path to an unrelated documentation host",()=>{
    const result=buildRequestGraph4B([evidence('GET /estimate?name={name}')],"age_estimate_by_name");
    expect(result.hypotheses.some(h=>h.origin==="https://docs.example.test")).toBe(false);
    expect(result.metrics.documentationOriginFallbacks).toBe(0);
  });

  it("generalizes an exact documented build-value path segment only with nearby input evidence",()=>{
    const result=buildRequestGraph4B([evidence('Lookup by name. Example request https://api.example.test/person/michael')],"age_estimate_by_name");
    expect(result.hypotheses.some(h=>h.origin==="https://api.example.test"&&h.full_path.includes("{name}"))).toBe(true);
  });

  it("does not bind a single input to an unrelated descriptive query slot",()=>{
    const result=buildRequestGraph4B([evidence('GET https://api.example.test/vehicles?make=Honda')],"vin_vehicle_metadata");
    expect(result.hypotheses).toHaveLength(0);
  });

  it("derives a runner with provenance metrics and exact P1 parent",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),generated=deriveExperiment4bSource(base);
    expect(generated).toContain('const OUT="results/experiment-4b"');
    expect(generated).toContain("synthesize4b as synthesize4ar");
    expect(generated).toContain("requestGraphNodes");
    expect(generated).toContain("documentationOriginFallbacks");
    expect(generated).toContain("GO_4B_PROVENANCE_REQUEST_GRAPH");
    expect(generated).toContain('base_sha:"08cf59875690709990a20ff93f31a8e72c0891a9"');
  });
});
