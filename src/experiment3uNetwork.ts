import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {MAX_CONTRACT_CANDIDATES,MAX_HTML_PAGES,validateScopedUrl} from "./experiment3uCore.js";

function publicIPv4(ip:string){const p=ip.split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;const[a,b,c]=p;if(a===0||a===10||a===127||a>=224)return false;if(a===100&&b>=64&&b<=127)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===192&&b===0&&(c===0||c===2))return false;if(a===198&&(b===18||b===19))return false;if(a===198&&b===51&&c===100)return false;if(a===203&&b===0&&c===113)return false;return true;}
function publicIPv6(ip:string){const s=ip.toLowerCase();if(s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||/^fe[89ab]/.test(s)||s.startsWith("ff")||s.startsWith("2001:db8:"))return false;if(s.startsWith("::ffff:")){const t=s.slice(7);return isIP(t)===4&&publicIPv4(t);}return true;}
export function isPublicAddress(ip:string){return isIP(ip)===4?publicIPv4(ip):isIP(ip)===6?publicIPv6(ip):false;}
export async function assertPublicScopedUrl(start:string,raw:string,depth:number){const scoped=validateScopedUrl(start,raw,depth);if(!scoped.ok||!scoped.url)throw new Error(scoped.reason||"scope_rejected");let addrs;try{addrs=await lookup(scoped.url.hostname,{all:true,verbatim:true});}catch(e){throw new Error(`dns_unreachable:${String(e)}`);}if(!addrs.length||addrs.some(a=>!isPublicAddress(a.address)))throw new Error("non_public_dns");return scoped.url;}
export function budgetAllows(kind:"html"|"contract",alreadyUsed:number){return alreadyUsed<(kind==="html"?MAX_HTML_PAGES:MAX_CONTRACT_CANDIDATES);}
export function acquisitionSourceAllowed(source:string){return ["html_attribute","config_reference","documentation_link","standard_path"].includes(source);}
export function javascriptExecutionAllowed(){return false;}
