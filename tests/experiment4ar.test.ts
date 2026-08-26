import {describe,it,expect} from "vitest";
import {normalizeOutputPath,normalizeRequestContract,evidenceScore,validateProjectionPlan} from "../src/experiment4arCore.js";

describe("4A-R generic recovery",()=>{
 it("normalizes embedded input and colon path syntax generically",()=>{
  expect(normalizeRequestContract({decision:"COMPILE",path_template:"/works/$input.work_id.json",path_bindings:{}},["work_id"])).toMatchObject({path_template:"/works/{work_id}.json",path_bindings:{work_id:"$input.work_id"}});
  expect(normalizeRequestContract({decision:"COMPILE",path_template:"/character/:character_id",path_bindings:{}},["character_id"])).toMatchObject({path_template:"/character/{character_id}",path_bindings:{character_id:"$input.character_id"}});
 });
 it("normalizes bracket and JSONPath output paths but rejects wildcard",()=>{expect(normalizeOutputPath("$.country[0].country_id")).toBe("country.0.country_id");expect(()=>normalizeOutputPath("query.pages.*.title")).toThrow("wildcard_projection_forbidden");});
 it("accepts typed 3X FIND and LOOKUP plans",()=>{expect(validateProjectionPlan({name:{op:"FIND",array_path:"items",where_path:"id",equals:{op:"INPUT",name:"q"},value_path:"name"}},["name"],["q"]).name.op).toBe("FIND");expect(validateProjectionPlan({name:{op:"LOOKUP",map_path:"items",key:{op:"INPUT",name:"q"},value_path:"name"}},["name"],["q"]).name.op).toBe("LOOKUP");});
 it("scores endpoint/schema evidence above generic prose",()=>{expect(evidenceScore("GET /v1/x response JSON schema field name",["name"])).toBeGreaterThan(evidenceScore("Welcome to our service",["name"]));});
});
