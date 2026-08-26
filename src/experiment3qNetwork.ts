import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {validateSpecUrlSyntax} from "./experiment3qCore.js";

const TIMEOUT_MS=15000;
function publicIPv4(ip:string){const p=ip.split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;const[a,b,c]=p;if(a===0||a===10||a===127||a>=224)return false;if(a===100&&b>=64&&b<=127)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===192&&b===0&&(c===0||c===2))return false;if(a===198&&(b===18||b===19))return false;if(a===198&&b===51&&c===100)return false;if(a===203&&b===0&&c===113)return false;return true;}
function publicIPv6(ip:string){const s=ip.toLowerCase();if(s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||/^fe[89ab]/.test(s)||s.startsWith("ff")||s.startsWith("2001:db8:"))return false;if(s.startsWith("::ffff:")){const t=s.slice(7);return isIP(t)===4&&publicIPv4(t);}return true;}
function isPublic(ip:string){return isIP(ip)===4?publicIPv4(ip):isIP(ip)===6?publicIPv6(ip):false;}
async function safeUrl(raw:string){const syntax=validateSpecUrlSyntax(raw);if(!syntax.ok||!syntax.url)throw new Error(`host_policy_${syntax.reason}`);const addrs=await lookup(syntax.url.hostname,{all:true,verbatim:true});if(!addrs.length||addrs.some(a=>!isPublic(a.address)))throw new Error("host_policy_non_public_dns");return syntax.url;}
export async function fetchTextBounded(url:string,maxBytes:number,accept:string){
  await safeUrl(url);const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  try{const r=await fetch(url,{headers:{accept,"user-agent":"MISSING-Experiment-3Q/0.1"},redirect:"manual",signal:ctrl.signal});if(r.status>=300&&r.status<400)throw new Error(`redirect_rejected_${r.status}`);if(!r.ok)throw new Error(`http_${r.status}`);const declared=Number(r.headers.get("content-length")||0);if(declared>maxBytes)throw new Error("response_too_large_declared");const text=await r.text();if(Buffer.byteLength(text)>maxBytes)throw new Error("response_too_large");return {text,content_type:r.headers.get("content-type")||""};}finally{clearTimeout(timer);}
}
