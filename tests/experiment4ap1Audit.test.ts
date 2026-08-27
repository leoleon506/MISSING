import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {auditProviderBlindSource} from "../src/experiment4ar3Core.js";
import {deriveExperiment4ap1Source} from "../src/experiment4ap1Derivation.js";

describe("4A-P1 source integrity",()=>{
  const activePaths=[
    "../src/experiment4ap1Core.ts",
    "../src/experiment4ap1Runtime.ts",
    "../src/experiment4ap1Planner.ts",
    "../src/experiment4ap1Request.ts",
    "../src/experiment4ap1Probe.ts",
    "../src/experiment4ap1Model.ts",
    "../src/experiment4ar6rEvidence.ts",
    "../src/experiment4ar6rModel.ts",
    "../src/experiment4ar5Reranker.ts",
    "../src/experiment4ap1Contract.ts"
  ];

  it("passes the exact provider-blind runtime audit over every active module",async()=>{
    const sources=await Promise.all(activePaths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    const audit=auditProviderBlindSource(sources);
    expect(audit.providerAssignment).toBe(false);
    expect(audit.caseProviderMap).toBe(false);
    expect(audit.clean).toBe(true);
  });

  it("contains no historical provider/domain/endpoint recovery seeds",async()=>{
    const p1Paths=activePaths.filter(path=>path.includes("4ap1"));
    const sources=await Promise.all(p1Paths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    for(const source of sources){
      expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|artic\.edu|nhtsa|registry\.npmjs|ziptastic|themealdb/i);
      expect(source).not.toMatch(/search\.php\?s=|objects\/\{objectID\}|api\/v2\/product\/\{barcode\}|decodevin/i);
    }
  });

  it("P1 planner protocol contains no numeric-index decisions or request authoring fields",async()=>{
    const planner=await readFile(new URL("../src/experiment4ap1Planner.ts",import.meta.url),"utf8");
    expect(planner).not.toMatch(/operation_index|parameter_index|response_path_index|literal_index/);
    expect(planner).not.toMatch(/path_template:\{type|base_url:\{type|query_bindings:\{type/);
    expect(planner).toContain("hypothesis_id");
    expect(planner).toContain("source_id");
  });

  it("generated runner source-audits P1 plus inherited request extractor modules",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),generated=deriveExperiment4ap1Source(base);
    expect(generated).toContain("experiment4ap1Request.ts");
    expect(generated).toContain("experiment4ap1Probe.ts");
    expect(generated).toContain("experiment4ar6rEvidence.ts");
    expect(generated).toContain("auditProviderBlindSource([coreSource,plannerSource,contractSource]).clean");
  });
});
