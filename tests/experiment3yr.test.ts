import {describe,expect,it} from "vitest";
import {BLIND_CASES} from "../src/experiment3yCore.js";
import {RecoveryLedger,derivedSafetyCounters,normalizeTokenText,parseOpenApiText,recoveredBroadRetrieve,tokens,validateRedirectTarget,validatorForCase} from "../src/experiment3yrCore.js";

describe("Experiment 3Y-R engineering recovery",()=>{
  it("normalizes Unicode provider names",()=>{expect(normalizeTokenText("PokéAPI")).toBe("pokeapi");expect(tokens("Pokémon metadata API")).toContain("pokemon");});
  it("ranks semantic provider evidence above generic noise",()=>{const md=`| API | Description | Auth | HTTPS | CORS |\n|---|---|---|---|---|\n| [Generic](https://generic.test) | Public API with name id code | No | Yes | Yes |\n| [PokéAPI](https://pokeapi.co) | Pokémon data and information | No | Yes | Yes |`;const c=BLIND_CASES.find(x=>x.case_id==="pokemon_metadata")!;const out=recoveredBroadRetrieve(c as any,md);expect(out[0]?.name).toContain("Pok");});
  it("parses JSON OpenAPI",()=>{const x=parseOpenApiText(JSON.stringify({openapi:"3.0.0",paths:{"/x":{get:{responses:{"200":{description:"ok"}}}}}}));expect(x?.openapi).toBe("3.0.0");});
  it("parses bounded YAML OpenAPI",()=>{const y=`openapi: 3.0.0\npaths:\n  /pokemon/{name}:\n    get:\n      responses:\n        '200':\n          description: ok\n`;const x=parseOpenApiText(y);expect(x?.paths?.["/pokemon/{name}"]?.get).toBeTruthy();});
  it("rejects unsafe redirects and records guard evidence",()=>{const ledger=new RecoveryLedger();expect(()=>validateRedirectTarget("https://docs.example.com","https://docs.example.com/start","http://docs.example.com/x",ledger)).toThrow("redirect_non_https");expect(ledger.events.some(x=>x.kind==="non_https"&&!x.accepted)).toBe(true);});
  it("uses typed capability validators",()=>{expect(validatorForCase("country_metadata")).toBe("country");expect(validatorForCase("pokemon_metadata")).toBe("pokemon");expect(validatorForCase("brewery_metadata")).toBe("brewery");});
  it("derives counters from ledger instead of constants",()=>{const l=new RecoveryLedger();l.record("guard","credentials",true);expect(derivedSafetyCounters(l).credentials).toBe(1);});
});
