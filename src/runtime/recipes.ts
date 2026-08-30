import type { RuntimeInput, VerifiedRecipe } from "./types.js";

const verified = (recipe: Omit<VerifiedRecipe, "verification">): VerifiedRecipe => ({
  ...recipe,
  verification: {
    status: "replay_verified",
    source: "experiment",
    source_experiment: "5B14",
    resilience_experiment: "5B15",
    source_run_id: 33283645154,
  },
});

const productVerified = (
  recipe: Omit<VerifiedRecipe, "verification">,
  verification: { verification_inputs: RuntimeInput[]; verified_at: string; evidence_url: string },
): VerifiedRecipe => ({
  ...recipe,
  verification: {
    status: "replay_verified",
    source: "product_live",
    ...verification,
  },
});

export const VERIFIED_RECIPES: VerifiedRecipe[] = [
  verified({
    capability: "country_alpha_metadata", family: "geography", provider: "Warnely",
    provider_candidate_id: "r2045_5d53d45e3f", recipe_fingerprint: "2397865423586696accd6acb37c134ff1d9b60c107807a8f34449646e51f89e3",
    method: "GET", base_url: "https://www.warnely.com", path_template: "/api/v1/countries/{iso}",
    path_bindings: { iso: "$input.country_code" }, query_bindings: {},
    projection: { country_code: { op: "INPUT", name: "country_code" }, region: { op: "FIELD", path: "country.region" }, country_name: { op: "FIELD", path: "country.name" } },
    required: ["country_code", "country_name", "region"], example_input: { country_code: "JP" },
  }),
  productVerified({
    capability: "country_alpha_metadata", family: "geography", provider: "countries.dev",
    provider_candidate_id: "product_countries_dev_alpha", recipe_fingerprint: "c0a7d71e636f89ac19a5f652680f0f004d0dbf0d6452b894f96818825462a017",
    method: "GET", base_url: "https://countries.dev", path_template: "/alpha/{code}",
    path_bindings: { code: "$input.country_code" }, query_bindings: {},
    projection: { country_code: { op: "FIELD", path: "alpha2Code" }, region: { op: "FIELD", path: "region" }, country_name: { op: "FIELD", path: "name" } },
    required: ["country_code", "country_name", "region"], example_input: { country_code: "JP" },
  }, {
    verification_inputs: [{ country_code: "JP" }, { country_code: "US" }],
    verified_at: "2026-08-30T04:58:00Z",
    evidence_url: "https://countries.dev/docs/api/alpha",
  }),
  verified({
    capability: "pokemon_name_metadata", family: "games", provider: "Pokéapi",
    provider_candidate_id: "r2011_cc56c440e8", recipe_fingerprint: "58d31019de84fbab3272073797ae5d26f925ec7c15c95c262dbe59d22b3d31e5",
    method: "GET", base_url: "https://pokeapi.co", path_template: "/api/v2/pokemon/{pokemon_name}",
    path_bindings: { pokemon_name: "$input.pokemon_name" }, query_bindings: {},
    projection: { name: { op: "INPUT", name: "pokemon_name" }, id: { op: "FIELD", path: "id" }, height: { op: "FIELD", path: "height" } },
    required: ["name", "id", "height"], example_input: { pokemon_name: "bulbasaur" },
  }),
  verified({
    capability: "chess_player_metadata", family: "games", provider: "Chess.com",
    provider_candidate_id: "r2001_f4b3457189", recipe_fingerprint: "81f530d8501eb9b06f36a2eda1240fc597336257b3f94bc32d0464b8bed47f56",
    method: "GET", base_url: "https://api.chess.com", path_template: "/pub/player/{username}",
    path_bindings: { username: "$input.username" }, query_bindings: {},
    projection: { username: { op: "INPUT", name: "username" }, title: { op: "FIELD", path: "title" } },
    required: ["username", "title"], example_input: { username: "hikaru" },
  }),
  verified({
    capability: "television_show_metadata", family: "media", provider: "TVMaze",
    provider_candidate_id: "r2016_7cbffced6f", recipe_fingerprint: "c9a3689afc5f27d5962d81fcb83d281da715134179e9b91da7e68138178b10",
    method: "GET", base_url: "https://api.tvmaze.com", path_template: "/search/shows?q=girls",
    path_bindings: {}, query_bindings: { q: "$input.show_name" },
    projection: { name: { op: "INPUT", name: "show_name" }, premiered: { op: "FIELD", path: "0.show.premiered" }, id: { op: "FIELD", path: "0.show.id" } },
    required: ["name", "id", "premiered"], example_input: { show_name: "Severance" },
  }),
  verified({
    capability: "satellite_catalog_metadata", family: "space", provider: "OrbitalWiki",
    provider_candidate_id: "r2001_53b1e84db0", recipe_fingerprint: "0d49092610279785e94b576b31be901219519e3c4e5b95bc024e6af1002362ce",
    method: "GET", base_url: "https://www.orbitalwiki.com", path_template: "/api/v1/satellites/{norad_catalog_id}",
    path_bindings: { norad_catalog_id: "$input.norad_catalog_id" }, query_bindings: {},
    projection: { norad_catalog_id: { op: "INPUT", name: "norad_catalog_id" }, name: { op: "FIELD", path: "data.name" } },
    required: ["norad_catalog_id", "name"], example_input: { norad_catalog_id: 20580 },
  }),
  verified({
    capability: "ip_geolocation_metadata", family: "network", provider: "ipwhois",
    provider_candidate_id: "r2005_55752742db", recipe_fingerprint: "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6",
    method: "GET", base_url: "https://ipwho.is", path_template: "/{ip_address}",
    path_bindings: { ip_address: "$input.ip_address" }, query_bindings: {},
    projection: { ip_address: { op: "INPUT", name: "ip_address" }, country_code: { op: "FIELD", path: "country_code" }, country_name: { op: "FIELD", path: "country" } },
    required: ["ip_address", "country_code", "country_name"], example_input: { ip_address: "1.1.1.1" },
  }),
];

export const recipesForCapability = (capability: string) => VERIFIED_RECIPES.filter(r => r.capability === capability);
