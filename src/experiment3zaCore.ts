import {createHash} from "node:crypto";

export const ORIGINAL_3Z_SHA="d7084aa7103739cf163696634af3776cbabcf93b";
export const ORIGINAL_3Z_RUN_ID=33015231733;
export const ORIGINAL_3Z_ARTIFACT_ID=9624265594;
export const ORIGINAL_3Z_ARTIFACT_DIGEST="sha256:6b943b75cafbf91f0c8a5d7971ad1c697073dfe1c86aa753fb574e79d3f7c776";
export const ORIGINAL_3Z_REPORT_FINGERPRINT="ebcc4f829d04d259397d6487aaf0a936c7f964ec67f52f0aa2ffff38ac675591";

export const sha3za=(v:string)=>createHash("sha256").update(v).digest("hex");

export function urlLiterals(source:string){return [...source.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)].map(m=>m[1]);}
export function providerSeedAudit(runner:string,core:string,planner:string){
 const coreUrls=urlLiterals(core),plannerUrls=urlLiterals(planner);
 const hasStartFromCandidate=/start_url\s*:\s*s\.link/.test(runner);
 const hasBroadFromR2=/broad\s*=\s*recoveredBroadRetrieveR2\(c\s+as\s+any\s*,\s*catalog\)/.test(runner);
 const hasSelectedFromBroad=/selected\s*=\s*resolveSelected\(r\.selection\s*,\s*broad\s+as\s+any\)/.test(runner);
 const seededStartAssignments=[...runner.matchAll(/start_url\s*:\s*([^,}\n]+)/g)].map(m=>m[1].trim()).filter(x=>x!=="s.link");
 const providerFieldsInCases=/provider(_candidate_id|_name)?\s*:|start_url\s*:|base_url\s*:|path_template\s*:|output_paths\s*:/i.test(core.split("export type IntegrationProviderZ")[0]);
 const plannerProviderUrls=plannerUrls.length>0;
 return {coreUrls,plannerUrls,hasStartFromCandidate,hasBroadFromR2,hasSelectedFromBroad,seededStartAssignments,providerFieldsInCases,plannerProviderUrls,clean:coreUrls.length===0&&!plannerProviderUrls&&hasStartFromCandidate&&hasBroadFromR2&&hasSelectedFromBroad&&seededStartAssignments.length===0&&!providerFieldsInCases};
}

export function selfReferenceBugPresent(runner:string){
 const readsSelf=/readFile\(new URL\(import\.meta\.url\)/.test(runner);
 const regexLiteral=/forbiddenSource\s*=\s*\/[^\n]+\/i\.test\(runnerSource\)/.test(runner);
 return readsSelf&&regexLiteral;
}
