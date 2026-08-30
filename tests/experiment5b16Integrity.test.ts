import {describe,expect,it} from "vitest";
import {countRuntimeCaseFamilyHardcoding5B16,countRuntimeProviderUrlLiterals5B16,fiveB16PathAllowed} from "../src/experiment5b16Harness.js";

describe("Experiment 5B16 integrity guards",()=>{
 it("allows only 5B16-scoped implementation paths",()=>{expect(fiveB16PathAllowed("src/experiment5b16Decision.ts")).toBe(true);expect(fiveB16PathAllowed("experiments/5b16/README.md")).toBe(true);expect(fiveB16PathAllowed("src/experiment5aCore.ts")).toBe(false)});
 it("detects real runtime provider URL literals but ignores reserved test domains",()=>{expect(countRuntimeProviderUrlLiterals5B16('const x="https://provider.example.com/api"')).toBe(1);expect(countRuntimeProviderUrlLiterals5B16('const x="https://example.test/api"')).toBe(0)});
 it("detects exact development case and family literals",()=>{expect(countRuntimeCaseFamilyHardcoding5B16('const x="english_word_definition_metadata"')).toBeGreaterThan(0);expect(countRuntimeCaseFamilyHardcoding5B16('const x="generic_case"')).toBe(0)});
});
