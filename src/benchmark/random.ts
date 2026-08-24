export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0; const random = () => { state = (state + 0x6D2B79F5) >>> 0; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  const output=[...items]; for(let i=output.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[output[i],output[j]]=[output[j],output[i]];} return output;
}
export function randomIntSeeded(seed:number,exclusiveMaximum:number):number { return shuffleSeeded(Array.from({length:exclusiveMaximum},(_,i)=>i),seed)[0]; }
