import {docScopeAllowed} from "./experiment3wCore.js";

const SPEC_HINT=/(?:openapi|swagger|api[-_.]?spec|schema|\.ya?ml(?:$|[?#])|\.json(?:$|[?#]))/i;
export type LinkedContractCandidate4S={source_evidence_id:string,source_url:string,target_url:string};
export function extractLinkedContractCandidates4S(evidence:{evidence_id:string;resolved_url:string;text:string;content_type:string;state:string}[],providerStart:string){
  const out:LinkedContractCandidate4S[]=[],seen=new Set<string>();
  for(const e of evidence){
    if(e.state!=="ok"||!/html/i.test(e.content_type)||!e.text)continue;
    const re=/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;let m:RegExpExecArray|null;
    while((m=re.exec(e.text))){
      try{
        const target=new URL(m[1],e.resolved_url).toString();
        if(!SPEC_HINT.test(target)&&!SPEC_HINT.test(m[0]))continue;
        if(!docScopeAllowed(providerStart,target))continue;
        const key=`${e.evidence_id}|${target}`;if(seen.has(key))continue;seen.add(key);
        out.push({source_evidence_id:e.evidence_id,source_url:e.resolved_url,target_url:target});
      }catch{}
    }
  }
  return out.slice(0,12);
}
function securityRequired(spec:any,op:any){const security=op?.security===undefined?spec?.security:op.security;return Array.isArray(security)&&security.length>0}
export function countLinkedAuthOperations4S(spec:any){let n=0;for(const item of Object.values(spec?.paths||{}) as any[]){const op=item?.get;if(op&&securityRequired(spec,op))n++}return n}
export function linkedSpecSummary4S(spec:any){
  const operations:any[]=[];
  for(const [path,item] of Object.entries(spec?.paths||{}) as any[]){
    const common=Array.isArray(item?.parameters)?item.parameters:[];
    const op=item?.get;if(!op||securityRequired(spec,op))continue;
    operations.push({method:"GET",path,summary:op.summary||null,description:op.description||null,operationId:op.operationId||null,parameters:[...common,...(Array.isArray(op.parameters)?op.parameters:[])],responses:op.responses||{}});
  }
  return JSON.stringify({openapi:spec?.openapi,swagger:spec?.swagger,servers:spec?.servers,host:spec?.host,basePath:spec?.basePath,schemes:spec?.schemes,operations:operations.slice(0,160)},null,2);
}
