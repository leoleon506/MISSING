import {it,expect} from "vitest";
import {buildExecutedTraceHypotheses4N} from "../src/experiment4nRequest.js";

it("diagnoses character-books trace proof",()=>{
 const evidence:any=[{evidence_id:"d",provider_candidate_id:"p1",requested_url:"https://docs.example.com/reference",resolved_url:"https://docs.example.com/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"d",text:"Book API returns book id and book name.",state:"ok"}];
 const text=JSON.stringify({book:"volume",id:1,name:"A Book"});
 const trace:any={trace_id:"t",case_id:"fictional_character_metadata",provider_candidate_id:"p1",stage:"CRAWL",parent_evidence_ids:["d"],requested_url:"https://api.example.com/api/books/1",final_url:"https://api.example.com/api/books/1",requested_at:new Date().toISOString(),disposition:"success",content_type:"application/json",body_fingerprint:"b",body_bytes:text.length,response_text:text,network_origin:"network",error:null};
 const r=buildExecutedTraceHypotheses4N([trace],evidence,[],"fictional_character_metadata","p1");
 console.log("4N_BOOK_DEBUG",JSON.stringify(r,null,2));
 expect(r).toBeTruthy();
});
