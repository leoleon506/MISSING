import type {P1ObservedField} from "./experiment4ap1Model.js";
import {lexicalTokensP1} from "./experiment4ap1Request.js";
import {identityCompatible4Q} from "./experiment4qPreference.js";

const WRAPPERS=new Set(["str","string","value","data","result","results","item","items","field","property","attr","attribute"]);
const ROLE_ALIASES:Record<string,Set<string>>={
  version:new Set(["version","latest","release"]),
  category:new Set(["category","classification","class"]),
  make:new Set(["make","manufacturer","brand"]),
  name:new Set(["name"]),
  title:new Set(["title"]),
  code:new Set(["code","barcode"]),
  id:new Set(["id","identifier","key"]),
  gender:new Set(["gender","sex"]),
  age:new Set(["age"]),
  country_code:new Set(["country","countrycode","country_code"]),
};
function clean(tokens:string[]){return tokens.filter(t=>!WRAPPERS.has(t.toLowerCase()))}
function normalizedRole(v:string){return clean(lexicalTokensP1(v).map(x=>x.toLowerCase()))}
export function semanticRoleCompatible4S(output:string,labelOrLeaf:string){
  const out=normalizedRole(output),field=normalizedRole(labelOrLeaf);
  if(!out.length||!field.length)return false;
  if(out.join("_")===field.join("_"))return true;
  const aliases=ROLE_ALIASES[output.toLowerCase()]||new Set(out);
  return field.some(t=>aliases.has(t))&&out.every(t=>aliases.has(t)||field.includes(t));
}
export function fieldSemanticallyGrounded4S(output:string,field:P1ObservedField){
  if(semanticRoleCompatible4S(output,field.leaf))return true;
  const parts=field.path.split(".").filter(Boolean).filter(x=>!/^\d+$/.test(x));
  return parts.some(part=>semanticRoleCompatible4S(output,part));
}
export function inputSemanticallyGrounded4S(output:string,input:string){return identityCompatible4Q(output,input)}
export function rowLabelSemanticallyGrounded4S(output:string,label:string){return semanticRoleCompatible4S(output,label)}
