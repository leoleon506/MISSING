import {createHash} from "node:crypto";

export const FIVE_B15_MAX_ATTEMPTS=3;
export const FIVE_B15_RETRY_DELAY_MS=250;
export const FIVE_B15_MAX_TOTAL_HTTP_ATTEMPTS=21;
export const FIVE_B15_ACCEPT="application/json,application/yaml,text/yaml,application/x-yaml,text/html,text/plain,*/*";
const RETRY_HTTP=new Set([408,425,429,500,502,503,504]);
const AUTH_KEYS=/^(?:api[_-]?key|access[_-]?token|token|auth|authorization|key)$/i;
const SAFETY_OR_RENDER_FAILURE=/(?:non_https|credentials|hostname_ip_literal|dns_private_address|private_hosts|cross_domain|invalid_url|redirect_non_https|redirect_credentials|redirect_ip_literal|redirect_cross_domain|body_too_large)/i;

export type FiveB15FailureStage="render"|"transport"|"decode"|"projection"|"semantic";
export type FiveB15FailureClass={outcome_class:string;retryable:boolean;http_status:number|null};

export function fiveB15Sha(v:any){return createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex")}
export function requestSemantics5B15(url:string){return {method:"GET",url,headers:{accept:FIVE_B15_ACCEPT},body:null}}
export function requestFingerprint5B15(url:string){return fiveB15Sha(requestSemantics5B15(url))}
export function authLikeRenderedRequest5B15(url:string){try{const u=new URL(url);if(u.username||u.password)return true;for(const [k] of u.searchParams)if(AUTH_KEYS.test(k))return true;return false}catch{return true}}

export function classifyFiveB15Failure(stage:FiveB15FailureStage,error:unknown):FiveB15FailureClass{
 const text=String(error instanceof Error?error.message:error);
 if(stage==="decode")return {outcome_class:"structured_decode_failure",retryable:true,http_status:null};
 if(stage==="semantic")return {outcome_class:"semantic_verification_failure",retryable:false,http_status:null};
 if(stage==="projection")return {outcome_class:"projection_failure",retryable:false,http_status:null};
 if(stage==="render")return {outcome_class:"request_render_failure",retryable:false,http_status:null};
 const m=text.match(/http_(\d{3})/i);if(m){const status=Number(m[1]);return {outcome_class:`http_${status}`,retryable:RETRY_HTTP.has(status),http_status:status}}
 if(SAFETY_OR_RENDER_FAILURE.test(text))return {outcome_class:"transport_guard_failure",retryable:false,http_status:null};
 return {outcome_class:"transport_exception",retryable:true,http_status:null};
}

export function retryAllowedFiveB15(attempt:number,failure:FiveB15FailureClass){return failure.retryable&&attempt<FIVE_B15_MAX_ATTEMPTS}
