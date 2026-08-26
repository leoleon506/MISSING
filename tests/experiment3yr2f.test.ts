import {describe,expect,it} from "vitest";
import {RecoveryLedger,derivedSafetyCounters} from "../src/experiment3yrCore.js";
import {safetyGateFromLedger,validatePublicHostname} from "../src/experiment3yr2Core.js";

describe("Experiment 3Y-R2F freeze audit",()=>{
  it("requires non-vacuous safety evidence",()=>{const l=new RecoveryLedger();const c=derivedSafetyCounters(l);expect(safetyGateFromLedger(l,c)).toBe(true);expect(l.events.length).toBe(0);});
  it("records public DNS evidence",async()=>{const l=new RecoveryLedger();const resolver=async()=>[{address:"93.184.216.34",family:4}] as any;await validatePublicHostname("example.com",l,resolver as any);expect(l.events.some(e=>e.kind==="public_dns"&&e.accepted)).toBe(true);});
  it("records rejected private DNS evidence",async()=>{const l=new RecoveryLedger();const resolver=async()=>[{address:"10.0.0.5",family:4}] as any;await expect(validatePublicHostname("example.com",l,resolver as any)).rejects.toThrow("dns_private_address");expect(l.events.some(e=>e.kind==="private_hosts"&&!e.accepted)).toBe(true);});
});
