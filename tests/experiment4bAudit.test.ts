import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {auditProviderBlindSource} from "../src/experiment4ar3Core.js";
import {deriveExperiment4bSource} from "../src/experiment4bDerivation.js";

describe("4B source integrity",()=>{
  const activePaths=[
    "../src/experiment4ap1Core.ts",
    "../src/experiment4bDerivation.ts",
    "../src/experiment4bPlanner.ts",
    "../src/experiment4bRequest.ts",
    "../src/experiment4ap1Probe.ts",
    "../src/experiment4ap1Model.ts",
    "../src/experiment4ar6rEvidence.ts",
    "../src/experiment4ar6rModel.ts",
    "../src/experiment4ar5Reranker.ts",
    "../src/experiment4ap1Contract.ts"
  ];

  it("passes provider-blind audit over every active 4B runtime module",async()=>{
    const sources=await Promise.all(activePaths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    const audit=auditProviderBlindSource(sources);
    expect(audit.providerAssignment).toBe(false);
    expect(audit.caseProviderMap).toBe(false);
    expect(audit.clean).toBe(true);
  });

  it("contains no historical provider, domain, endpoint, or R4 recovery seeds in 4B modules",async()=>{
    const sources=await Promise.all(["../src/experiment4bRequest.ts","../src/experiment4bPlanner.ts","../src/experiment4bDerivation.ts"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    for(const source of sources){
      expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|artic\.edu|nhtsa|registry\.npmjs|ziptastic|themealdb/i);
      expect(source).not.toMatch(/search\.php\?s=|objects\/\{objectID\}|api\/v2\/product\/\{barcode\}|decodevin/i);
    }
  });

  it("planner exposes only stable request and observed-field IDs, never numeric-index request authoring",async()=>{
    const planner=await readFile(new URL("../src/experiment4bPlanner.ts",import.meta.url),"utf8");
    expect(planner).not.toMatch(/operation_index|parameter_index|response_path_index|literal_index/);
    expect(planner).not.toMatch(/path_template:\{type|base_url:\{type|query_bindings:\{type/);
    expect(planner).toContain("hypothesis_id");
    expect(planner).toContain("source_id");
  });

  it("generated runner audits the 4B request graph and generator and enforces provenance gate",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),generated=deriveExperiment4bSource(base);
    expect(generated).toContain("experiment4bDerivation.ts");
    expect(generated).toContain("experiment4bRequest.ts");
    expect(generated).toContain("experiment4bPlanner.ts");
    expect(generated).toContain("experiment4ap1Probe.ts");
    expect(generated).toContain("provenance_integrity:documentationOriginFallbacks===0");
    expect(generated).toContain("auditProviderBlindSource([coreSource,plannerSource,contractSource]).clean");
  });
});
