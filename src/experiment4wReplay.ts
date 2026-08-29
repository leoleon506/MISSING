import {sha4u} from "./experiment4uOpenApi.js";

function pathExists4W(body:any,path:string){const parts=String(path||"").split(".").filter(Boolean);if(!parts.length)return false;let cur=body;for(const part of parts){if(cur===null||cur===undefined)return false;if(Array.isArray(cur)){if(!/^\d+$/.test(part))return false;const i=Number(part);if(i<0||i>=cur.length)return false;cur=cur[i];continue}if(typeof cur!=="object"||!Object.prototype.hasOwnProperty.call(cur,part))return false;cur=cur[part]}return true}

export function verifySchemaRoleWitnessReplayBody4W(witness:any,body:any){if(!witness||!Array.isArray(witness.mappings)||witness.resolver_output_fingerprint!==sha4u(witness.mappings))return false;const used=new Set<string>();for(const mapping of witness.mappings){if(!mapping||typeof mapping.output_role!=="string"||typeof mapping.schema_path!=="string"||typeof mapping.observed_path!=="string"||typeof mapping.candidate_id!=="string"||"value" in mapping||used.has(mapping.observed_path)||!pathExists4W(body,mapping.observed_path))return false;used.add(mapping.observed_path)}return witness.mappings.length>0}

export const schemaRoleReplayPathExists4W=pathExists4W;
