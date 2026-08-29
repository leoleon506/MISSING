import {describe,expect,it} from "vitest";
import {buildRecoveryLinkQueue5B9,httpsUpgradeCandidate5B9,recoveryLinkOrderingDeterminism5B9,recoverySurface5B9} from "../src/experiment5b9Recovery.js";
import type {DocEvidence} from "../src/experiment3wCore.js";
import type {Provider4A} from "../src/experiment4aContract.js";

const provider:Provider4A={case_id:"npm_package_metadata",candidate_id:"synthetic",name:"Synthetic",start_url:"https://docs.example.test/start"};
function ev(id:string,text:string,url=`https://docs.example.test/${id}`):DocEvidence{return {evidence_id:id,provider_candidate_id:provider.candidate_id,requested_url:url,resolved_url:url,verified_at:"now",status:200,content_type:"text/html",body_fingerprint:`fp_${id}`,text,state:"ok"}}

describe("Experiment 5B9 acquisition recovery",()=>{
 it("permits exact scheme-only HTTP to HTTPS upgrade",()=>{const x=httpsUpgradeCandidate5B9("http://docs.example.test/path?a=1&b=2");expect(x?.url).toBe("https://docs.example.test/path?a=1&b=2")});
 it("rejects non-HTTP and IP-literal upgrade inputs",()=>{expect(httpsUpgradeCandidate5B9("https://docs.example.test/path")).toBeNull();expect(httpsUpgradeCandidate5B9("http://127.0.0.1/path")).toBeNull()});
 it("accepts same-provider explicit API reference links and rejects external/noise links",()=>{const text=`<a href="/openapi.json">OpenAPI specification</a><a href="https://outside.example.org/docs">API docs</a><a href="/login">Login</a><a href="/assets/app.js">script</a>`,seen=new Set<string>(),depth=new Map([["e1",0]]),r=buildRecoveryLinkQueue5B9([ev("e1",text)],provider,seen,depth);expect(r.queue.map(x=>x.target_url)).toContain("https://docs.example.test/openapi.json");expect(r.queue.some(x=>x.target_url.includes("outside.example.org"))).toBe(false);expect(r.metrics.recoveryLinkRejectedScope5b9).toBeGreaterThan(0);expect(r.metrics.recoveryLinkRejectedNoise5b9).toBeGreaterThan(0)});
 it("does not refetch already-seen recovery links",()=>{const text=`<a href="/reference">API reference</a>`,seen=new Set(["https://docs.example.test/reference"]),depth=new Map([["e1",0]]),r=buildRecoveryLinkQueue5B9([ev("e1",text)],provider,seen,depth);expect(r.queue).toHaveLength(0);expect(r.metrics.recoveryLinkAlreadyFetched5b9).toBe(1)});
 it("orders recovery candidates deterministically",()=>{const text=`<a href="/docs">Documentation</a><a href="/openapi.json">OpenAPI</a>`,seen=new Set<string>(),depth=new Map([["e1",0]]);expect(recoveryLinkOrderingDeterminism5B9([ev("e1",text)],provider,seen,depth).ok).toBe(true)});
 it("detects when acquired evidence creates executable request surface",()=>{const empty=recoverySurface5B9([],provider),doc=ev("op",`<p>GET https://api.example.test/package?package_name=demo</p><p>package_name: package name</p><pre>{"name":"demo","version":"1"}</pre>`),full=recoverySurface5B9([doc],provider);expect(empty.executable_hypotheses).toBe(0);expect(full.get_operations).toBeGreaterThan(0);expect(full.executable_hypotheses).toBeGreaterThan(0)});
});
