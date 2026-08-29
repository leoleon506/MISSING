import {deriveExperiment5b8PlannerSource} from "./experiment5b8PlannerDerivation.js";
export function deriveExperiment5b9PlannerSource(source:string){return deriveExperiment5b8PlannerSource(source).replace("export async function synthesize5b8","export async function synthesize5b9")}
