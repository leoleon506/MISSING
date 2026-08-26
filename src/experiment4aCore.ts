import {createHash} from "node:crypto";
import type {ZCase} from "./experiment3zCore.js";

export const FOUR_A_BASE_SHA="c1088fc7f3fb54dc648c224b440a544a67fdba41";
export const FOUR_A_MODEL="gpt-4.1-mini-2025-04-14";
export const FOUR_A_PRICE={input_usd_per_million:0.40,cached_input_usd_per_million:0.10,output_usd_per_million:1.60};
export const FOUR_A_BUDGET={cases:24,max_provider_attempts_per_case:8,max_doc_pages_per_provider:8,max_doc_depth:2,max_bytes:4*1024*1024,min_successes:12,min_families_with_success:6,min_distinct_providers:8,min_replay_rate:0.95,max_mean_llm_cost_per_success_usd:0.15,max_total_llm_cost_usd:3.00,max_median_success_latency_ms:90000,max_p90_success_latency_ms:180000};
export type FourACase=ZCase&{family:string};
export const FOUR_A_CASES:FourACase[]=[
{family:"software",case_id:"pypi_package_metadata",intent:"Given a Python package name, identify a public machine-readable API operation that returns the canonical package name and current version.",input_names:["package_name"],required_output_leaf_names:["name","version"],build:{package_name:"numpy"},replay:{package_name:"pandas"},required:["name","version"]},
{family:"software",case_id:"npm_package_metadata",intent:"Given an npm package name, identify a public machine-readable API operation that returns the canonical package name and a current version string.",input_names:["package_name"],required_output_leaf_names:["name","version"],build:{package_name:"lodash"},replay:{package_name:"express"},required:["name","version"]},
{family:"software",case_id:"wikipedia_page_metadata",intent:"Given an encyclopedia page title, identify a public machine-readable API operation that returns the canonical page title and a human-readable description or extract.",input_names:["page_title"],required_output_leaf_names:["title","description"],build:{page_title:"Python (programming language)"},replay:{page_title:"JavaScript"},required:["title","description"]},
{family:"location",case_id:"postal_code_location",intent:"Given a postal code, identify a public machine-readable API operation that returns the queried postal code and human-readable country name.",input_names:["postal_code"],required_output_leaf_names:["postal_code","country_name"],build:{postal_code:"90210"},replay:{postal_code:"10001"},required:["postal_code","country_name"]},
{family:"location",case_id:"coordinate_timezone",intent:"Given latitude and longitude, identify a public machine-readable API operation that returns a human-readable timezone identifier for those coordinates.",input_names:["latitude","longitude"],required_output_leaf_names:["timezone"],build:{latitude:40.7128,longitude:-74.0060},replay:{latitude:51.5074,longitude:-0.1278},required:["timezone"]},
{family:"location",case_id:"coordinate_weather_metadata",intent:"Given latitude and longitude, identify a public machine-readable API operation that returns the resolved latitude, resolved longitude, and a current temperature value.",input_names:["latitude","longitude"],required_output_leaf_names:["latitude","longitude","temperature"],build:{latitude:40.7128,longitude:-74.0060},replay:{latitude:51.5074,longitude:-0.1278},required:["latitude","longitude","temperature"]},
{family:"publication",case_id:"doi_publication_metadata",intent:"Given a DOI, identify a public machine-readable API operation that returns the canonical DOI and publication title.",input_names:["doi"],required_output_leaf_names:["doi","title"],build:{doi:"10.1038/nphys1170"},replay:{doi:"10.1126/science.169.3946.635"},required:["doi","title"]},
{family:"publication",case_id:"isbn_title_metadata",intent:"Given an ISBN, identify a public machine-readable API operation that returns a human-readable book title for that ISBN.",input_names:["isbn"],required_output_leaf_names:["title"],build:{isbn:"9780140328721"},replay:{isbn:"9780061120084"},required:["title"]},
{family:"publication",case_id:"open_library_work_metadata",intent:"Given a public book work identifier, identify a public machine-readable API operation that returns the work identifier or key and human-readable title.",input_names:["work_id"],required_output_leaf_names:["id","title"],build:{work_id:"OL45883W"},replay:{work_id:"OL82563W"},required:["id","title"]},
{family:"consumer",case_id:"food_barcode_metadata",intent:"Given a retail food barcode, identify a public machine-readable API operation that returns the barcode and human-readable product name.",input_names:["barcode"],required_output_leaf_names:["code","name"],build:{barcode:"3017620422003"},replay:{barcode:"737628064502"},required:["code","name"]},
{family:"consumer",case_id:"meal_name_metadata",intent:"Given a meal name, identify a public machine-readable API operation that returns the canonical meal name and meal category.",input_names:["meal_name"],required_output_leaf_names:["name","category"],build:{meal_name:"Arrabiata"},replay:{meal_name:"Burek"},required:["name","category"]},
{family:"consumer",case_id:"cocktail_name_metadata",intent:"Given a cocktail name, identify a public machine-readable API operation that returns the canonical drink name and drink category.",input_names:["drink_name"],required_output_leaf_names:["name","category"],build:{drink_name:"Margarita"},replay:{drink_name:"Negroni"},required:["name","category"]},
{family:"identity",case_id:"age_estimate_by_name",intent:"Given a first name, identify a public machine-readable API operation that returns that name and an estimated age.",input_names:["name"],required_output_leaf_names:["name","age"],build:{name:"michael"},replay:{name:"sarah"},required:["name","age"]},
{family:"identity",case_id:"gender_estimate_by_name",intent:"Given a first name, identify a public machine-readable API operation that returns that name and an estimated gender label.",input_names:["name"],required_output_leaf_names:["name","gender"],build:{name:"peter"},replay:{name:"maria"},required:["name","gender"]},
{family:"identity",case_id:"nationality_estimate_by_name",intent:"Given a first name, identify a public machine-readable API operation that returns that name and at least one estimated country code.",input_names:["name"],required_output_leaf_names:["name","country_code"],build:{name:"nathaniel"},replay:{name:"elizabeth"},required:["name","country_code"]},
{family:"culture",case_id:"artwork_object_metadata",intent:"Given a numeric museum object identifier, identify a public machine-readable API operation that returns the object identifier and human-readable artwork title.",input_names:["object_id"],required_output_leaf_names:["id","title"],build:{object_id:436121},replay:{object_id:437853},required:["id","title"]},
{family:"culture",case_id:"fictional_character_metadata",intent:"Given a numeric fictional-character identifier, identify a public machine-readable API operation that returns the identifier and human-readable character name.",input_names:["character_id"],required_output_leaf_names:["id","name"],build:{character_id:1},replay:{character_id:2},required:["id","name"]},
{family:"culture",case_id:"anime_title_metadata",intent:"Given an anime title, identify a public machine-readable API operation that returns a canonical numeric identifier and human-readable title for the matching anime.",input_names:["title_query"],required_output_leaf_names:["id","title"],build:{title_query:"Cowboy Bebop"},replay:{title_query:"Naruto"},required:["id","title"]},
{family:"transport",case_id:"vin_vehicle_metadata",intent:"Given a vehicle identification number, identify a public machine-readable API operation that returns the VIN and human-readable vehicle make.",input_names:["vin"],required_output_leaf_names:["vin","make"],build:{vin:"1HGCM82633A004352"},replay:{vin:"1M8GDM9AXKP042788"},required:["vin","make"]},
{family:"transport",case_id:"aircraft_registration_metadata",intent:"Given an aircraft registration or tail number, identify a public machine-readable API operation that returns the registration and aircraft model or type.",input_names:["registration"],required_output_leaf_names:["registration","model"],build:{registration:"N12345"},replay:{registration:"N787BA"},required:["registration","model"]},
{family:"transport",case_id:"airport_iata_metadata",intent:"Given an IATA airport code, identify a public machine-readable API operation that returns the IATA code and human-readable airport name.",input_names:["iata"],required_output_leaf_names:["iata","name"],build:{iata:"SJO"},replay:{iata:"JFK"},required:["iata","name"]},
{family:"science",case_id:"chemical_element_metadata",intent:"Given a chemical element symbol, identify a public machine-readable API operation that returns the element symbol and human-readable element name.",input_names:["symbol"],required_output_leaf_names:["symbol","name"],build:{symbol:"Fe"},replay:{symbol:"Au"},required:["symbol","name"]},
{family:"science",case_id:"protein_identifier_metadata",intent:"Given a public protein accession identifier, identify a public machine-readable API operation that returns the accession identifier and human-readable protein name.",input_names:["accession"],required_output_leaf_names:["accession","name"],build:{accession:"P69905"},replay:{accession:"P68871"},required:["accession","name"]},
{family:"science",case_id:"taxon_name_metadata",intent:"Given a scientific taxon name, identify a public machine-readable API operation that returns a canonical taxon identifier and scientific name.",input_names:["scientific_name"],required_output_leaf_names:["id","name"],build:{scientific_name:"Panthera leo"},replay:{scientific_name:"Panthera tigris"},required:["id","name"]}
];

function ci(a:any,b:any){return typeof a==="string"&&a.trim().toLowerCase()===String(b).trim().toLowerCase();}
function str(v:any){return typeof v==="string"&&v.trim().length>0;}
function num(v:any){return typeof v==="number"&&Number.isFinite(v);}
export function semanticValidate4a(id:string,input:Record<string,any>,out:Record<string,any>){
 if(id==="pypi_package_metadata"||id==="npm_package_metadata")return ci(out.name,input.package_name)&&str(out.version);
 if(id==="wikipedia_page_metadata")return str(out.title)&&str(out.description);
 if(id==="postal_code_location")return String(out.postal_code).replace(/\s/g,"")===String(input.postal_code).replace(/\s/g,"")&&str(out.country_name);
 if(id==="coordinate_timezone")return str(out.timezone);
 if(id==="coordinate_weather_metadata")return num(Number(out.latitude))&&num(Number(out.longitude))&&num(Number(out.temperature));
 if(id==="doi_publication_metadata")return ci(out.doi,input.doi)&&str(Array.isArray(out.title)?out.title[0]:out.title);
 if(id==="isbn_title_metadata")return str(out.title);
 if(id==="open_library_work_metadata")return str(out.id)&&str(out.title);
 if(id==="food_barcode_metadata")return String(out.code)===String(input.barcode)&&str(out.name);
 if(id==="meal_name_metadata")return ci(out.name,input.meal_name)&&str(out.category);
 if(id==="cocktail_name_metadata")return ci(out.name,input.drink_name)&&str(out.category);
 if(id==="age_estimate_by_name")return ci(out.name,input.name)&&Number(out.age)>0;
 if(id==="gender_estimate_by_name")return ci(out.name,input.name)&&str(out.gender);
 if(id==="nationality_estimate_by_name")return ci(out.name,input.name)&&str(out.country_code);
 if(id==="artwork_object_metadata")return Number(out.id)===Number(input.object_id)&&str(out.title);
 if(id==="fictional_character_metadata")return Number(out.id)===Number(input.character_id)&&str(out.name);
 if(id==="anime_title_metadata")return Number(out.id)>0&&str(out.title);
 if(id==="vin_vehicle_metadata")return ci(out.vin,input.vin)&&str(out.make);
 if(id==="aircraft_registration_metadata")return ci(out.registration,input.registration)&&str(out.model);
 if(id==="airport_iata_metadata")return ci(out.iata,input.iata)&&str(out.name);
 if(id==="chemical_element_metadata")return ci(out.symbol,input.symbol)&&str(out.name);
 if(id==="protein_identifier_metadata")return ci(out.accession,input.accession)&&str(out.name);
 if(id==="taxon_name_metadata")return Number(out.id)>0&&str(out.name);
 return false;
}
export const fourAFingerprint=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");
export function usageCost(u:any){const input=Number(u?.prompt_tokens??u?.input_tokens??0),output=Number(u?.completion_tokens??u?.output_tokens??0),cached=Number(u?.prompt_tokens_details?.cached_tokens??u?.input_tokens_details?.cached_tokens??0),uncached=Math.max(0,input-cached);return {input_tokens:input,output_tokens:output,cached_input_tokens:cached,cost_usd:(uncached*FOUR_A_PRICE.input_usd_per_million+cached*FOUR_A_PRICE.cached_input_usd_per_million+output*FOUR_A_PRICE.output_usd_per_million)/1_000_000};}
export function percentile(xs:number[],p:number){if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),i=Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1));return s[i];}
