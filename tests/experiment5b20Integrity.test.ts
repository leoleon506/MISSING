import {describe,expect,it} from "vitest";
import {countRuntimeCaseFamilyHardcoding5B20,countRuntimeFrozenProviderNameHardcoding5B20,countRuntimeProviderUrlLiterals5B20,fiveB20PathAllowed} from "../src/experiment5b20Harness.js";

describe("Experiment 5B20 integrity guards",()=>{
 it("allows only 5B20-scoped implementation paths",()=>{expect(fiveB20PathAllowed("src/experiment5b20Qualification.ts")).toBe(true);expect(fiveB20PathAllowed("experiments/5b20/README.md")).toBe(true);expect(fiveB20PathAllowed("src/experiment5aCore.ts")).toBe(false)});
 it("detects runtime provider URLs while ignoring reserved test domains",()=>{expect(countRuntimeProviderUrlLiterals5B20('const x="https://provider.example.com/api"')).toBe(1);expect(countRuntimeProviderUrlLiterals5B20('const x="https://example.test/api"')).toBe(0)});
 it("detects development case/family and frozen provider-name literals",()=>{expect(countRuntimeCaseFamilyHardcoding5B20('const x="english_word_definition_metadata"')).toBeGreaterThan(0);expect(countRuntimeCaseFamilyHardcoding5B20('const x="generic_case"')).toBe(0);expect(countRuntimeFrozenProviderNameHardcoding5B20('const x="REST Countries"')).toBeGreaterThan(0);expect(countRuntimeFrozenProviderNameHardcoding5B20('const x="generic provider"')).toBe(0)});
});
