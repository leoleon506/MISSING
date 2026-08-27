import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {auditProviderBlindSource} from "../src/experiment4ar3Core.js";
import {deriveExperiment4ar6rSource} from "../src/experiment4ar6rDerivation.js";

describe("4A-R6R split compiler audit",()=>{
  it("includes evidence and model modules in the generated source audit",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const generated=deriveExperiment4ar6rSource(base);
    expect(generated).toContain("experiment4ar6rEvidence.ts");
    expect(generated).toContain("experiment4ar6rModel.ts");
    expect(generated).toContain("GO_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY");
    expect(generated).toContain('base_sha:"f5c34c8598698ad9ee9e2cff856a298b7dd00690"');
  });

  it("contains no known provider or workload-specific path seeds in split compiler modules",async()=>{
    const paths=[
      "../src/experiment4ar6rCore.ts",
      "../src/experiment4ar6rEvidence.ts",
      "../src/experiment4ar6rModel.ts",
      "../src/experiment4ar6rPlanner.ts",
      "../src/experiment4ar6rDerivation.ts"
    ];
    const sources=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    for(const source of sources){
      expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|artic\.edu|nhtsa|registry\.npmjs|ziptastic|themealdb/i);
    }
    const evidence=sources[1];
    expect(evidence).not.toMatch(/artworks\?|vehicles\?|meals\?|drinks\?|packages\?|products\?/i);
  });

  it("passes the exact provider-blind source audit used by the benchmark",async()=>{
    const paths=[
      "../src/experiment4ar6rCore.ts",
      "../src/experiment4ar6rRuntime.ts",
      "../src/experiment4ar6rPlanner.ts",
      "../src/experiment4ar6rEvidence.ts",
      "../src/experiment4ar6rModel.ts",
      "../src/experiment4ar5Reranker.ts",
      "../src/experiment4ar6rContract.ts"
    ];
    const sources=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    const audit=auditProviderBlindSource(sources);
    expect(audit.providerAssignment).toBe(false);
    expect(audit.caseProviderMap).toBe(false);
    expect(audit.clean).toBe(true);
  });
});
