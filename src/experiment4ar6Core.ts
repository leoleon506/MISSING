import {createHash} from "node:crypto";
import {isIP} from "node:net";
import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";

export const FOUR_AR6_BASE_SHA="a5beb7049dcceadcd7e40b6190fa453ba22e4f79";
export const FOUR_AR6_FROZEN_RUN=33033653560;
export const FOUR_AR6_FROZEN_ARTIFACT=9631986496;
export const FOUR_AR6_FROZEN_DIGEST="sha256:30edd3ba75e1aa384d4193a13d4e52843da0af1d5dcecd8a4b229a2efbbafac0";
export const FOUR_AR6_FROZEN_REPORT_FP="66c775d9532df7a10521a0d2a2bea3c19c192be4c52401f3b774e39c1e673105";
export const FOUR_AR6_FROZEN_LEDGER_FP="cbdcf9b7a51feff4d00b2d7ff1fa48b2dcb4396b2afee8e0303e4e6ac6aa049e";
export const FOUR_AR6_MAX_OPERATIONS=24;

export const fourAr6Sha=(v:any)=>createHash("sha256")
  .update(typeof v==="string"?v:JSON.stringify(v))
  .digest("hex");

type Param={
  name:string;
  in:"path"|"query";
  required:boolean;
  literals:string[];
};

export type DocumentedOperation={
  operation_id:string;
  origin:string;
  base_path:string;
  operation_path:string;
  full_path:string;
  method:"GET";
  path_parameters:Param[];
  query_parameters:Param[];
  response_paths:string[];
  evidence_ids:string[];
  source_urls:string[];
  proof_type:"openapi"|"url_example";
  score:number;
};

export type R6Selection={
  decision:"COMPILE"|"REJECT";
  operation_index:number;
  path_bindings:{parameter_index:number;input_name:string}[];
  query_bindings:{
    parameter_index:number;
    source_kind:"INPUT"|"LITERAL"|"OMIT";
    input_name:string|null;
    literal_index:number|null;
  }[];
  output_mappings:{
    output_name:string;
    source_kind:"FIELD"|"INPUT";
    response_path_index:number|null;
    input_name:string|null;
  }[];
  reason:string;
};

function refResolve(spec:any,node:any) {
  if(!node||typeof node!=="object"||typeof node.$ref!=="string"||!node.$ref.startsWith("#/")) return node;
  let cur=spec;
  for(const raw of node.$ref.slice(2).split("/")) {
    const key=raw.replace(/~1/g,"/").replace(/~0/g,"~");
    cur=cur?.[key];
  }
  return cur??node;
}

function schemaPaths(spec:any,schema:any,prefix="",depth=0,seen=new Set<any>()):string[] {
  schema=refResolve(spec,schema);
  if(!schema||typeof schema!=="object"||depth>6||seen.has(schema)) return [];
  seen.add(schema);
  const out:string[]=[];
  if(schema.properties&&typeof schema.properties==="object") {
    for(const [key,value] of Object.entries(schema.properties)) {
      const path=prefix?`${prefix}.${key}`:key;
      out.push(path);
      out.push(...schemaPaths(spec,value,path,depth+1,new Set(seen)));
    }
  }
  if(schema.items) {
    const itemPrefix=prefix?`${prefix}.0`:"0";
    out.push(...schemaPaths(spec,schema.items,itemPrefix,depth+1,new Set(seen)));
  }
  for(const key of ["allOf","oneOf","anyOf"]) {
    if(Array.isArray(schema[key])) {
      for(const child of schema[key]) out.push(...schemaPaths(spec,child,prefix,depth+1,new Set(seen)));
    }
  }
  return [...new Set(out)];
}

function responsePaths(spec:any,responses:any):string[] {
  const out:string[]=[];
  for(const [code,response0] of Object.entries(responses||{})) {
    if(!/^2\d\d$/.test(code)&&code!=="default") continue;
    const response:any=refResolve(spec,response0);
    for(const media of Object.values(response?.content||{}) as any[]) {
      out.push(...schemaPaths(spec,media?.schema));
    }
    if(response?.schema) out.push(...schemaPaths(spec,response.schema));
  }
  return [...new Set(out)].slice(0,200);
}

function literalsFrom(spec:any,param:any):string[] {
  const values:any[]=[];
  const schema=refResolve(spec,param?.schema)||param?.schema||{};
  if(Array.isArray(schema?.enum)) values.push(...schema.enum);
  values.push(param?.example,param?.default,schema?.example,schema?.default);
  if(param?.examples&&typeof param.examples==="object") {
    for(const item of Object.values(param.examples) as any[]) values.push(item?.value??item);
  }
  return [...new Set(values
    .filter(v=>v!==undefined&&v!==null&&["string","number","boolean"].includes(typeof v))
    .map(String))].slice(0,16);
}

function normalizedBasePath(path:string) {
  const raw=String(path||"").trim();
  if(!raw||raw==="/") return "";
  const normalized=(raw.startsWith("/")?raw:`/${raw}`).replace(/\/+$/g,"");
  return normalized==="/"?"":normalized;
}

function normalizedOperationPath(path:string) {
  let value=String(path||"").trim()
    .replace(/%7B/gi,"{")
    .replace(/%7D/gi,"}")
    .replace(/<([A-Za-z_][A-Za-z0-9_-]*)>/g,"{$1}")
    .replace(/:([A-Za-z_][A-Za-z0-9_-]*)(?=\/|$)/g,"{$1}");
  if(!value.startsWith("/")) value=`/${value}`;
  return value.replace(/\/{2,}/g,"/");
}

function combine(base:string,operation:string) {
  return `${normalizedBasePath(base)}${normalizedOperationPath(operation)}`.replace(/\/{2,}/g,"/")||"/";
}

function staticServers(spec:any,resolvedUrl:string) {
  const out:{origin:string;base_path:string}[]=[];
  const add=(raw:string)=>{
    try {
      if(raw.includes("{")) return;
      const u=new URL(raw,resolvedUrl);
      if(u.protocol!=="https:"||u.username||u.password||isIP(u.hostname)||u.search||u.hash) return;
      out.push({origin:u.origin,base_path:normalizedBasePath(u.pathname)});
    } catch {}
  };

  for(const server of spec?.servers||[]) if(typeof server?.url==="string") add(server.url);
  if(spec?.host) {
    const schemes=Array.isArray(spec.schemes)?spec.schemes:["https"];
    if(schemes.includes("https")) add(`https://${spec.host}${spec.basePath||""}`);
  }
  if(!out.length) {
    try {
      const u=new URL(resolvedUrl);
      if(u.protocol==="https:"&&!isIP(u.hostname)) out.push({origin:u.origin,base_path:""});
    } catch {}
  }
  return [...new Map(out.map(x=>[`${x.origin}${x.base_path}`,x])).values()];
}

function parameterRows(spec:any,item:any,operation:any):Param[] {
  return [...(item?.parameters||[]),...(operation?.parameters||[])]
    .map((x:any)=>refResolve(spec,x))
    .filter((p:any)=>p&&["path","query"].includes(p.in)&&typeof p.name==="string")
    .map((p:any):Param=>({
      name:p.name,
      in:p.in==="path"?"path":"query",
      required:p.in==="path"||Boolean(p.required),
      literals:literalsFrom(spec,p)
    }));
}

export function specSummaryR6(spec:any,caseId:string,resolvedUrl:string) {
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  const servers=staticServers(spec,resolvedUrl);
  const operations:any[]=[];

  for(const [path,item] of Object.entries(spec?.paths||{}) as any[]) {
    const operation=item?.get;
    if(!operation) continue;
    const parameters=parameterRows(spec,item,operation);
    const response_paths=responsePaths(spec,operation.responses||{});
    const hay=[
      path,
      operation.operationId||"",
      operation.summary||"",
      operation.description||"",
      parameters.map(p=>p.name).join(" "),
      response_paths.join(" ")
    ].join(" ").toLowerCase();
    let relevance=0;
    for(const input of c?.input_names||[]) if(hay.includes(input.toLowerCase())) relevance+=8;
    for(const output of c?.required||[]) if(hay.includes(output.toLowerCase())) relevance+=10;
    if(/search|lookup|decode|detail|metadata/.test(hay)) relevance+=2;
    operations.push({
      method:"GET",
      path:normalizedOperationPath(path),
      operation_id:operation.operationId||null,
      summary:operation.summary||null,
      parameters,
      response_paths,
      relevance
    });
  }

  operations.sort((a,b)=>b.relevance-a.relevance||a.path.localeCompare(b.path));
  return `R6_VERIFIED_API_SPEC\n${JSON.stringify({
    servers,
    operation_count:operations.length,
    response_property_count:[...new Set(operations.flatMap(x=>x.response_paths as string[]))].length,
    operations:operations.slice(0,80)
  },null,2)}`;
}

function decodeText(s:string) {
  return s
    .replace(/&quot;|&#34;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">");
}

function jsonPaths(value:any,prefix="",depth=0):string[] {
  if(depth>6||value===null||value===undefined) return [];
  const out:string[]=[];
  if(Array.isArray(value)) {
    if(value.length) {
      const path=prefix?`${prefix}.0`:"0";
      out.push(path,...jsonPaths(value[0],path,depth+1));
    }
  } else if(typeof value==="object") {
    for(const [key,child] of Object.entries(value)) {
      const path=prefix?`${prefix}.${key}`:key;
      out.push(path,...jsonPaths(child,path,depth+1));
    }
  }
  return [...new Set(out)];
}

function exampleJsonPaths(text:string) {
  const decoded=decodeText(text);
  const out:string[]=[];
  const blocks=[
    ...decoded.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi),
    ...decoded.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)
  ];
  for(const match of blocks) {
    const raw=match[1].replace(/<[^>]+>/g,"").trim();
    try { out.push(...jsonPaths(JSON.parse(raw))); } catch {}
  }
  return [...new Set(out)].slice(0,160);
}

function caseScore(caseId:string,op:{
  operation_path:string;
  path_parameters:Param[];
  query_parameters:Param[];
  response_paths:string[];
}) {
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c) return 0;
  const hay=`${op.operation_path} ${op.path_parameters.map(x=>x.name).join(" ")} ${op.query_parameters.map(x=>x.name).join(" ")} ${op.response_paths.join(" ")}`.toLowerCase();
  let score=0;
  for(const input of c.input_names) {
    if(hay.includes(input.toLowerCase())||input.split("_").some(token=>token.length>2&&hay.includes(token))) score+=8;
  }
  for(const output of c.required) if(hay.includes(output.toLowerCase())) score+=10;
  return score;
}

function parseSummary(e:DocEvidence,caseId:string):DocumentedOperation[] {
  if(!e.text.startsWith("R6_VERIFIED_API_SPEC")) return [];
  let summary:any;
  try { summary=JSON.parse(e.text.slice(e.text.indexOf("\n")+1)); } catch { return []; }
  const out:DocumentedOperation[]=[];

  for(const server of summary.servers||[]) {
    for(const operation of summary.operations||[]) {
      if(operation.method!=="GET") continue;
      const params:Param[]=(Array.isArray(operation.parameters)?operation.parameters:[])
        .filter((p:any)=>p&&typeof p.name==="string"&&["path","query"].includes(p.in))
        .map((p:any):Param=>({
          name:p.name,
          in:p.in==="path"?"path":"query",
          required:Boolean(p.required)||p.in==="path",
          literals:Array.isArray(p.literals)?p.literals.map(String):[]
        }));
      const response_paths:string[]=Array.isArray(operation.response_paths)
        ? Array.from(new Set<string>((operation.response_paths as any[]).map(x=>String(x))))
        : [];
      const base_path=normalizedBasePath(server.base_path||"");
      const operation_path=normalizedOperationPath(operation.path);
      const full_path=combine(base_path,operation_path);
      const partial={
        origin:String(server.origin||""),
        base_path,
        operation_path,
        full_path,
        method:"GET" as const,
        path_parameters:params.filter(x=>x.in==="path"),
        query_parameters:params.filter(x=>x.in==="query"),
        response_paths,
        evidence_ids:[e.evidence_id],
        source_urls:[e.resolved_url],
        proof_type:"openapi" as const
      };
      if(!/^https:\/\//.test(partial.origin)) continue;
      const operation_id=`op_${fourAr6Sha({
        origin:partial.origin,
        full_path,
        params,
        response_paths,
        evidence_id:e.evidence_id
      }).slice(0,16)}`;
      const documented:DocumentedOperation={
        operation_id,
        ...partial,
        score:caseScore(caseId,partial)
      };
      out.push(documented);
    }
  }
  return out;
}

function absExamples(e:DocEvidence,caseId:string):DocumentedOperation[] {
  const text=decodeText(e.text);
  const out:DocumentedOperation[]=[];
  const re=/https:\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`\])}]*/g;
  let match:RegExpExecArray|null;

  while((match=re.exec(text))) {
    const raw=match[0].replace(/[.,;:]+$/g,"");
    try {
      const marker=raw.indexOf("?");
      const noQuery=marker>=0?raw.slice(0,marker):raw;
      const query=marker>=0?raw.slice(marker+1):"";
      const u=new URL(noQuery.replace(/<([A-Za-z_][A-Za-z0-9_-]*)>/g,"{$1}"));
      if(u.protocol!=="https:"||u.username||u.password||isIP(u.hostname)) continue;

      const operation_path=normalizedOperationPath(decodeURIComponent(u.pathname));
      const pathNames=[...operation_path.matchAll(/\{([^}]+)\}/g)].map(x=>x[1]);
      const queryParams=new URLSearchParams(query);
      const query_parameters:Param[]=[];
      for(const name of new Set([...queryParams.keys()])) {
        query_parameters.push({
          name,
          in:"query",
          required:false,
          literals:[...new Set(queryParams.getAll(name))].slice(0,8)
        });
      }
      const window=text.slice(
        Math.max(0,match.index-2400),
        Math.min(text.length,match.index+raw.length+3200)
      );
      const response_paths=exampleJsonPaths(window);
      const path_parameters:Param[]=pathNames.map(name=>({
        name,
        in:"path",
        required:true,
        literals:[]
      }));
      const partial={
        origin:u.origin,
        base_path:"",
        operation_path,
        full_path:operation_path,
        method:"GET" as const,
        path_parameters,
        query_parameters,
        response_paths,
        evidence_ids:[e.evidence_id],
        source_urls:[e.resolved_url],
        proof_type:"url_example" as const
      };
      const operation_id=`op_${fourAr6Sha({
        origin:partial.origin,
        path:partial.full_path,
        path_parameters,
        query_parameters,
        evidence_id:e.evidence_id
      }).slice(0,16)}`;
      out.push({
        operation_id,
        ...partial,
        score:caseScore(caseId,partial)
      });
    } catch {}
  }
  return out;
}

export function extractDocumentedOperationsR6(evidence:DocEvidence[],caseId:string):DocumentedOperation[] {
  const all:DocumentedOperation[]=[];
  for(const e of evidence.filter(x=>x.state==="ok")) {
    all.push(...parseSummary(e,caseId),...absExamples(e,caseId));
  }

  const byFacts=new Map<string,DocumentedOperation>();
  for(const op of all) {
    const key=fourAr6Sha({
      origin:op.origin,
      path:op.full_path,
      path_parameters:op.path_parameters.map(x=>[x.name,x.in,x.required]),
      query_parameters:op.query_parameters.map(x=>[x.name,x.in,x.required,x.literals]),
      response_paths:op.response_paths
    });
    const previous=byFacts.get(key);
    if(!previous) {
      byFacts.set(key,op);
    } else {
      previous.evidence_ids=[...new Set([...previous.evidence_ids,...op.evidence_ids])];
      previous.source_urls=[...new Set([...previous.source_urls,...op.source_urls])];
      previous.score=Math.max(previous.score,op.score);
    }
  }

  const rows=[...byFacts.values()].sort((a,b)=>
    b.score-a.score||
    (a.proof_type==="openapi"?-1:1)-(b.proof_type==="openapi"?-1:1)||
    a.origin.localeCompare(b.origin)||
    a.full_path.localeCompare(b.full_path)
  );

  return rows.slice(0,FOUR_AR6_MAX_OPERATIONS).map((op,index)=>({
    ...op,
    operation_id:`r6o${String(index).padStart(2,"0")}_${fourAr6Sha({
      origin:op.origin,
      path:op.full_path,
      evidence_ids:op.evidence_ids
    }).slice(0,10)}`
  }));
}

export function operationPacketFingerprintR6(ops:DocumentedOperation[]) {
  return fourAr6Sha(ops.map(x=>({
    operation_id:x.operation_id,
    origin:x.origin,
    base_path:x.base_path,
    operation_path:x.operation_path,
    full_path:x.full_path,
    path_parameters:x.path_parameters,
    query_parameters:x.query_parameters,
    response_paths:x.response_paths,
    evidence_ids:x.evidence_ids,
    proof_type:x.proof_type,
    score:x.score
  })));
}

export function materializeSelectionR6(
  caseId:string,
  providerId:string,
  ops:DocumentedOperation[],
  selection:R6Selection
) {
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c) throw new Error("r6_unknown_case");
  if(selection.decision!=="COMPILE") {
    return {
      raw:{case_id:caseId,provider_candidate_id:providerId,decision:"REJECT",reason:selection.reason},
      operation:null,
      proof:null
    };
  }

  const op=ops[selection.operation_index];
  if(!op) throw new Error("r6_operation_index_invalid");
  const path_bindings:Record<string,string>={};
  const query_bindings:Record<string,string>={};

  for(const binding of selection.path_bindings) {
    const parameter=op.path_parameters[binding.parameter_index];
    if(!parameter) throw new Error("r6_path_parameter_index_invalid");
    if(!c.input_names.includes(binding.input_name)) throw new Error("r6_path_input_invalid");
    if(path_bindings[parameter.name]!==undefined) throw new Error("r6_duplicate_path_binding");
    path_bindings[parameter.name]=`$input.${binding.input_name}`;
  }
  for(const parameter of op.path_parameters) {
    if(!(parameter.name in path_bindings)) throw new Error(`r6_unbound_path:${parameter.name}`);
  }

  for(const binding of selection.query_bindings) {
    const parameter=op.query_parameters[binding.parameter_index];
    if(!parameter) throw new Error("r6_query_parameter_index_invalid");
    if(binding.source_kind==="OMIT") {
      if(parameter.required) throw new Error(`r6_required_query_omitted:${parameter.name}`);
      continue;
    }
    if(query_bindings[parameter.name]!==undefined) throw new Error("r6_duplicate_query_binding");
    if(binding.source_kind==="INPUT") {
      if(!binding.input_name||!c.input_names.includes(binding.input_name)) throw new Error("r6_query_input_invalid");
      query_bindings[parameter.name]=`$input.${binding.input_name}`;
    } else {
      const literal=binding.literal_index===null?undefined:parameter.literals[binding.literal_index];
      if(literal===undefined) throw new Error("r6_query_literal_index_invalid");
      query_bindings[parameter.name]=literal;
    }
  }
  for(const parameter of op.query_parameters) {
    if(parameter.required&&query_bindings[parameter.name]===undefined) {
      throw new Error(`r6_required_query_unbound:${parameter.name}`);
    }
  }

  const projection:ProjectionPlan={};
  const seen=new Set<string>();
  for(const mapping of selection.output_mappings) {
    if(!c.required.includes(mapping.output_name)||seen.has(mapping.output_name)) throw new Error("r6_output_name_invalid");
    seen.add(mapping.output_name);
    if(mapping.source_kind==="INPUT") {
      if(!mapping.input_name||!c.input_names.includes(mapping.input_name)) throw new Error("r6_output_input_invalid");
      projection[mapping.output_name]={op:"INPUT",name:mapping.input_name} as any;
    } else {
      const path=mapping.response_path_index===null?undefined:op.response_paths[mapping.response_path_index];
      if(!path) throw new Error("r6_response_path_index_invalid");
      projection[mapping.output_name]={op:"FIELD",path} as any;
    }
  }
  for(const output of c.required) if(!seen.has(output)) throw new Error(`r6_missing_output:${output}`);

  const raw:any={
    case_id:caseId,
    provider_candidate_id:providerId,
    decision:"COMPILE",
    method:"GET",
    base_url:op.origin,
    path_template:op.full_path,
    path_bindings,
    query_bindings,
    evidence_ids:op.evidence_ids,
    reason:`R6_OPERATION:${op.operation_id}`,
    projection
  };

  return {
    raw,
    operation:op,
    proof:{
      operation_id:op.operation_id,
      proof_type:op.proof_type,
      evidence_ids:op.evidence_ids,
      source_urls:op.source_urls,
      input_mapping:{path:path_bindings,query:query_bindings},
      output_mapping:projection
    }
  };
}

export function contractFromR6Raw(raw:any):MicroContract {
  return {
    case_id:raw.case_id,
    provider_candidate_id:raw.provider_candidate_id,
    decision:raw.decision,
    method:raw.method,
    base_url:raw.base_url,
    path_template:raw.path_template,
    path_bindings:raw.path_bindings,
    query_bindings:raw.query_bindings,
    evidence_ids:raw.evidence_ids,
    reason:raw.reason
  };
}
