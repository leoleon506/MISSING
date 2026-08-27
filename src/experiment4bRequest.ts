import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {buildRequestHypothesesP1,lexicalTokensP1} from "./experiment4ap1Request.js";

const AUTH_LIKE=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;
const GENERIC_SINGLE_SLOT=/^(?:id|name|q|s|query|search|term|value|input)$/i;
const ABSOLUTE_URL=/https:\/\/[^\s<>"'`\\]+/gi;

export type RequestGraphMetrics={
  requestGraphNodes:number;
  requestGraphEdges:number;
  provenApiOrigins:number;
  provenRequestTemplates:number;
  unboundRelativePaths:number;
  crossSourceJoinRejects:number;
  documentationOriginFallbacks:number;
};

function overlap(a:string,b:string){const x=new Set(lexicalTokensP1(a)),y=new Set(lexicalTokensP1(b));let n=0;for(const t of x)if(y.has(t))n++;return n;}
function norm(v:any){return String(v??"").trim().toLowerCase();}
function cleanUrl(raw:string){return raw.replace(/[),.;\]}]+$/g,"").replace(/&amp;/g,"&");}
function slotId(seed:any){return `par_${fourAp1Sha(seed).slice(0,14)}`;}
function literalId(seed:any){return `lit_${fourAp1Sha(seed).slice(0,14)}`;}

function context(text:string,offset:number){return text.slice(Math.max(0,offset-700),Math.min(text.length,offset+1400));}

function absoluteHypotheses(evidence:DocEvidence[],caseId:string){
  const c=FOUR_A_CASES.find(row=>row.case_id===caseId);if(!c)return [] as P1RequestHypothesis[];
  const out:P1RequestHypothesis[]=[];
  for(const ev of evidence){
    if(ev.state!=="ok")continue;
    let match:RegExpExecArray|null;
    ABSOLUTE_URL.lastIndex=0;
    while((match=ABSOLUTE_URL.exec(ev.text))){
      const raw=cleanUrl(match[0]);let url:URL;try{url=new URL(raw);}catch{continue;}
      if(url.protocol!=="https:"||url.username||url.password)continue;
      if(/\.(?:png|jpe?g|gif|svg|css|m?js|woff2?|pdf|zip)(?:$|\?)/i.test(url.pathname))continue;
      const nearby=context(ev.text,match.index);
      const slots:P1RequestSlot[]=[];
      let path=url.pathname||"/",concrete=false;
      for(const ph of [...path.matchAll(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g)]){
        slots.push({id:slotId({ev:ev.evidence_id,url:raw,in:"path",name:ph[1]}),name:ph[1],in:"path",required:true,auth_like:AUTH_LIKE.test(ph[1]),literals:[]});
      }
      for(const [name,value] of url.searchParams){
        slots.push({id:slotId({ev:ev.evidence_id,url:raw,in:"query",name}),name,in:"query",required:false,auth_like:AUTH_LIKE.test(name),literals:value?[{id:literalId({ev:ev.evidence_id,name,value}),value}]:[]});
      }
      const bindings:Record<string,string>={};const used=new Set<string>();let score=0,valid=true;
      for(const inputName of c.input_names){
        const build=String(c.build[inputName]??"");
        let candidates=slots.filter(s=>!s.auth_like&&!used.has(s.id)).map(s=>({s,score:overlap(inputName,s.name)*120+(s.literals.some(l=>norm(l.value)===norm(build))?220:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
        if(!candidates.length&&c.input_names.length===1){
          const nonAuth=slots.filter(s=>!s.auth_like&&!used.has(s.id));
          if(nonAuth.length===1&&GENERIC_SINGLE_SLOT.test(nonAuth[0].name))candidates=[{s:nonAuth[0],score:35}];
        }
        if(!candidates.length&&build.length>=3&&!path.includes("{")&&overlap(inputName,nearby)>0){
          const segs=path.split("/");const matches:number[]=[];
          for(let i=0;i<segs.length;i++){let d=segs[i];try{d=decodeURIComponent(d);}catch{}if(norm(d)===norm(build))matches.push(i);}
          if(matches.length===1){const i=matches[0];segs[i]=`{${inputName}}`;path=segs.join("/")||"/";const s:P1RequestSlot={id:slotId({ev:ev.evidence_id,url:raw,in:"path",name:inputName,concrete:true}),name:inputName,in:"path",required:true,auth_like:false,literals:[]};slots.push(s);candidates=[{s,score:190}];concrete=true;}
        }
        if(!candidates.length){valid=false;break;}
        bindings[inputName]=candidates[0].s.id;used.add(candidates[0].s.id);score+=candidates[0].score;
      }
      if(!valid||slots.some(s=>s.required&&s.auth_like))continue;
      const literals:Record<string,string>={};
      for(const s of slots){if(used.has(s.id)||s.auth_like)continue;if(s.required){valid=false;break;}if(s.literals.length===1&&/json/i.test(s.literals[0].value)&&/(?:format|response|output|type)/i.test(s.name))literals[s.id]=s.literals[0].id;}
      if(!valid)continue;
      const identity={ev:ev.evidence_id,origin:url.origin,path,bindings,literals};
      out.push({id:`req_${fourAp1Sha(identity).slice(0,16)}`,source_operation_id:`4b_abs_${fourAp1Sha(identity).slice(0,14)}`,origin:url.origin,full_path:path,proof_type:"4b_absolute_request",evidence_ids:[ev.evidence_id],source_urls:[ev.resolved_url||ev.requested_url],slots,input_bindings:bindings,literal_bindings:literals,score:300+score,concrete_relation:concrete});
    }
  }
  return out;
}

function sameEvidenceProven(h:P1RequestHypothesis,evidence:DocEvidence[]){
  for(const id of h.evidence_ids){
    const ev=evidence.find(x=>x.evidence_id===id&&x.state==="ok");if(!ev)continue;
    const pathParts=h.full_path.split(/\{[^}]+\}/).filter(x=>x.length>=2);
    const originSeen=ev.text.includes(h.origin);
    const pathSeen=pathParts.length>0&&pathParts.every(p=>ev.text.includes(p));
    if(originSeen&&pathSeen)return true;
  }
  return false;
}

export function buildRequestGraph4B(evidence:DocEvidence[],caseId:string){
  const inherited=buildRequestHypothesesP1(evidence,caseId);
  const inheritedProven=inherited.hypotheses.filter(h=>sameEvidenceProven(h,evidence));
  const rejected=inherited.hypotheses.length-inheritedProven.length;
  const absolute=absoluteHypotheses(evidence,caseId);
  const all=[...absolute,...inheritedProven];
  const dedup=new Map<string,P1RequestHypothesis>();
  for(const h of all){const key=fourAp1Sha({origin:h.origin,path:h.full_path,inputs:h.input_bindings,literals:h.literal_bindings});const p=dedup.get(key);if(!p||h.score>p.score)dedup.set(key,h);}
  const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const origins=new Set(hypotheses.map(h=>h.origin));
  const metrics:RequestGraphMetrics={requestGraphNodes:evidence.filter(e=>e.state==="ok").length+origins.size+hypotheses.length+hypotheses.reduce((n,h)=>n+h.slots.length,0),requestGraphEdges:hypotheses.reduce((n,h)=>n+2+h.evidence_ids.length+h.slots.length,0),provenApiOrigins:origins.size,provenRequestTemplates:hypotheses.length,unboundRelativePaths:rejected,crossSourceJoinRejects:rejected,documentationOriginFallbacks:0};
  return {hypotheses,probe_packet:hypotheses.slice(0,FOUR_AP1_MAX_PROBES_PER_PROVIDER),inventory_fingerprint:fourAp1Sha({inherited:inherited.inventory_fingerprint,absolute:absolute.map(h=>h.id)}),request_fingerprint:fourAp1Sha(hypotheses),graph_fingerprint:fourAp1Sha(metrics),metrics};
}
