import {isIP} from "node:net";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {
  FOUR_AR6R_MAX_INVENTORY,
  FOUR_AR6R_MAX_PACKET,
  fourAr6rSha,
  operationFacts,
  type EndpointReject,
  type R6RInventory,
  type R6ROperation,
  type R6ROperationFacts,
  type R6RParam
} from "./experiment4ar6rModel.js";

function decodeHtml(text:string){
  return text
    .replace(/&quot;|&#34;|&#x22;/gi,'"')
    .replace(/&#39;|&apos;|&#x27;/gi,"'")
    .replace(/&amp;/gi,"&")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#91;|&#x5b;/gi,"[")
    .replace(/&#93;|&#x5d;/gi,"]")
    .replace(/&#123;|&#x7b;/gi,"{")
    .replace(/&#125;|&#x7d;/gi,"}");
}

function stripTags(text:string){
  return decodeHtml(text)
    .replace(/<\/?(?:code|pre|span|a|div|p|li|strong|em|kbd|samp|var)(?:\s[^>]*)?>/gi,"")
    .trim();
}

function cleanEndpointToken(raw:string){
  let value=stripTags(raw).trim();
  value=value
    .replace(/^['"`(]+/,"")
    .replace(/['"`,;.)]+$/g,"")
    .replace(/\\u003[cC]/g,"<")
    .replace(/\\u003[eE]/g,">");
  try{value=decodeURIComponent(value);}catch{}
  return value;
}

export function canonicalizeEndpointTemplateR6R(raw:string){
  return cleanEndpointToken(raw)
    .replace(/%7B/gi,"{")
    .replace(/%7D/gi,"}")
    .replace(/%3C/gi,"<")
    .replace(/%3E/gi,">")
    .replace(/%5B/gi,"[")
    .replace(/%5D/gi,"]")
    .replace(/<([A-Za-z_][A-Za-z0-9_.-]*)>/g,"{$1}")
    .replace(/\[([A-Za-z_][A-Za-z0-9_.-]*)\]/g,"{$1}")
    .replace(/:([A-Za-z_][A-Za-z0-9_.-]*)(?=\/|\?|&|$)/g,"{$1}");
}

function normalizedBasePath(path:string){
  const raw=String(path||"").trim();
  if(!raw||raw==="/")return "";
  const normalized=(raw.startsWith("/")?raw:`/${raw}`)
    .replace(/\/{2,}/g,"/")
    .replace(/\/+$/g,"");
  return normalized==="/"?"":normalized;
}

function normalizedOperationPath(path:string){
  let value=canonicalizeEndpointTemplateR6R(path);
  const query=value.indexOf("?");
  if(query>=0)value=value.slice(0,query);
  if(!value.startsWith("/"))value=`/${value}`;
  return value.replace(/\/{2,}/g,"/");
}

function combine(base:string,path:string){
  return `${normalizedBasePath(base)}${normalizedOperationPath(path)}`
    .replace(/\/{2,}/g,"/")||"/";
}

function pathParameterNames(path:string){
  return [...path.matchAll(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g)].map(match=>match[1]);
}

function approximateRegistrable(host:string){
  const labels=host.toLowerCase().split(".").filter(Boolean);
  if(labels.length<=2)return labels.join(".");
  const tld=labels.at(-1)!;
  const second=labels.at(-2)!;
  const multiLabelCc=tld.length===2&&second.length<=3;
  return labels.slice(multiLabelCc?-3:-2).join(".");
}

function sameSite(a:string,b:string){
  try{
    const left=new URL(a),right=new URL(b);
    return left.hostname===right.hostname||approximateRegistrable(left.hostname)===approximateRegistrable(right.hostname);
  }catch{return false;}
}

const STATIC_EXT=/\.(?:m?js|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|ico|bmp|mp4|webm|mov|avi|zip|tar|tgz|gz|7z|rar|pdf)(?:[?#]|$)/i;
const NAV_PATH=/(?:^|\/)(?:privacy|terms|legal|license|community|contact|about|login|signin|signup|register|account|blog|news|careers?|press|status)(?:\/|$)/i;
const GENERIC_API_PATH=/(?:^|\/)(?:api|v\d+|rest|graphql|search|lookup|decode|detail|metadata|query|resource|endpoint)(?:\/|$|\?)/i;

function apiRejectReason(raw:string,evidenceUrl:string,context:string){
  const value=cleanEndpointToken(raw);
  if(!value)return "empty";
  if(/^(?:mailto:|tel:|javascript:|#)/i.test(value))return "non_http_scheme";
  if(STATIC_EXT.test(value))return "static_asset";
  if(/^http:\/\//i.test(value))return "non_https";
  if(/^https:\/\//i.test(value)&&!sameSite(value,evidenceUrl))return "cross_site";
  if(NAV_PATH.test(value)&&!/[?{[]/.test(value))return "navigation_path";
  if(!/^https:\/\//i.test(value)&&!value.startsWith("/"))return "not_endpoint_shape";
  if(
    value.startsWith("/")&&
    !/[?{[]/.test(value)&&
    !GENERIC_API_PATH.test(value)&&
    !/(?:GET|curl|endpoint|request|response|example|api)/i.test(context)
  )return "weak_relative_context";
  return null;
}

function refResolve(spec:any,node:any){
  if(!node||typeof node!=="object"||typeof node.$ref!=="string"||!node.$ref.startsWith("#/"))return node;
  let current=spec;
  for(const raw of node.$ref.slice(2).split("/")){
    const key=raw.replace(/~1/g,"/").replace(/~0/g,"~");
    current=current?.[key];
  }
  return current??node;
}

function schemaPaths(spec:any,schema:any,prefix="",depth=0,seen=new Set<any>()):string[]{
  schema=refResolve(spec,schema);
  if(!schema||typeof schema!=="object"||depth>7||seen.has(schema))return [];
  seen.add(schema);
  const out:string[]=[];
  if(schema.properties&&typeof schema.properties==="object"){
    for(const [key,value] of Object.entries(schema.properties)){
      const path=prefix?`${prefix}.${key}`:key;
      out.push(path,...schemaPaths(spec,value,path,depth+1,new Set(seen)));
    }
  }
  if(schema.items){
    const path=prefix?`${prefix}.0`:"0";
    out.push(path,...schemaPaths(spec,schema.items,path,depth+1,new Set(seen)));
  }
  for(const key of ["allOf","oneOf","anyOf"]){
    if(Array.isArray(schema[key])){
      for(const child of schema[key])out.push(...schemaPaths(spec,child,prefix,depth+1,new Set(seen)));
    }
  }
  return [...new Set(out)];
}

function responsePaths(spec:any,responses:any){
  const out:string[]=[];
  for(const [code,response0] of Object.entries(responses||{})){
    if(!/^2\d\d$/.test(code)&&code!=="default")continue;
    const response:any=refResolve(spec,response0);
    for(const media of Object.values(response?.content||{}) as any[]){
      out.push(...schemaPaths(spec,media?.schema));
    }
    if(response?.schema)out.push(...schemaPaths(spec,response.schema));
  }
  return [...new Set(out)].slice(0,240);
}

function literalsFrom(spec:any,param:any){
  const schema=refResolve(spec,param?.schema)||param?.schema||{};
  const values:any[]=[];
  if(Array.isArray(schema.enum))values.push(...schema.enum);
  values.push(param?.example,param?.default,schema?.example,schema?.default);
  if(param?.examples&&typeof param.examples==="object"){
    for(const example of Object.values(param.examples) as any[])values.push(example?.value??example);
  }
  return [...new Set(values
    .filter(value=>value!==undefined&&value!==null&&["string","number","boolean"].includes(typeof value))
    .map(String))].slice(0,20);
}

function applyServerVariables(raw:string,server:any){
  let value=raw;
  for(const match of value.matchAll(/\{([^}]+)\}/g)){
    const replacement=server?.variables?.[match[1]]?.default;
    if(replacement===undefined||replacement===null)return null;
    value=value.replace(match[0],String(replacement));
  }
  return /\{[^}]+\}/.test(value)?null:value;
}

export function normalizeOpenApiServersR6R(spec:any,resolvedUrl:string){
  const out:{origin:string;base_path:string}[]=[];
  const add=(raw0:string,server?:any)=>{
    const substituted=applyServerVariables(String(raw0||"").trim(),server);
    if(!substituted)return;
    try{
      let url:URL;
      if(/^https:\/\//i.test(substituted))url=new URL(substituted);
      else if(/^\/\//.test(substituted))url=new URL(`https:${substituted}`);
      else if(substituted.startsWith("/"))url=new URL(substituted,new URL(resolvedUrl).origin);
      else if(/^[A-Za-z0-9.-]+(?::\d+)?(?:\/|$)/.test(substituted)&&substituted.split("/")[0].includes(".")){
        url=new URL(`https://${substituted}`);
      }else url=new URL(substituted,resolvedUrl);
      if(url.protocol!=="https:"||url.username||url.password||isIP(url.hostname)||url.search||url.hash)return;
      out.push({origin:url.origin,base_path:normalizedBasePath(url.pathname)});
    }catch{}
  };

  for(const server of spec?.servers||[])if(typeof server?.url==="string")add(server.url,server);
  if(spec?.host){
    const schemes=Array.isArray(spec.schemes)?spec.schemes:["https"];
    if(schemes.map((value:any)=>String(value).toLowerCase()).includes("https")){
      add(`https://${spec.host}${spec.basePath||""}`);
    }
  }
  if(!out.length){
    try{
      const url=new URL(resolvedUrl);
      if(url.protocol==="https:"&&!isIP(url.hostname))out.push({origin:url.origin,base_path:""});
    }catch{}
  }
  return [...new Map(out.map(value=>[`${value.origin}${value.base_path}`,value])).values()];
}

function parameterRows(spec:any,item:any,operation:any):R6RParam[]{
  return [...(item?.parameters||[]),...(operation?.parameters||[])]
    .map((value:any)=>refResolve(spec,value))
    .filter((param:any)=>param&&["path","query"].includes(param.in)&&typeof param.name==="string")
    .map((param:any):R6RParam=>({
      name:param.name,
      in:param.in==="path"?"path":"query",
      required:param.in==="path"||Boolean(param.required),
      literals:literalsFrom(spec,param)
    }));
}

export function specSummaryR6R(spec:any,_caseId:string,resolvedUrl:string){
  const servers=normalizeOpenApiServersR6R(spec,resolvedUrl);
  const operations:any[]=[];
  for(const [path,item] of Object.entries(spec?.paths||{}) as any[]){
    const operation=item?.get;
    if(!operation)continue;
    operations.push({
      method:"GET",
      path:normalizedOperationPath(path),
      operation_id:operation.operationId||null,
      summary:operation.summary||null,
      description:operation.description||null,
      parameters:parameterRows(spec,item,operation),
      response_paths:responsePaths(spec,operation.responses||{})
    });
  }
  return `R6R_VERIFIED_API_SPEC\n${JSON.stringify({servers,operation_count:operations.length,operations},null,2)}`;
}

function jsonPaths(value:any,prefix="",depth=0):string[]{
  if(depth>7||value===null||value===undefined)return [];
  const out:string[]=[];
  if(Array.isArray(value)){
    if(value.length){
      const path=prefix?`${prefix}.0`:"0";
      out.push(path,...jsonPaths(value[0],path,depth+1));
    }
  }else if(typeof value==="object"){
    for(const [key,child] of Object.entries(value)){
      const path=prefix?`${prefix}.${key}`:key;
      out.push(path,...jsonPaths(child,path,depth+1));
    }
  }
  return [...new Set(out)];
}

type JsonBlock={start:number;end:number;paths:string[]};

function jsonBlocks(text0:string):JsonBlock[]{
  const text=decodeHtml(text0);
  const blocks:JsonBlock[]=[];
  const regexes=[
    /```(?:json|javascript|js)?\s*([\s\S]*?)```/gi,
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    /<code[^>]*>([\s\S]*?)<\/code>/gi,
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  ];
  for(const regex of regexes){
    for(const match of text.matchAll(regex)){
      const raw=stripTags(match[1]).trim();
      try{
        const paths=jsonPaths(JSON.parse(raw));
        if(paths.length)blocks.push({start:match.index??0,end:(match.index??0)+match[0].length,paths});
      }catch{}
    }
  }
  return blocks.sort((a,b)=>a.start-b.start);
}

function nearestJson(blocks:JsonBlock[],offset:number){
  let best:JsonBlock|null=null;
  let bestScore=Infinity;
  for(const block of blocks){
    const delta=block.start>=offset?block.start-offset:(offset-block.end)+1200;
    if(delta<0||delta>6500)continue;
    if(delta<bestScore){best=block;bestScore=delta;}
  }
  return best;
}

function codeRegions(text:string){
  const out:{start:number;end:number;text:string;strength:number}[]=[];
  for(const regex of [
    /```[\w-]*\s*([\s\S]*?)```/gi,
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    /<code[^>]*>([\s\S]*?)<\/code>/gi
  ]){
    for(const match of text.matchAll(regex)){
      out.push({start:match.index??0,end:(match.index??0)+match[0].length,text:stripTags(match[1]),strength:3});
    }
  }
  for(const match of text.matchAll(/(?:^|\n)[^\n]{0,80}\b(?:GET|curl)\s+([^\n]{1,500})/gi)){
    out.push({start:match.index??0,end:(match.index??0)+match[0].length,text:stripTags(match[0]),strength:4});
  }
  return out;
}

type RawEndpoint={
  evidence:DocEvidence;
  raw:string;
  offset:number;
  context:string;
  strength:number;
  absolute:boolean;
};

function rawEndpointCandidates(evidence:DocEvidence){
  const text=decodeHtml(evidence.text);
  const out:RawEndpoint[]=[];
  const seen=new Set<string>();
  const add=(raw:string,offset:number,context:string,strength:number)=>{
    const cleaned=cleanEndpointToken(raw);
    const key=`${offset}:${cleaned}`;
    if(!cleaned||seen.has(key))return;
    seen.add(key);
    out.push({evidence,raw:cleaned,offset,context,strength,absolute:/^https:\/\//i.test(cleaned)});
  };

  // Global prose scan stops at angle brackets so HTML tags cannot be appended to a URL.
  const absoluteGlobal=/https:\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`<>]*/gi;
  for(const match of text.matchAll(absoluteGlobal)){
    const offset=match.index??0;
    add(match[0],offset,text.slice(Math.max(0,offset-350),Math.min(text.length,offset+match[0].length+500)),2);
  }

  // Code/pre regions are already stripped of HTML wrappers, so angle placeholders such as <id> are safe here.
  for(const region of codeRegions(text)){
    const absoluteCode=/https:\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`]*/gi;
    for(const match of region.text.matchAll(absoluteCode)){
      add(match[0],region.start+(match.index??0),region.text,Math.min(5,region.strength+1));
    }
    const relative=/(?:^|\s)(\/[A-Za-z0-9_~.!$&'()*+,;=:@%{}<>\[\]-]+(?:\/[A-Za-z0-9_~.!$&'()*+,;=:@%{}<>\[\]-]+)*(?:\?[^\s"'`]*)?)/g;
    for(const match of region.text.matchAll(relative)){
      add(match[1],region.start+(match.index??0),region.text,region.strength);
    }
    const request=/(?:GET|curl(?:\s+-[^\s]+)*\s+)(https:\/\/[^\s"'`]+|\/[^\s"'`]+)/gi;
    for(const match of region.text.matchAll(request)){
      add(match[1],region.start+(match.index??0),region.text,5);
    }
  }
  return out;
}

function queryParamsFrom(raw:string):R6RParam[]{
  const marker=raw.indexOf("?");
  if(marker<0)return [];
  const out:R6RParam[]=[];
  for(const piece of raw.slice(marker+1).split("&")){
    if(!piece)continue;
    const eq=piece.indexOf("=");
    let name:string;
    let value:string;
    try{
      name=decodeURIComponent(eq>=0?piece.slice(0,eq):piece).trim();
      value=eq>=0?decodeURIComponent(piece.slice(eq+1)):"";
    }catch{continue;}
    if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name))continue;
    const template=/^\{[^}]+\}$/.test(canonicalizeEndpointTemplateR6R(value));
    out.push({name,in:"query",required:false,literals:template||!value?[]:[value]});
  }
  return [...new Map(out.map(value=>[value.name,value])).values()];
}

function originAndPath(raw:string,evidenceUrl:string,originOverride?:string|null){
  const canonical=canonicalizeEndpointTemplateR6R(raw);
  if(/^https:\/\//i.test(canonical)){
    const query=canonical.indexOf("?");
    const noQuery=query>=0?canonical.slice(0,query):canonical;
    try{
      const parsed=new URL(noQuery.replace(/\{[^}]+\}/g,"x"));
      const prefix=noQuery.match(/^https:\/\/[^/]+/i)?.[0]||parsed.origin;
      return {origin:parsed.origin,path:normalizedOperationPath(noQuery.slice(prefix.length)||"/")};
    }catch{return null;}
  }
  try{
    const origin=originOverride??new URL(evidenceUrl).origin;
    const parsedOrigin=new URL(origin);
    if(parsedOrigin.protocol!=="https:"||parsedOrigin.username||parsedOrigin.password||isIP(parsedOrigin.hostname))return null;
    return {origin:parsedOrigin.origin,path:normalizedOperationPath(canonical)};
  }catch{return null;}
}

function candidateAbsoluteOrigin(candidate:RawEndpoint,evidenceUrl:string){
  if(!candidate.absolute)return null;
  if(apiRejectReason(candidate.raw,evidenceUrl,candidate.context))return null;
  const parsed=originAndPath(candidate.raw,evidenceUrl);
  if(!parsed)return null;
  const hasApiSignal=candidate.strength>=3||GENERIC_API_PATH.test(parsed.path)||/[?{[]/.test(candidate.raw);
  return hasApiSignal?parsed.origin:null;
}

function relativeOriginHint(candidate:RawEndpoint,all:RawEndpoint[],evidenceUrl:string){
  if(candidate.absolute)return null;
  let best:{origin:string;distance:number}|null=null;
  for(const other of all){
    const origin=candidateAbsoluteOrigin(other,evidenceUrl);
    if(!origin)continue;
    if(!sameSite(origin,evidenceUrl))continue;
    const distance=Math.abs(other.offset-candidate.offset);
    if(distance>3000)continue;
    if(!best||distance<best.distance)best={origin,distance};
  }
  return best?.origin??null;
}

function pathShape(path:string){
  return path.split("/").filter(Boolean).map(segment=>/^\{[^}]+\}$/.test(segment)?"{}":segment.toLowerCase());
}

function compatibleTemplate(template:string,concrete:string){
  const left=pathShape(template),right=pathShape(concrete);
  if(left.length!==right.length)return false;
  let parameters=0;
  for(let index=0;index<left.length;index++){
    if(left[index]==="{}"){parameters++;continue;}
    if(left[index]!==right[index])return false;
  }
  return parameters>0;
}

function mergeParams(left:R6RParam[],right:R6RParam[]){
  const merged=new Map<string,R6RParam>();
  for(const param of [...left,...right]){
    const previous=merged.get(param.name);
    if(!previous)merged.set(param.name,{...param,literals:[...param.literals]});
    else{
      previous.required=previous.required||param.required;
      previous.literals=[...new Set([...previous.literals,...param.literals])];
    }
  }
  return [...merged.values()];
}

function lexicalTokens(value:string){
  return new Set(
    value
      .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g,"$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token=>token.length>=2)
  );
}

function overlap(left:string,right:string){
  const a=lexicalTokens(left),b=lexicalTokens(right);
  let count=0;
  for(const token of a)if(b.has(token))count++;
  return count;
}

function scoreOperation(caseId:string,operation:R6ROperationFacts){
  const c=FOUR_A_CASES.find(value=>value.case_id===caseId);
  if(!c)return 0;
  let score=0;
  const parameterText=[...operation.path_parameters,...operation.query_parameters].map(value=>value.name).join(" ");
  const responseText=operation.response_paths.join(" ");
  for(const input of c.input_names)score+=overlap(input,parameterText)*16;
  for(const output of c.required)score+=overlap(output,responseText)*22;
  score+=operation.proof_type==="openapi"?80:operation.proof_type==="endpoint_json_example"?55:20;
  score+=operation.response_paths.length?Math.min(35,operation.response_paths.length):-30;
  score+=operation.path_parameters.length||operation.query_parameters.length?18:0;
  score+=operation.api_confidence*8;
  if(operation.path_parameters.some(value=>value.required)&&!c.input_names.length)score-=30;
  return score;
}

function parseSpecEvidence(evidence:DocEvidence,caseId:string):R6ROperation[]{
  if(!evidence.text.startsWith("R6R_VERIFIED_API_SPEC"))return [];
  let summary:any;
  try{summary=JSON.parse(evidence.text.slice(evidence.text.indexOf("\n")+1));}catch{return [];}
  const out:R6ROperation[]=[];
  for(const server of summary.servers||[]){
    for(const row of summary.operations||[]){
      if(row.method!=="GET")continue;
      const params:R6RParam[]=(Array.isArray(row.parameters)?row.parameters:[])
        .filter((param:any)=>param&&typeof param.name==="string"&&["path","query"].includes(param.in))
        .map((param:any):R6RParam=>({
          name:param.name,
          in:param.in==="path"?"path":"query",
          required:param.in==="path"||Boolean(param.required),
          literals:Array.isArray(param.literals)?param.literals.map(String):[]
        }));
      const response_paths:string[]=Array.isArray(row.response_paths)
        ? Array.from(new Set<string>((row.response_paths as any[]).map(value=>String(value))))
        : [];
      const base_path=normalizedBasePath(server.base_path||"");
      const operation_path=normalizedOperationPath(row.path);
      const facts:R6ROperationFacts={
        origin:String(server.origin||""),
        base_path,
        operation_path,
        full_path:combine(base_path,operation_path),
        method:"GET",
        path_parameters:params.filter(value=>value.in==="path"),
        query_parameters:params.filter(value=>value.in==="query"),
        response_paths,
        evidence_ids:[evidence.evidence_id],
        source_urls:[evidence.resolved_url],
        proof_type:"openapi",
        api_confidence:5,
        request_offset:null,
        response_offset:null
      };
      if(!/^https:\/\//.test(facts.origin))continue;
      out.push({
        ...facts,
        score:scoreOperation(caseId,facts),
        operation_id:`spec_${fourAr6rSha({origin:facts.origin,path:facts.full_path,e:evidence.evidence_id}).slice(0,14)}`
      });
    }
  }
  return out;
}

function compileEndpointEvidence(evidence:DocEvidence,caseId:string){
  const blocks=jsonBlocks(evidence.text);
  const raw=rawEndpointCandidates(evidence);
  const rejects:EndpointReject[]=[];
  const operations:R6ROperation[]=[];

  for(const candidate of raw){
    const reason=apiRejectReason(candidate.raw,evidence.resolved_url,candidate.context);
    if(reason){
      rejects.push({evidence_id:evidence.evidence_id,raw:candidate.raw.slice(0,300),offset:candidate.offset,reason});
      continue;
    }
    const originHint=relativeOriginHint(candidate,raw,evidence.resolved_url);
    const originPath=originAndPath(candidate.raw,evidence.resolved_url,originHint);
    if(!originPath){
      rejects.push({evidence_id:evidence.evidence_id,raw:candidate.raw.slice(0,300),offset:candidate.offset,reason:"parse_failed"});
      continue;
    }
    const response=nearestJson(blocks,candidate.offset);
    const path_parameters:R6RParam[]=pathParameterNames(originPath.path).map(name=>({name,in:"path",required:true,literals:[]}));
    const query_parameters=queryParamsFrom(candidate.raw);
    const api_confidence=Math.min(
      5,
      candidate.strength+
      (GENERIC_API_PATH.test(originPath.path)?1:0)+
      (path_parameters.length||query_parameters.length?1:0)+
      (originHint?1:0)
    );
    const facts:R6ROperationFacts={
      origin:originPath.origin,
      base_path:"",
      operation_path:originPath.path,
      full_path:originPath.path,
      method:"GET",
      path_parameters,
      query_parameters,
      response_paths:response?.paths||[],
      evidence_ids:[evidence.evidence_id],
      source_urls:[evidence.resolved_url],
      proof_type:response?.paths.length?"endpoint_json_example":"endpoint_template",
      api_confidence,
      request_offset:candidate.offset,
      response_offset:response?.start??null
    };
    operations.push({
      ...facts,
      score:scoreOperation(caseId,facts),
      operation_id:`ep_${fourAr6rSha({origin:facts.origin,path:facts.full_path,q:facts.query_parameters,e:evidence.evidence_id,o:candidate.offset}).slice(0,14)}`
    });
  }

  for(const template of operations.filter(value=>value.path_parameters.length)){
    for(const concrete of operations.filter(value=>!value.path_parameters.length&&value.origin===template.origin)){
      if(!compatibleTemplate(template.operation_path,concrete.operation_path))continue;
      const templateQueries=new Set(template.query_parameters.map(value=>value.name));
      const concreteQueries=new Set(concrete.query_parameters.map(value=>value.name));
      if(templateQueries.size&&concreteQueries.size&&![...templateQueries].every(value=>concreteQueries.has(value)))continue;
      template.query_parameters=mergeParams(template.query_parameters,concrete.query_parameters);
      if(!template.response_paths.length&&concrete.response_paths.length){
        template.response_paths=[...concrete.response_paths];
        template.response_offset=concrete.response_offset;
        template.proof_type="endpoint_json_example";
      }
      template.evidence_ids=[...new Set([...template.evidence_ids,...concrete.evidence_ids])];
      template.score=scoreOperation(caseId,operationFacts(template));
    }
  }

  return {raw_count:raw.length,rejects,ops:operations};
}

function dedupeOperations(operations:R6ROperation[],caseId:string){
  const map=new Map<string,R6ROperation>();
  for(const operation of operations){
    const key=fourAr6rSha({
      origin:operation.origin,
      path:operation.full_path,
      path_parameters:operation.path_parameters.map(value=>[value.name,value.required]),
      query_parameters:operation.query_parameters.map(value=>[value.name,value.required,value.literals]),
      response_paths:operation.response_paths
    });
    const previous=map.get(key);
    if(!previous)map.set(key,{...operation});
    else{
      previous.evidence_ids=[...new Set([...previous.evidence_ids,...operation.evidence_ids])];
      previous.source_urls=[...new Set([...previous.source_urls,...operation.source_urls])];
      if(operation.proof_type==="openapi"||(!previous.response_paths.length&&operation.response_paths.length)){
        previous.response_paths=[...operation.response_paths];
        previous.proof_type=operation.proof_type;
      }
      previous.api_confidence=Math.max(previous.api_confidence,operation.api_confidence);
      previous.score=Math.max(previous.score,operation.score);
    }
  }
  const rows=[...map.values()];
  for(const operation of rows)operation.score=scoreOperation(caseId,operationFacts(operation));
  return rows.sort((a,b)=>
    b.score-a.score||
    b.api_confidence-a.api_confidence||
    (a.proof_type==="openapi"?-1:1)-(b.proof_type==="openapi"?-1:1)||
    a.origin.localeCompare(b.origin)||
    a.full_path.localeCompare(b.full_path)
  );
}

export function extractOperationInventoryR6R(evidence:DocEvidence[],caseId:string):R6RInventory{
  let rawCount=0;
  const rejects:EndpointReject[]=[];
  const operations:R6ROperation[]=[];
  for(const item of evidence.filter(value=>value.state==="ok")){
    if(item.text.startsWith("R6R_VERIFIED_API_SPEC"))operations.push(...parseSpecEvidence(item,caseId));
    else{
      const compiled=compileEndpointEvidence(item,caseId);
      rawCount+=compiled.raw_count;
      rejects.push(...compiled.rejects);
      operations.push(...compiled.ops);
    }
  }
  const inventory=dedupeOperations(operations,caseId)
    .slice(0,FOUR_AR6R_MAX_INVENTORY)
    .map((operation,index)=>({
      ...operation,
      operation_id:`r6r${String(index).padStart(2,"0")}_${fourAr6rSha({origin:operation.origin,path:operation.full_path,e:operation.evidence_ids}).slice(0,10)}`
    }));
  const packet=inventory
    .filter(operation=>operation.api_confidence>=2&&(operation.response_paths.length>0||operation.path_parameters.length>0||operation.query_parameters.length>0))
    .slice(0,FOUR_AR6R_MAX_PACKET);
  return {
    raw_candidate_count:rawCount,
    accepted_candidate_count:operations.length,
    rejected_candidate_count:rejects.length,
    rejects:rejects.slice(0,160),
    inventory,
    packet,
    inventory_fingerprint:fourAr6rSha(inventory),
    packet_fingerprint:fourAr6rSha(packet)
  };
}
