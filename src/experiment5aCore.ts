import {createHash} from "node:crypto";
import type {ZCase} from "./experiment3zCore.js";

export const FOUR_A_BASE_SHA="a0ae7506df5c9be386e8be6a72fce8526aca1e11";
export const FOUR_A_MODEL="gpt-4.1-mini-2025-04-14";
export const FOUR_A_PRICE={input_usd_per_million:0.40,cached_input_usd_per_million:0.10,output_usd_per_million:1.60};
export const FOUR_A_BUDGET={cases:18,max_provider_attempts_per_case:8,max_doc_pages_per_provider:8,max_doc_depth:2,max_bytes:4*1024*1024,min_successes:6,min_families_with_success:6,min_distinct_providers:6,min_replay_rate:0.95,max_mean_llm_cost_per_success_usd:0.15,max_total_llm_cost_usd:3.00,max_median_success_latency_ms:90000,max_p90_success_latency_ms:180000};

export type FiveAStratum="near"|"far";
export type FiveACase=ZCase&{family:string;holdout_stratum:FiveAStratum};

export const FIVE_A_CASES:FiveACase[]=[
{family:"geography",holdout_stratum:"far",case_id:"country_alpha_metadata",intent:"Given an ISO alpha-2 country code, identify a public machine-readable operation that returns the same alpha-2 code, a human-readable country name, and a human-readable region.",input_names:["country_code"],required_output_leaf_names:["country_code","country_name","region"],build:{country_code:"CR"},replay:{country_code:"JP"},required:["country_code","country_name","region"]},
{family:"geography",holdout_stratum:"far",case_id:"city_country_geocode_metadata",intent:"Given a city name and ISO alpha-2 country code, identify a public machine-readable operation that returns that city and country pair plus finite latitude and longitude.",input_names:["city_name","country_code"],required_output_leaf_names:["city_name","country_code","latitude","longitude"],build:{city_name:"Ottawa",country_code:"CA"},replay:{city_name:"Canberra",country_code:"AU"},required:["city_name","country_code","latitude","longitude"]},
{family:"games",holdout_stratum:"far",case_id:"pokemon_name_metadata",intent:"Given a Pokemon species name, identify a public machine-readable operation that returns its canonical name, positive numeric identifier, and positive height value.",input_names:["pokemon_name"],required_output_leaf_names:["name","id","height"],build:{pokemon_name:"pikachu"},replay:{pokemon_name:"bulbasaur"},required:["name","id","height"]},
{family:"language",holdout_stratum:"far",case_id:"english_word_definition_metadata",intent:"Given an English word, identify a public machine-readable dictionary operation that returns the same word and at least one non-empty human-readable definition.",input_names:["word"],required_output_leaf_names:["word","definition"],build:{word:"hello"},replay:{word:"world"},required:["word","definition"]},
{family:"software",holdout_stratum:"far",case_id:"source_repository_metadata",intent:"Given a public source-code repository owner and repository name, identify a public machine-readable operation that returns the canonical owner/repository full name and its default branch.",input_names:["owner","repository"],required_output_leaf_names:["full_name","default_branch"],build:{owner:"torvalds",repository:"linux"},replay:{owner:"python",repository:"cpython"},required:["full_name","default_branch"]},
{family:"software",holdout_stratum:"near",case_id:"rust_crate_metadata",intent:"Given a Rust crate name, identify a public machine-readable operation that returns the canonical crate name and a current version string.",input_names:["package_name"],required_output_leaf_names:["name","version"],build:{package_name:"serde"},replay:{package_name:"tokio"},required:["name","version"]},
{family:"software",holdout_stratum:"near",case_id:"ruby_gem_metadata",intent:"Given a Ruby gem name, identify a public machine-readable operation that returns the canonical gem name and a current version string.",input_names:["package_name"],required_output_leaf_names:["name","version"],build:{package_name:"rails"},replay:{package_name:"rake"},required:["name","version"]},
{family:"games",holdout_stratum:"far",case_id:"chess_player_metadata",intent:"Given a public chess username, identify a public machine-readable operation that returns the same canonical username and a non-empty chess title.",input_names:["username"],required_output_leaf_names:["username","title"],build:{username:"magnuscarlsen"},replay:{username:"hikaru"},required:["username","title"]},
{family:"science",holdout_stratum:"far",case_id:"protein_structure_metadata",intent:"Given a Protein Data Bank structure identifier, identify a public machine-readable operation that returns the same structure identifier and a non-empty human-readable structure title.",input_names:["structure_id"],required_output_leaf_names:["structure_id","title"],build:{structure_id:"1CRN"},replay:{structure_id:"4HHB"},required:["structure_id","title"]},
{family:"literature",holdout_stratum:"near",case_id:"public_domain_book_metadata",intent:"Given a numeric public-domain ebook catalog identifier, identify a public machine-readable operation that returns the same numeric identifier and the book title.",input_names:["book_id"],required_output_leaf_names:["id","title"],build:{book_id:1342},replay:{book_id:84},required:["id","title"]},
{family:"security",holdout_stratum:"far",case_id:"cve_vulnerability_metadata",intent:"Given a CVE identifier, identify a public machine-readable operation that returns the same CVE identifier and a non-empty human-readable vulnerability description.",input_names:["cve_id"],required_output_leaf_names:["cve_id","description"],build:{cve_id:"CVE-2021-44228"},replay:{cve_id:"CVE-2014-0160"},required:["cve_id","description"]},
{family:"media",holdout_stratum:"far",case_id:"television_show_metadata",intent:"Given a television show name, identify a public machine-readable operation that returns the canonical matching show name, a positive numeric identifier, and a premiere date.",input_names:["show_name"],required_output_leaf_names:["name","id","premiered"],build:{show_name:"Breaking Bad"},replay:{show_name:"Severance"},required:["name","id","premiered"]},
{family:"space",holdout_stratum:"far",case_id:"satellite_catalog_metadata",intent:"Given a NORAD catalog number, identify a public machine-readable operation that returns the same catalog number and a non-empty satellite or object name.",input_names:["norad_catalog_id"],required_output_leaf_names:["norad_catalog_id","name"],build:{norad_catalog_id:25544},replay:{norad_catalog_id:20580},required:["norad_catalog_id","name"]},
{family:"software",holdout_stratum:"far",case_id:"spdx_license_metadata",intent:"Given an SPDX license identifier, identify a public machine-readable operation that returns the same license identifier, its human-readable license name, and a boolean OSI-approval indicator.",input_names:["license_id"],required_output_leaf_names:["license_id","name","osi_approved"],build:{license_id:"MIT"},replay:{license_id:"Apache-2.0"},required:["license_id","name","osi_approved"]},
{family:"publication",holdout_stratum:"far",case_id:"arxiv_preprint_metadata",intent:"Given an arXiv identifier, identify a public machine-readable operation that returns an identifier referring to that same arXiv record and its non-empty title.",input_names:["arxiv_id"],required_output_leaf_names:["arxiv_id","title"],build:{arxiv_id:"1706.03762"},replay:{arxiv_id:"1810.04805"},required:["arxiv_id","title"]},
{family:"science",holdout_stratum:"far",case_id:"gene_identifier_metadata",intent:"Given a stable Ensembl-style gene identifier, identify a public machine-readable operation that returns the same gene identifier, a non-empty display name, and a non-empty species value.",input_names:["gene_id"],required_output_leaf_names:["gene_id","display_name","species"],build:{gene_id:"ENSG00000157764"},replay:{gene_id:"ENSG00000139618"},required:["gene_id","display_name","species"]},
{family:"network",holdout_stratum:"far",case_id:"dns_a_record_metadata",intent:"Given a domain name, identify a public machine-readable DNS lookup operation that returns at least one A-record answer whose owner name is the supplied domain and whose data is an IPv4 address.",input_names:["domain_name"],required_output_leaf_names:["answer_name","address"],build:{domain_name:"example.com"},replay:{domain_name:"iana.org"},required:["answer_name","address"]},
{family:"network",holdout_stratum:"far",case_id:"ip_geolocation_metadata",intent:"Given a public IPv4 address, identify a public machine-readable geolocation operation that returns that same IP address, a two-letter country code, and a human-readable country name.",input_names:["ip_address"],required_output_leaf_names:["ip_address","country_code","country_name"],build:{ip_address:"8.8.8.8"},replay:{ip_address:"1.1.1.1"},required:["ip_address","country_code","country_name"]}
];

export const FOUR_A_CASES:FiveACase[]=FIVE_A_CASES;

function ci(a:any,b:any){return typeof a==="string"&&a.trim().toLowerCase()===String(b).trim().toLowerCase()}
function str(v:any,min=1){return typeof v==="string"&&v.trim().length>=min}
function finite(v:any){const n=Number(v);return Number.isFinite(n)}
function positive(v:any){const n=Number(v);return Number.isFinite(n)&&n>0}
function versionLike(v:any){return str(v)&&/\d/.test(String(v))}
function yyyyMmDd(v:any){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v.trim())}
function ipv4(v:any){if(typeof v!=="string")return false;const p=v.trim().split(".");return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&Number(x)>=0&&Number(x)<=255)}
function arxivSame(v:any,input:any){if(typeof v!=="string")return false;const raw=String(input).trim().toLowerCase(),normalized=v.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//,"").replace(/\.pdf$/,"").replace(/v\d+$/,"");return normalized===raw||normalized.includes(raw)}

export function semanticValidate4a(id:string,input:Record<string,any>,out:Record<string,any>){
 if(id==="country_alpha_metadata")return ci(out.country_code,input.country_code)&&str(out.country_name)&&str(out.region);
 if(id==="city_country_geocode_metadata")return ci(out.city_name,input.city_name)&&ci(out.country_code,input.country_code)&&finite(out.latitude)&&finite(out.longitude)&&Number(out.latitude)>=-90&&Number(out.latitude)<=90&&Number(out.longitude)>=-180&&Number(out.longitude)<=180;
 if(id==="pokemon_name_metadata")return ci(out.name,input.pokemon_name)&&positive(out.id)&&positive(out.height);
 if(id==="english_word_definition_metadata")return ci(out.word,input.word)&&str(out.definition);
 if(id==="source_repository_metadata")return ci(out.full_name,`${input.owner}/${input.repository}`)&&str(out.default_branch);
 if(id==="rust_crate_metadata"||id==="ruby_gem_metadata")return ci(out.name,input.package_name)&&versionLike(out.version);
 if(id==="chess_player_metadata")return ci(out.username,input.username)&&str(out.title);
 if(id==="protein_structure_metadata")return ci(out.structure_id,input.structure_id)&&str(out.title);
 if(id==="public_domain_book_metadata")return Number(out.id)===Number(input.book_id)&&str(out.title);
 if(id==="cve_vulnerability_metadata")return ci(out.cve_id,input.cve_id)&&str(out.description,20);
 if(id==="television_show_metadata")return ci(out.name,input.show_name)&&positive(out.id)&&yyyyMmDd(out.premiered);
 if(id==="satellite_catalog_metadata")return Number(out.norad_catalog_id)===Number(input.norad_catalog_id)&&str(out.name);
 if(id==="spdx_license_metadata")return ci(out.license_id,input.license_id)&&str(out.name)&&typeof out.osi_approved==="boolean";
 if(id==="arxiv_preprint_metadata")return arxivSame(out.arxiv_id,input.arxiv_id)&&str(out.title);
 if(id==="gene_identifier_metadata")return ci(out.gene_id,input.gene_id)&&str(out.display_name)&&str(out.species);
 if(id==="dns_a_record_metadata")return typeof out.answer_name==="string"&&out.answer_name.trim().replace(/\.$/,"").toLowerCase()===String(input.domain_name).trim().toLowerCase()&&ipv4(out.address);
 if(id==="ip_geolocation_metadata")return String(out.ip_address).trim()===String(input.ip_address).trim()&&typeof out.country_code==="string"&&/^[A-Za-z]{2}$/.test(out.country_code.trim())&&str(out.country_name);
 return false;
}

export const fourAFingerprint=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");
export function usageCost(u:any){const input=Number(u?.prompt_tokens??u?.input_tokens??0),output=Number(u?.completion_tokens??u?.output_tokens??0),cached=Number(u?.prompt_tokens_details?.cached_tokens??u?.input_tokens_details?.cached_tokens??0),uncached=Math.max(0,input-cached);return {input_tokens:input,output_tokens:output,cached_input_tokens:cached,cost_usd:(uncached*FOUR_A_PRICE.input_usd_per_million+cached*FOUR_A_PRICE.cached_input_usd_per_million+output*FOUR_A_PRICE.output_usd_per_million)/1_000_000}}
export function percentile(xs:number[],p:number){if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),i=Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1));return s[i]}
export const fiveAWorkloadFingerprint=()=>fourAFingerprint(FIVE_A_CASES.map(c=>({family:c.family,holdout_stratum:c.holdout_stratum,case_id:c.case_id,intent:c.intent,input_names:c.input_names,required_output_leaf_names:c.required_output_leaf_names,build:c.build,replay:c.replay,required:c.required})));
