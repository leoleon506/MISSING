import {FOUR_A_CASES} from "./experiment4aCore.js";
import {lexicalTokensP1} from "./experiment4ap1Request.js";

const GENERIC=new Set(["id","name","code","value","key","identifier","q","query","search","term","input"]);
const STOP=new Set(["given","public","machine","readable","api","operation","return","returns","canonical","human","readable","current","identify","that","the","and","for","with","from","into","value","metadata"]);
const toks=(v:string)=>lexicalTokensP1(v);
function taskFrame(caseId:string){const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return null;const inputTokens=new Set(c.input_names.flatMap(toks)),outputTokens=new Set(c.required.flatMap(toks)),intentTokens=new Set(toks(c.intent).filter(x=>!STOP.has(x))),entityTokens=new Set([...intentTokens].filter(x=>!inputTokens.has(x)&&!outputTokens.has(x)));return{inputTokens,intentTokens,entityTokens}}
function anchor(path:string,placeholder:string){const head=path.split("?")[0],segments=head.split("/").filter(Boolean),idx=segments.findIndex(x=>x.includes(placeholder));if(idx<0)return "";for(let i=idx-1;i>=0;i--){const s=segments[i].toLowerCase();if(!s||/^v?\d{1,4}$/.test(s)||/^(?:api|rest|v\d+)$/.test(s))continue;return s.replace(/[^a-z0-9]+/g," ").trim()}return ""}
function positive(a:string,f:ReturnType<typeof taskFrame>){if(!a||!f)return false;for(const token of toks(a)){if(f.inputTokens.has(token)||f.intentTokens.has(token)||f.entityTokens.has(token))return true;for(const x of f.inputTokens)if(x.length>=3&&token.includes(x))return true;for(const x of f.entityTokens)if(x.length>=4&&token.includes(x))return true}return false}
export function operationLocalAnchorContradiction4J(caseId:string,pathTemplate:string){const f=taskFrame(caseId);if(!f)return true;for(const m of pathTemplate.matchAll(/\{([^}]+)\}/g)){const a=anchor(pathTemplate,m[0]);if(!a||positive(a,f))continue;const meaningful=toks(a).filter(x=>!STOP.has(x)&&!GENERIC.has(x));if(meaningful.some(x=>x.length>=4))return true}return false}
