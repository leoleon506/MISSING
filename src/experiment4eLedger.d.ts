import "./experiment3yrCore.js";
declare module "./experiment3yrCore.js" {
  interface RecoveryLedger {
    record(layer:"documentation",kind:string,accepted:boolean,detail?:unknown):void;
  }
}
