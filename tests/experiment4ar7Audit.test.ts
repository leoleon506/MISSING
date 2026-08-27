import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {auditProviderBlindSource} from "../src/experiment4ar3Core.js";
import {deriveExperiment4ar7Source} from "../src/experiment4ar7Derivation.js";

describe("4A-R7 source integrity",()=>{
  it("passes the exact runtime provider-blind audit over all active R7 and inherited evidence modules",async()=>{
    const paths=[
      "../src/experiment4ar7Core.ts",
      "../src/experiment4ar7Runtime.ts",
      "../src/experiment4ar7Planner.ts",
      "../src/experiment4ar7Graph.ts",
      "../src/experiment4ar7Model.ts",
      "../src/experiment4ar6rEvidence.ts",
      "../src/experiment4ar6rModel.ts",
      "../src/experiment4ar5Reranker.ts",
      "../src/experiment4ar7Contract.ts"
    ];
    const sources=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    const audit=auditProviderBlindSource(sources);
    expect(audit.providerAssignment).toBe(false);
    expect(audit.caseProviderMap).toBe(false);
    expect(audit.clean).toBe(true);
  });

  it("contains no known historical provider/domain/endpoint recovery seeds",async()=>{
    const paths=[
      "../src/experiment4ar7Core.ts",
      "../src/experiment4ar7Planner.ts",
      "../src/experiment4ar7Graph.ts",
      "../src/experiment4ar7Model.ts",
      "../src/experiment4ar7Derivation.ts",
      "../src/experiment4ar7Contract.ts"
    ];
    const sources=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    for(const source of sources){
      expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|artic\.edu|nhtsa|registry\.npmjs|ziptastic|themealdb/i);
      expect(source).not.toMatch(/search\.php\?s=|objects\/\{objectID\}|api\/v2\/product\/\{barcode\}/i);
    }
  });

  it("generated runner audits R7 graph plus inherited R6R evidence compiler",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const generated=deriveExperiment4ar7Source(base);
    expect(generated).toContain("experiment4ar7Graph.ts");
    expect(generated).toContain("experiment4ar7Model.ts");
    expect(generated).toContain("experiment4ar6rEvidence.ts");
    expect(generated).toContain("experiment4ar6rModel.ts");
  });
});
