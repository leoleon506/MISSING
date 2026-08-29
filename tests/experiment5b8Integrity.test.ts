import {describe,expect,it} from "vitest";
import {countRuntimeProviderUrlLiterals5B8} from "../src/experiment5b8Harness.js";

describe("Experiment 5B8 runtime URL integrity scan",()=>{
 it("ignores RFC-reserved non-routable parser/test sentinels",()=>{const src=["https://placeholder.invalid/path","http://fixture.test/a","https://docs.example/b","http://localhost:8787/c"].join("\n");expect(countRuntimeProviderUrlLiterals5B8(src)).toBe(0)});
 it("still rejects routable provider URL literals",()=>{const src=["https://api.real-provider.com/v1","https://docs.real-provider.net/reference"].join("\n");expect(countRuntimeProviderUrlLiterals5B8(src)).toBe(2)});
});
