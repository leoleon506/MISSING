import {parsePublicApis} from "./experiment3tCore.js";
import {sha,type ProviderCandidate} from "./experiment3vCore.js";
import type {HoldoutCase} from "./experiment3yCore.js";

const STOP=new Set("a an and any as at be by canonical data every for from given in into is it its of on or public read only requested return returns the this to using with text metadata api lookup required output outputs field fields string number".split(" "));
function stem(w:string){let x=w.toLowerCase();if(x.length>4&&x.endsWith("ies"))x=x.slice(0,-3)+"y";else if(x.length>4&&x.endsWith("s")&&!x.endsWith("ss"))x=x.slice(0,-1);return x;}
function words(s:string){return (String(s).toLowerCase().match(/[a-z0-9]+/g)||[]).map(stem).filter(x=>x.length>=2&&!STOP.has(x));}
function match(q:string,d:Set<string>){if(d.has(q))return 4;if(q.length>=5&&[...d].some(x=>x.length>=5&&(x.startsWith(q)||q.startsWith(x))))return 1;return 0;}
function queryWords(c:HoldoutCase){return [...new Set(words(`${c.intent} ${c.input_names.join(" ")} ${c.required_output_leaf_names.join(" ")}`))];}
export function broadRetrieve3y(c:HoldoutCase,md:string):ProviderCandidate[]{
 const q=queryWords(c);
 return parsePublicApis(md).map(e=>{
  const body=new Set(words(`${e.name} ${e.description}`)),category=new Set(words(e.category));let score=0;
  for(const w of q){score+=match(w,body);score+=2*match(w,category);}
  if(/^no$/i.test(String(e.auth).trim()))score+=1;if(/^yes$/i.test(String(e.https).trim()))score+=1;
  return {...e,score};
 }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,80).map((e,i)=>({candidate_id:`p${String(i+1).padStart(3,"0")}_${sha(`${c.case_id}|${e.name}|${e.link}`).slice(0,10)}`,lexical_rank:i+1,name:e.name,description:e.description,category:e.category,auth:e.auth,https:e.https,link:e.link,score:e.score}));
}
export function rankDocumentationLinks(c:HoldoutCase,links:{url:string;depth:number}[]){const q=queryWords(c);return [...links].map((x,i)=>{const u=new URL(x.url),tokens=new Set(words(`${u.pathname} ${u.search}`));let score=0;for(const w of q)score+=match(w,tokens);if(/\/api\b|\/apis\b|developer|docs?|reference|guide|endpoint/i.test(u.pathname))score+=2;return {x,i,score};}).sort((a,b)=>b.score-a.score||a.i-b.i).map(v=>v.x);}
