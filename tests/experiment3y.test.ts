import {describe,it,expect} from "vitest";
import {BLIND_CASES,BLIND_EXEC_CASES,induceProjection3y,project3y,replayDeltasZero3y,semanticValidate3y} from "../src/experiment3yCore.js";

describe("experiment 3Y blind holdouts",()=>{
  it("freezes exactly three new holdouts",()=>{expect(BLIND_CASES.map(x=>x.case_id)).toEqual(["country_metadata","pokemon_metadata","brewery_metadata"]);});
  it("validates country semantics",()=>{expect(semanticValidate3y("country_metadata",{country_id:"CR"},{code:"cr",name:"Costa Rica"})).toBe(true);expect(semanticValidate3y("country_metadata",{country_id:"CR"},{code:"US",name:"Costa Rica"})).toBe(false);});
  it("validates pokemon semantics",()=>{expect(semanticValidate3y("pokemon_metadata",{pokemon_name:"pikachu"},{id:25,name:"Pikachu"})).toBe(true);expect(semanticValidate3y("pokemon_metadata",{pokemon_name:"pikachu"},{id:0,name:"Pikachu"})).toBe(false);});
  it("validates brewery semantics",()=>{expect(semanticValidate3y("brewery_metadata",{brewery_id:"x"},{id:"x",name:"Example"})).toBe(true);expect(semanticValidate3y("brewery_metadata",{brewery_id:"x"},{id:"y",name:"Example"})).toBe(false);});
  it("induces only deterministic field projections",()=>{const body={wrapper:{id:25,name:"pikachu"}};const p=induceProjection3y(body,"pokemon_metadata",BLIND_EXEC_CASES.pokemon_metadata.build,BLIND_EXEC_CASES.pokemon_metadata.required);expect(p).toEqual({id:"wrapper.id",name:"wrapper.name"});expect(project3y(body,p)).toEqual({id:25,name:"pikachu"});});
  it("rejects replay control deltas",()=>{expect(replayDeltasZero3y({a:0,b:0})).toBe(true);expect(replayDeltasZero3y({a:0,b:1})).toBe(false);});
  it("uses changed replay inputs",()=>{for(const c of BLIND_CASES)expect(BLIND_EXEC_CASES[c.case_id].replay).not.toEqual(BLIND_EXEC_CASES[c.case_id].build);});
});
