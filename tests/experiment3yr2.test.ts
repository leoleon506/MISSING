import {describe,expect,it} from "vitest";
import {BLIND_CASES} from "../src/experiment3yCore.js";
import {RecoveryLedger,derivedSafetyCounters} from "../src/experiment3yrCore.js";
import {privateAddress,recoveredBroadRetrieveR2,safetyGateFromLedger,semanticTokens,singularizeToken,uniqueSemanticTokens,validatePublicHostname,parseRepresentativeYaml} from "../src/experiment3yr2Core.js";

describe("Experiment 3Y-R2 retrieval and network hardening",()=>{
  it("normalizes plural morphology generically",()=>{expect(singularizeToken("countries")).toBe("country");expect(singularizeToken("breweries")).toBe("brewery");expect(singularizeToken("abilities")).toBe("ability");expect(singularizeToken("currencies")).toBe("currency");});
  it("removes stopwords and deduplicates semantic query concepts",()=>{expect(semanticTokens("an country that can country and metadata API")).toEqual(["country","country"]);expect(uniqueSemanticTokens("country countries country")).toEqual(["country"]);});
  it("ranks plural semantic provider without case-specific hostname bonus",()=>{const md=`| API | Description | Auth | HTTPS | CORS |\n|---|---|---|---|---|\n| [IP 2 Country](https://ip.test) | Country from IP address | No | Yes | Yes |\n| [REST Countries](https://countries.test) | Get information about countries via a RESTful API | No | Yes | Yes |`;const c=BLIND_CASES.find(x=>x.case_id==="country_metadata")!;const out=recoveredBroadRetrieveR2(c as any,md);expect(out.find(x=>x.name==="REST Countries")?.lexical_rank).toBeLessThanOrEqual(2);});
  it("recognizes private and special-use addresses",()=>{expect(privateAddress("127.0.0.1")).toBe(true);expect(privateAddress("10.1.2.3")).toBe(true);expect(privateAddress("192.168.1.2")).toBe(true);expect(privateAddress("8.8.8.8")).toBe(false);expect(privateAddress("::1")).toBe(true);});
  it("rejects a hostname resolving to private address",async()=>{const ledger=new RecoveryLedger(),resolver=async()=>[{address:"127.0.0.1",family:4}] as any;await expect(validatePublicHostname("docs.example.com",ledger,resolver as any)).rejects.toThrow("dns_private_address");expect(ledger.events.some(x=>x.kind==="private_hosts"&&!x.accepted)).toBe(true);});
  it("accepts representative nested YAML OpenAPI",()=>{const spec=parseRepresentativeYaml();expect(spec?.openapi).toBe("3.0.3");expect(spec?.paths?.["/resource/{id}"]?.get).toBeTruthy();});
  it("computes safety gate from ledger and counters",()=>{const ledger=new RecoveryLedger(),counters=derivedSafetyCounters(ledger);expect(safetyGateFromLedger(ledger,counters)).toBe(true);ledger.record("guard","credentials",true);expect(safetyGateFromLedger(ledger,derivedSafetyCounters(ledger))).toBe(false);});
});
