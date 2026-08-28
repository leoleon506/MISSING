import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {P1RequestHypothesis} from "./experiment4ap1Model.js";
import {prepareRequestGraph4J,rebuildRequestGraph4J} from "./experiment4jRequest.js";
export type RequestGraph4J={semantics:any;hypotheses:P1RequestHypothesis[];metrics:any;graph_fingerprint:string};
export type PreparedRequestGraph4J=RequestGraph4J&{probe_packet:P1RequestHypothesis[]};
export async function prepareRequestGraph4JTyped(evidence:DocEvidence[],caseId:string,ledger:RecoveryLedger):Promise<PreparedRequestGraph4J>{return await prepareRequestGraph4J(evidence,caseId,ledger) as PreparedRequestGraph4J}
export function rebuildRequestGraph4JTyped(evidence:DocEvidence[],caseId:string):RequestGraph4J{return rebuildRequestGraph4J(evidence,caseId) as RequestGraph4J}
