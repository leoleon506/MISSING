import {describe,expect,it} from "vitest";
import {parseMachineContract4T,freezeRequestProof4T,verifyFrozenRequestProof4T} from "../src/experiment4tNativeOperation.js";
import type {P1RequestHypothesis} from "../src/experiment4ap1Model.js";

describe("Experiment 4T native machine-readable contracts",()=>{
  it("parses OpenAPI JSON structurally",()=>{
    const parsed=parseMachineContract4T(JSON.stringify({openapi:"3.0.3",servers:[{url:"https://example.com"}],paths:{"/search":{get:{parameters:[{name:"q",in:"query",required:true,schema:{type:"string"}}],responses:{"200":{description:"ok"}}}}}}));
    expect(parsed?.format).toBe("json");expect(parsed?.spec.paths["/search"].get.parameters[0].name).toBe("q");
  });
  it("parses OpenAPI YAML without flattening sequence objects",()=>{
    const yaml=`openapi: 3.0.3\nservers:\n  - url: https://example.com\npaths:\n  /search:\n    get:\n      operationId: search\n      parameters:\n        - name: q\n          in: query\n          required: true\n          schema:\n            type: string\n      responses:\n        '200':\n          description: ok\n`;
    const parsed=parseMachineContract4T(yaml);expect(parsed?.format).toBe("yaml");expect(parsed?.spec.servers[0].url).toBe("https://example.com");expect(parsed?.spec.paths["/search"].get.parameters[0].name).toBe("q");
  });
  it("freezes the executable request proof and rejects mutation",()=>{
    const h:P1RequestHypothesis={id:"req4t_x",source_operation_id:"op4t_x",origin:"https://example.com",full_path:"/search",proof_type:"4t_linked_native_openapi_operation",evidence_ids:["e1"],source_urls:["https://example.com/openapi.json"],slots:[{id:"p1",name:"q",in:"query",required:true,auth_like:false,literals:[]}],input_bindings:{name:"p1"},literal_bindings:{},score:1000,concrete_relation:false};
    const proof=freezeRequestProof4T(h);expect(verifyFrozenRequestProof4T(h,proof)).toBe(true);expect(verifyFrozenRequestProof4T({...h,full_path:"/other"},proof)).toBe(false);
  });
});
