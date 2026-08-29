import {describe,expect,it} from "vitest";
import {relation5B2,semanticRole5B2} from "../src/experiment5b2Semantics.js";

describe("Experiment 5B2 semantic hardening",()=>{
  it("classifies ISO-numbered response fields as code semantics",()=>{
    expect(semanticRole5B2("country.iso2")).toBe("code");
    expect(semanticRole5B2("alpha3")).toBe("code");
  });
  it("forbids bounded containment as identity evidence for a purely numeric input",()=>{
    expect(relation5B2("1342-1342",1342,[1342])).toBeNull();
    expect(relation5B2("doi:10.1000/1342",1342,[1342])).toBeNull();
    expect(relation5B2(1342,1342,[1342])).toBe("normalized_equal");
    expect(relation5B2("1342.0",1342,[1342])).toBe("numeric_equal");
  });
});
