import {describe,expect,it} from "vitest";
import {countRuntimeCaseFamilyHardcoding5B17,countRuntimePrimaryNameHardcoding5B17,countRuntimeProviderUrlLiterals5B17,fiveB17PathAllowed} from "../src/experiment5b17Harness.js";

describe("Experiment 5B17 integrity guards",()=>{
 it("allows only 5B17-scoped implementation paths",()=>{expect(fiveB17PathAllowed("src/experiment5b17Decision.ts")).toBe(true);expect(fiveB17PathAllowed("experiments/5b17/README.md")).toBe(true);expect(fiveB17PathAllowed("src/experiment5aCore.ts")).toBe(false)});
 it("detects runtime provider URLs but ignores reserved test domains",()=>{expect(countRuntimeProviderUrlLiterals5B17('const x="https://provider.example.com/api"')).toBe(1);expect(countRuntimeProviderUrlLiterals5B17('const x="https://example.test/api"')).toBe(0)});
 it("detects exact development case/family and primary-name literals",()=>{expect(countRuntimeCaseFamilyHardcoding5B17('const x="english_word_definition_metadata"')).toBeGreaterThan(0);expect(countRuntimeCaseFamilyHardcoding5B17('const x="generic_case"')).toBe(0);expect(countRuntimePrimaryNameHardcoding5B17('const x="Free Dictionary"')).toBeGreaterThan(0);expect(countRuntimePrimaryNameHardcoding5B17('const x="generic provider"')).toBe(0)});
});
