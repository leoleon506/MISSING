import type { ToolDefinition } from "../mcp/tools.js";
import { jsonSchema } from "../mcp/tools.js";
export interface AgentOutput { selectedTools:string[]; finalOutcome:string; latencyMs:number; errors:string[]; }
export interface Agent { run(task:string, tools:ToolDefinition[], requestId:string):Promise<AgentOutput>; }

export class OpenAICompatibleAgent implements Agent {
  constructor(private options:{apiKey:string;baseUrl:string;model:string}) {}
  async run(task:string, tools:ToolDefinition[], requestId:string):Promise<AgentOutput> {
    const start=performance.now(), selectedTools:string[]=[], errors:string[]=[];
    const messages:any[]=[{role:"system",content:"Complete the user's task using available tools when appropriate. Be honest when the task cannot be completed."},{role:"user",content:task}];
    for(let step=0;step<8;step++) {
      const response=await fetch(`${this.options.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${this.options.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:this.options.model,messages,tools:tools.map(jsonSchema),tool_choice:"auto",temperature:0})});
      if(!response.ok) throw new Error(`Provider returned ${response.status}: ${await response.text()}`);
      const body:any=await response.json(), message=body.choices?.[0]?.message; if(!message) throw new Error("Provider returned no assistant message");
      messages.push(message); const calls=message.tool_calls??[];
      if(!calls.length) return {selectedTools,finalOutcome:message.content??"",latencyMs:performance.now()-start,errors};
      for(const call of calls) { selectedTools.push(call.function.name); const tool=tools.find(t=>t.name===call.function.name); let content:any;
        try { if(!tool) throw new Error(`Unknown tool ${call.function.name}`); const args=tool.inputSchema.parse(JSON.parse(call.function.arguments||"{}")); content=await tool.execute(args,{task,requestId}); }
        catch(error){const text=error instanceof Error?error.message:String(error);errors.push(text);content={error:text};}
        messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(content)});
      }
    }
    errors.push("Maximum tool-call steps reached"); return {selectedTools,finalOutcome:"maximum_steps_reached",latencyMs:performance.now()-start,errors};
  }
}
