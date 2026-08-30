import {describe,expect,it} from "vitest";
import {countRuntimeCaseFamilyHardcoding5B19,countRuntimeFrozenProviderNameHardcoding5B19,countRuntimeProviderUrlLiterals5B19,fiveB19PathAllowed} from "../src/experiment5b19Harness.js";

describe("Experiment 5B19 integrity guards",()=>{
 it("allows only 5B19-scoped implementation paths",()=>{expect(fiveB19PathAllowed("src/experiment5b19Qualification.ts")).toBe(true);expect(fiveB19PathAllowed("experiments/5b19/README.md")).toBe(true);expect(fiveB19PathAllowed("src/experiment5aCore.ts")).toBe(false)});
 it("detects runtime provider URLs while ignoring reserved test domains",()=>{expect(countRuntimeProviderUrlLiterals5B19('const x="https://provider.example.com/api"')).toBe(1);expect(countRuntimeProviderUrlLiterals5B19('const x="https://example.test/api"')).toBe(0)});
 it("detects development case/family and frozen provider-name literals",()=>{expect(countRuntimeCaseFamilyHardcoding5B19('const x="english_word_definition_metadata"')).toBeGreaterThan(0);expect(countRuntimeCaseFamilyHardcoding5B19('const x="generic_case"')).toBe(0);expect(countRuntimeFrozenProviderNameHardcoding5B19('const x="REST Countries"')).toBeGreaterThan(0);expect(countRuntimeFrozenProviderNameHardcoding5B19('const x="generic provider"')).toBe(0)});
});
