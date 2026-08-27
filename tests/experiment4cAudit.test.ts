import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {auditProviderBlindSource} from "../src/experiment4ar3Core.js";
import {deriveExperiment4cSource} from "../src/experiment4cDerivation.js";

describe("4C source integrity",()=>{const active=["../src/experiment4ap1Core.ts","../src/experiment4ap1Probe.ts","../src/experiment4ap1Model.ts","../src/experiment4cRequest.ts","../src/experiment4cPlanner.ts","../src/experiment4cContract.ts","../src/experiment4cDerivation.ts","../src/experiment4ar6rEvidence.ts","../src/experiment4ar6rModel.ts","../src/experiment4ar5Reranker.ts"];
 it("passes provider-blind audit over all active modules",async()=>{const sources=await Promise.all(active.map(p=>readFile(new URL(p,import.meta.url),"utf8"))),a=auditProviderBlindSource(sources);expect(a.clean).toBe(true);expect(a.providerAssignment).toBe(false);expect(a.caseProviderMap).toBe(false);});
 it("contains no historical provider/domain/endpoint recovery seeds",async()=>{const source=(await Promise.all(active.filter(p=>p.includes("4c")).map(p=>readFile(new URL(p,import.meta.url),"utf8")))).join("\n");expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|nhtsa|registry\.npmjs|themealdb|decodevin/i);});
 it("has no arbitrary absolute-url promotion regex in the typed extractor",async()=>{const source=await readFile(new URL("../src/experiment4cRequest.ts",import.meta.url),"utf8");expect(source).not.toContain("const ABSOLUTE_URL");expect(source).toContain("http_get_line");expect(source).toContain("curl_get");expect(source).toContain("fetch_get");expect(source).toContain("axios_get");expect(source).toContain("standaloneUrlPromotions:0");});
 it("generated runner audits 4C request/planner/contract and enforces typed integrity",async()=>{const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),g=deriveExperiment4cSource(base);expect(g).toContain("experiment4cRequest.ts");expect(g).toContain("experiment4cPlanner.ts");expect(g).toContain("experiment4cContract.ts");expect(g).toContain("typed_request_integrity:standaloneUrlPromotions===0&&validatorGraphMismatchRejects===0");});
});
