import {describe,expect,it} from "vitest";
import {Z_CASES,Z_SELECTED_IDS,Z_POOL_IDS,zSelectionHash,semanticValidateZ} from "../src/experiment3zCore.js";

describe("Experiment 3Z blind confirmatory preregistration",()=>{
 it("selects exactly the three deterministic lowest hashes",()=>{const expected=[...Z_POOL_IDS].sort((a,b)=>zSelectionHash(a).localeCompare(zSelectionHash(b))).slice(0,3);expect(Z_SELECTED_IDS).toEqual(expected);expect(Z_CASES.map(x=>x.case_id)).toEqual(expected);});
 it("uses exactly three unseen capability ids",()=>{expect(Z_CASES).toHaveLength(3);expect(new Set(Z_CASES.map(x=>x.case_id)).size).toBe(3);});
 it("semantic validators bind outputs to changed input",()=>{expect(semanticValidateZ("dictionary_word_metadata",{word:"hello"},{word:"hello",definition:"greeting"})).toBe(true);expect(semanticValidateZ("public_ip_metadata",{ip:"8.8.8.8"},{ip:"8.8.8.8",country_name:"United States"})).toBe(true);expect(semanticValidateZ("cryptocurrency_asset_metadata",{asset_symbol:"BTC"},{symbol:"BTC",name:"Bitcoin"})).toBe(true);expect(semanticValidateZ("cryptocurrency_asset_metadata",{asset_symbol:"ETH"},{symbol:"BTC",name:"Bitcoin"})).toBe(false);});
});
