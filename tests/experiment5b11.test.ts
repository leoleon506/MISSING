import {describe,expect,it} from "vitest";
import {evidenceFaithfulTemplateFilter5B11} from "../src/experiment5b11Template.js";
import type {P1RequestHypothesis} from "../src/experiment4ap1Model.js";
function h(path:string,inLoc:"path"|"query",slotName:string):P1RequestHypothesis{return {id:"req1",source_operation_id:"op1",origin:"https://placeholder.test",full_path:path,proof_type:"test",evidence_ids:["e1"],source_urls:[],slots:[{id:"s1",name:slotName,in:inLoc,required:true,auth_like:false,literals:[{id:"l1",value:"example"}]}],input_bindings:{input:"s1"},literal_bindings:{},score:1,concrete_relation:true}}
describe("5B11 evidence-faithful templates",()=>{
 it("keeps a documented query slot and does not migrate input into path",()=>{const r=evidenceFaithfulTemplateFilter5B11([h("/search?q=example","query","q")],{input:"alpha"});expect(r.hypotheses).toHaveLength(1);expect(r.metrics.documentedTemplatesBuilt5b11).toBe(1);expect(r.witnesses.get("req1")?.only_evidenced_slots_mutated).toBe(true)});
 it("rejects query-bound input already inserted as a path segment",()=>{const r=evidenceFaithfulTemplateFilter5B11([h("/alpha/search?q=example","query","q")],{input:"alpha"});expect(r.hypotheses).toHaveLength(0);expect(r.metrics.templatePathMutationRejects5b11).toBe(1)});
 it("requires an evidenced path placeholder for path bindings",()=>{const r=evidenceFaithfulTemplateFilter5B11([h("/items/fixed","path","id")],{input:"alpha"});expect(r.hypotheses).toHaveLength(0);expect(r.metrics.templateGeometryMutationRejects5b11).toBe(1)});
 it("accepts a documented path placeholder",()=>{const r=evidenceFaithfulTemplateFilter5B11([h("/items/{id}","path","id")],{input:"alpha"});expect(r.hypotheses).toHaveLength(1);expect(r.metrics.templateBindingsAccepted5b11).toBe(1)});
});
