import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {prepareRequestGraph4N,rebuildRequestGraph4N} from "./experiment4nRequest.js";
import {executedTraces4N} from "./experiment4nTrace.js";
import {preferEquivalentExecutedTraces4Q} from "./experiment4qPreference.js";

export async function prepareRequestGraph4Q(evidence:DocEvidence[],caseId:string,providerId:string,ledger:RecoveryLedger){
  const base=await prepareRequestGraph4N(evidence,caseId,providerId,ledger);
  const traces=executedTraces4N(caseId,providerId),preferred=preferEquivalentExecutedTraces4Q(base.probe_packet,traces);
  return {...base,probe_packet:preferred.packet,metrics:{...base.metrics,...preferred.metrics}};
}

export function rebuildRequestGraph4Q(evidence:DocEvidence[],caseId:string,providerId:string){
  return rebuildRequestGraph4N(evidence,caseId,providerId);
}
