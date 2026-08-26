import {describe,it,expect} from "vitest";
import {canonicalizeBoundary3,makeBoundarySchema} from "../src/experiment4ar3Core.js";

function base():any{return {case_id:"x",provider_candidate_id:"p",decision:"COMPILE",method:"GET",base_url:"https://example.test",path_template:"/{name}",path_bindings:[{name:"name",source_kind:"INPUT",input_name:"name",literal_value:null}],query_bindings:[],projection:[{output:"value",op:"FIELD",path:"data.value",name:null,map_path:null,key_op:null,key_name:null,key_value:null,value_path:null,array_path:null,where_path:null,equals_op:null,equals_name:null,equals_value:null}],evidence_ids:["e1"],reason:"ok"};}

describe("4A-R3 typed binding IR",()=>{
 it("canonicalizes typed path input to exact $input reference",()=>expect(canonicalizeBoundary3(base(),["value"],["name"])).toMatchObject({path_bindings:{name:"$input.name"}}));
 it("canonicalizes typed query INPUT and LITERAL without aliases",()=>{const r=base();r.query_bindings=[{name:"q",source_kind:"INPUT",input_name:"name",literal_value:null},{name:"format",source_kind:"LITERAL",input_name:null,literal_value:"json"}];expect(canonicalizeBoundary3(r,["value"],["name"])).toMatchObject({query_bindings:{q:"$input.name",format:"json"}});});
 it("rejects a binding to an input not present in the case",()=>{const r=base();r.path_bindings=[{name:"name",source_kind:"INPUT",input_name:"other",literal_value:null}];expect(()=>canonicalizeBoundary3(r,["value"],["name"])).toThrow(/binding_input_invalid/);});
 it("rejects literal path bindings",()=>{const r=base();r.path_bindings=[{name:"name",source_kind:"LITERAL",input_name:null,literal_value:"x"}];expect(()=>canonicalizeBoundary3(r,["value"],["name"])).toThrow(/binding_source_kind_invalid/);});
 it("schema enums only the frozen case inputs",()=>{const s:any=makeBoundarySchema(["latitude","longitude"]);const e=s.schema.properties.query_bindings.items.properties.input_name.enum;expect(e).toEqual(["latitude","longitude",null]);expect(e).not.toContain("name");});
 it("rejects INPUT bindings carrying a literal",()=>{const r=base();r.query_bindings=[{name:"q",source_kind:"INPUT",input_name:"name",literal_value:"name"}];expect(()=>canonicalizeBoundary3(r,["value"],["name"])).toThrow(/binding_input_literal_must_be_null/);});
});
