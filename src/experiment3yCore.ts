import {createHash} from "node:crypto";
import type {ExecutionCase} from "./experiment3rCore.js";

export type BlindCase={case_id:string;intent:string;input_names:string[];required_output_leaf_names:string[]};

export const BLIND_CASES:BlindCase[]=[
  {case_id:"country_metadata",intent:"Given an ISO-style two-letter country identifier, identify a public machine-readable API operation that can return canonical country code and human-readable country name.",input_names:["country_id"],required_output_leaf_names:["code","name"]},
  {case_id:"pokemon_metadata",intent:"Given a canonical creature name, identify a public machine-readable API operation that can return its canonical numeric identifier and canonical name.",input_names:["pokemon_name"],required_output_leaf_names:["id","name"]},
  {case_id:"brewery_metadata",intent:"Given a public brewery identifier, identify a public machine-readable API operation that can return canonical brewery identifier and brewery name.",input_names:["brewery_id"],required_output_leaf_names:["id","name"]}
];

export const BLIND_EXEC_CASES:Record<string,ExecutionCase>={
  country_metadata:{case_id:"country_metadata",build:{country_id:"CR"},replay:{country_id:"CA"},required:["code","name"],validator:"currency"},
  pokemon_metadata:{case_id:"pokemon_metadata",build:{pokemon_name:"pikachu"},replay:{pokemon_name:"bulbasaur"},required:["id","name"],validator:"currency"},
  brewery_metadata:{case_id:"brewery_metadata",build:{brewery_id:"madtree-brewing-cincinnati"},replay:{brewery_id:"avondale-brewing-co-birmingham"},required:["id","name"],validator:"currency"}
};

export const sha3y=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");

function ciEqual(a:any,b:any){return typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===String(b).toLowerCase();}
export function semanticValidate3y(caseId:string,input:Record<string,unknown>,out:Record<string,any>){
  if(caseId==="country_metadata")return ciEqual(out.code,input.country_id)&&typeof out.name==="string"&&out.name.length>0;
  if(caseId==="pokemon_metadata")return Number.isInteger(out.id)&&out.id>0&&ciEqual(out.name,input.pokemon_name);
  if(caseId==="brewery_metadata")return ciEqual(out.id,input.brewery_id)&&typeof out.name==="string"&&out.name.length>0;
  return false;
}

function objectNodes(root:any){const nodes:{path:string;value:Record<string,any>}[]=[];const seen=new Set<any>();function walk(v:any,path:string,depth:number){if(depth>12||v===null||v===undefined||typeof v!=="object"||seen.has(v))return;seen.add(v);if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,100);i++)walk(v[i],path?`${path}.${i}`:String(i),depth+1);return;}nodes.push({path,value:v});for(const [k,val] of Object.entries(v))if(val&&typeof val==="object")walk(val,path?`${path}.${k}`:k,depth+1);}walk(root,"",0);return nodes;}
function keyFor(obj:Record<string,any>,wanted:string){return Object.keys(obj).find(k=>k===wanted)??Object.keys(obj).find(k=>k.toLowerCase()===wanted.toLowerCase())??null;}
export function induceProjection3y(body:any,caseId:string,input:Record<string,unknown>,required:readonly string[]){const matches:any[]=[];for(const node of objectNodes(body)){const keys=required.map(w=>keyFor(node.value,w));if(keys.some(k=>!k))continue;const projected:Record<string,any>={},projection:Record<string,string>={};for(let i=0;i<required.length;i++){const wanted=required[i],actual=keys[i]!;projected[wanted]=node.value[actual];projection[wanted]=node.path?`${node.path}.${actual}`:actual;}if(semanticValidate3y(caseId,input,projected))matches.push({projection,depth:node.path?node.path.split(".").length:0,path:node.path});}matches.sort((a,b)=>a.depth-b.depth||a.path.localeCompare(b.path));if(!matches.length)throw new Error("semantic_projection_not_found");return matches[0].projection as Record<string,string>;}
function getPath(v:any,path:string){return path.split(".").reduce((x,k)=>Array.isArray(x)&&/^\d+$/.test(k)?x[Number(k)]:x?.[k],v);}
export function project3y(body:any,projection:Record<string,string>){const out:Record<string,any>={};for(const [k,p] of Object.entries(projection))out[k]=getPath(body,p);return out;}

export function sourceHasForbiddenMappings(source:string){const forbidden=["api.nbp.pl","currencyfreaks","api.github.com/repos/","open5e","currencybeacon"];
  return forbidden.filter(x=>source.toLowerCase().includes(x));
}

export function replayDeltasZero3y(d:Record<string,number>){return Object.values(d).every(v=>v===0);}
