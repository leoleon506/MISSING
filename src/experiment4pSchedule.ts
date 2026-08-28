export type BoundedMapResult4P<T>={results:T[];maxObservedConcurrency:number};

export async function boundedOrderedMap4P<T,R>(items:readonly T[],limit:number,fn:(item:T,index:number)=>Promise<R>):Promise<BoundedMapResult4P<R>>{
  if(!Number.isInteger(limit)||limit<1)throw new Error("4p_invalid_concurrency_limit");
  const results=new Array<R>(items.length);
  let next=0,active=0,maxObservedConcurrency=0,firstError:any=null;
  async function worker(){
    while(true){
      const index=next++;
      if(index>=items.length)return;
      active++;maxObservedConcurrency=Math.max(maxObservedConcurrency,active);
      try{results[index]=await fn(items[index],index)}catch(e){if(firstError===null)firstError=e}finally{active--}
    }
  }
  const workers=Array.from({length:Math.min(limit,items.length)},()=>worker());
  await Promise.all(workers);
  if(firstError!==null)throw firstError;
  return {results,maxObservedConcurrency};
}
