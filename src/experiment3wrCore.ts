import {extname} from "node:path";
import {FROZEN_PROVIDERS,MAX_DEPTH,MAX_DOC_PAGES,sha,type DocEvidence,type FrozenProvider} from "./experiment3wCore.js";

export {FROZEN_PROVIDERS,MAX_DEPTH,MAX_DOC_PAGES,sha};
export type {DocEvidence,FrozenProvider};

export type FrontierDecision={source_evidence_id:string,target_url:string,anchor_text:string,score:number,reasons:string[],accepted:boolean,rejection_reason?:string};

const ASSET_EXT=new Set([".png",".jpg",".jpeg",".gif",".webp",".svg",".ico",".css",".js",".mjs",".map",".woff",".woff2",".ttf",".eot",".mp3",".mp4",".webm",".zip",".gz",".tgz",".pdf"]);
const NAV_SEGMENTS=["/login","/issues","/pulls","/actions","/marketplace","/sponsors","/security","/discussions"];
const KEYWORDS=["documentation","docs","api","reference","developer","readme","guide","endpoint","schema","example","currency","currencies","ability","ability-score","repository","repo","metadata"];

export function isDocumentContentType(contentType:string){const c=contentType.toLowerCase();return c.includes("text/html")||c.includes("text/plain")||c.includes("text/markdown")||c.includes("application/json")||c.includes("application/xml")||c.includes("text/xml");}
export function staticAssetUrl(raw:string){try{const u=new URL(raw);return ASSET_EXT.has(extname(u.pathname).toLowerCase());}catch{return true;}}
export function githubNavigationUrl(raw:string){try{const u=new URL(raw);return u.hostname==="github.com"&&NAV_SEGMENTS.some(x=>u.pathname.includes(x));}catch{return false;}}
export function frontierScore(raw:string,anchor:string){const u=new URL(raw);const hay=`${u.pathname} ${u.search} ${anchor}`.toLowerCase();let score=0;const reasons:string[]=[];for(const k of KEYWORDS)if(hay.includes(k)){score+=k==="documentation"||k==="readme"||k==="reference"?5:2;reasons.push(k);}if(/\/readme(?:\.|$|\/)/i.test(u.pathname)){score+=10;reasons.push("readme_path");}if(u.hostname==="raw.githubusercontent.com"){score+=8;reasons.push("github_raw");}return {score,reasons};}
export function decideFrontier(sourceEvidenceId:string,target:string,anchor:string){if(staticAssetUrl(target))return {source_evidence_id:sourceEvidenceId,target_url:target,anchor_text:anchor,score:-100,reasons:[],accepted:false,rejection_reason:"static_asset"} satisfies FrontierDecision;if(githubNavigationUrl(target))return {source_evidence_id:sourceEvidenceId,target_url:target,anchor_text:anchor,score:-100,reasons:[],accepted:false,rejection_reason:"github_navigation"} satisfies FrontierDecision;const s=frontierScore(target,anchor);return {source_evidence_id:sourceEvidenceId,target_url:target,anchor_text:anchor,score:s.score,reasons:s.reasons,accepted:s.score>0,rejection_reason:s.score>0?undefined:"not_document_relevant"} satisfies FrontierDecision;}
export function extractFrontierLinks(base:string,start:string,text:string,sourceEvidenceId:string,scopeAllowed:(a:string,b:string)=>boolean){const re=/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>|(?:href)\s*=\s*["']([^"'#]+)["']/gi;const seen=new Set<string>(),out:FrontierDecision[]=[];let m;while((m=re.exec(text))){const href=m[1]||m[3],anchor=String(m[2]||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();try{const target=new URL(href,base).toString();if(seen.has(target))continue;seen.add(target);if(!scopeAllowed(start,target)){out.push({source_evidence_id:sourceEvidenceId,target_url:target,anchor_text:anchor,score:-100,reasons:[],accepted:false,rejection_reason:"out_of_scope"});continue;}out.push(decideFrontier(sourceEvidenceId,target,anchor));}catch{}}return out.sort((a,b)=>b.score-a.score||a.target_url.localeCompare(b.target_url));}
export function enforceCrawlDepth(depth:number){if(depth>MAX_DEPTH)throw new Error("crawl_depth_exceeded");return true;}
export function enforcePageBudget(acceptedPages:number){if(acceptedPages>=MAX_DOC_PAGES)throw new Error("documentation_page_budget_exhausted");return true;}
export function enforceReplayBudget(deltas:Record<string,number>){if(Object.values(deltas).some(v=>v!==0))throw new Error("replay_external_call_budget_violated");return true;}
export function frontierFingerprint(x:FrontierDecision[]){return sha(x.map(v=>({source:v.source_evidence_id,url:v.target_url,anchor:v.anchor_text,score:v.score,reasons:v.reasons,accepted:v.accepted,rejection:v.rejection_reason})));}
