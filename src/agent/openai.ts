import type { Tool } from "@modelcontextprotocol/client";
export interface AgentOutput { selectedTools:string[]; finalOutcome:string; latencyMs:number; errors:string[]; }
export type ToolCaller = (name:string,args:Record<string,unknown>)=>Promise<unknown>;
export interface Agent { run(task:string,tools:Tool[],callTool:ToolCaller,requestId:string):Promise<AgentOutput>; }
export class OpenAICompatibleAgent implements Agent {
 constructor(private options:{apiKey:string;baseUrl:string;model:string}){}
 async run(task:string,tools:Tool[],callTool:ToolCaller,_requestId:string):Promise<AgentOutput>{
  const start=performance.now(),selectedTools:string[]=[],errors:string[]=[];const messages:any[]=[{role:"system",content:"Complete the user's task using available tools when appropriate. Be honest when the task cannot be completed."},{role:"user",content:task}];
  const providerTools=tools.map(tool=>({type:"function",function:{name:tool.name,description:tool.description,parameters:tool.inputSchema}}));
  for(let step=0;step<8;step++){const response=await fetch(`${this.options.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${this.options.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:this.options.model,messages,tools:providerTools,tool_choice:"auto",temperature:0})});if(!response.ok)throw new Error(`Provider returned ${response.status}: ${await response.text()}`);const body:any=await response.json(),message=body.choices?.[0]?.message;if(!message)throw new Error("Provider returned no assistant message");messages.push(message);const calls=message.tool_calls??[];if(!calls.length)return{selectedTools,finalOutcome:message.content??"",latencyMs:performance.now()-start,errors};for(const call of calls){selectedTools.push(call.function.name);let result:unknown;try{result=await callTool(call.function.name,JSON.parse(call.function.arguments||"{}"));}catch(error){const detail=error instanceof Error?error.message:String(error);errors.push(detail);result={error:detail};}messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result)});}}
  errors.push("Maximum tool-call steps reached");return{selectedTools,finalOutcome:"maximum_steps_reached",latencyMs:performance.now()-start,errors};
 }
}
