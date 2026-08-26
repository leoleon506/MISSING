import {MAX_EXPR_DEPTH,validateDecision,type Frozen3xCase} from "./experiment3xCore.js";
import type {SafetyEvent} from "./experiment3wCore.js";

function objectDepth(v:any,depth=0):number{if(v===null||typeof v!=="object")return depth;if(depth>32)return depth;const values=Array.isArray(v)?v:Object.values(v);return values.length?Math.max(depth,...values.map(x=>objectDepth(x,depth+1))):depth;}
export function enforceExpressionDepth(raw:any){if(raw?.decision!=="COMPILE")return true;const outputs=raw?.outputs;if(!outputs||typeof outputs!=="object"||Array.isArray(outputs))return true;for(const [name,expr] of Object.entries(outputs)){if(objectDepth(expr)>MAX_EXPR_DEPTH)throw new Error(`expression_depth_exceeded:${name}`);}return true;}
export function validateDecision3x(raw:any,c:Frozen3xCase,safety:SafetyEvent[]=[]){enforceExpressionDepth(raw);return validateDecision(raw,c,safety);}
