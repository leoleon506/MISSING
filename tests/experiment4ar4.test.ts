import {describe,it,expect} from "vitest";
import {summarizeJsonShape,normalizeDocumentedRelativeEndpoint,canonicalizeRepairProjection,RESPONSE_REPAIR_SCHEMA} from "../src/experiment4ar4Core.js";

describe("4A-R4 response-grounded recovery",()=>{
 it("summarizes structure without leaking scalar response values",()=>{const shape=summarizeJsonShape({name:"SECRET_VALUE",items:[{id:123,title:"PRIVATE_TEXT"}]});const text=JSON.stringify(shape);expect(text).toContain('"name"');expect(text).toContain('"items"');expect(text).toContain('"title"');expect(text).not.toContain("SECRET_VALUE");expect(text).not.toContain("PRIVATE_TEXT");expect(text).not.toContain("123");});
 it("canonicalizes a separately documented base path and relative endpoint",()=>{const base="https://example.test/api/v1",rel="search.php",evidence=`Docs base ${base} endpoint ${rel}`;expect(normalizeDocumentedRelativeEndpoint(base,rel,evidence)).toMatchObject({base_url:"https://example.test",path_template:"/api/v1/search.php"});});
 it("does not canonicalize an undocumented relative endpoint",()=>expect(normalizeDocumentedRelativeEndpoint("https://example.test/api/v1","search.php","only unrelated evidence")).toBeNull());
 it("does not allow traversal in relative endpoint canonicalization",()=>expect(normalizeDocumentedRelativeEndpoint("https://example.test/api/v1","../admin","https://example.test/api/v1 ../admin")).toBeNull());
 it("canonicalizes a response repair projection through the existing typed DSL",()=>{const rows=[{output:"version",op:"FIELD",path:"dist-tags.latest",name:null,map_path:null,key_op:null,key_name:null,key_value:null,value_path:null,array_path:null,where_path:null,equals_op:null,equals_name:null,equals_value:null}];expect(canonicalizeRepairProjection(rows,["version"],["package_name"])).toEqual({version:{op:"FIELD",path:"dist-tags.latest"}});});
 it("keeps response repair schema strict",()=>expect(RESPONSE_REPAIR_SCHEMA.strict).toBe(true));
});
