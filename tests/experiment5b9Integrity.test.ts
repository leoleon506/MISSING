import {describe,expect,it} from "vitest";
import {countRuntimeProviderUrlLiterals5B9} from "../src/experiment5b9Harness.js";
describe("Experiment 5B9 runtime URL integrity",()=>{
 it("ignores reserved non-routable parser/test sentinels",()=>{expect(countRuntimeProviderUrlLiterals5B9('const a="https://placeholder.invalid/x"; const b="http://docs.example/test";')).toBe(0)});
 it("still detects routable provider literals",()=>{expect(countRuntimeProviderUrlLiterals5B9('const a="https://api.vendor.com/docs";')).toBe(1)});
});
