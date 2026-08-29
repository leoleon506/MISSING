# Experiment 5A — Preregistered Blind Generalization Holdout

## Preregistration status

This file MUST be the first 5A-specific commit. The holdout workload, semantic validators, thresholds and frozen-engine rule below are fixed before any live 5A execution. After the first live 5A case begins, neither cases nor validators nor thresholds may be changed.

5A is an evaluation experiment, not another optimization experiment.

## Frozen engine baseline

- Repository: `leoleon506/MISSING`
- Frozen MISSING engine commit: `a0ae7506df5c9be386e8be6a72fce8526aca1e11`
- This is the merge commit of PR #104 / Experiment 4W.
- 4W live workflow run: `33225691242`
- 4W artifact: `9706988683`
- 4W artifact digest: `sha256:9bbb50731fabcc8d1276d5fc8866b1b59abb76025345be668f7795826eec34c5`
- 4W report fingerprint: `190de9493972709d7cd88f00729e03502aa29d8a5f89ca48d5ac98fd24766269`
- 4W decision: `GO_4W_FEASIBILITY_CONSTRAINED_BINDING_DISTINCTIVE_SEMANTIC_GATE`
- Frozen model: `gpt-4.1-mini-2025-04-14`

Frozen 4W reference result:

- 8 / 24 successful manufactures
- 6 families with success
- 8 distinct successful providers
- 8 persisted recipes
- 8 / 8 successful changed-input replays
- replay rate 1.0
- validator graph mismatch rejects 0
- total LLM cost approximately USD 0.2293
- mean LLM cost per success approximately USD 0.0287

The 4W result remains GO under its preregistered rules. The post-hoc observation that one postal-code validator permitted an ambiguous country result motivates stricter 5A validators but MUST NOT change the 4W verdict.

## Frozen-engine rule

5A MUST NOT modify any pre-existing MISSING compiler, discovery, ranking, acquisition, request construction, validation, semantic grounding, schema-witness, replay, safety or cost-control source file.

The 5A branch may add only:

- `experiments/5a/**`
- `src/experiment5a*.ts` or `src/experiment5a*.mjs`
- `tests/experiment5a*.test.ts`
- `.github/workflows/run-experiment-5a.yml`

No existing source file, package dependency, provider catalog or benchmark implementation may be edited.

The live harness MUST verify at runtime that the Git diff from frozen commit `a0ae7506df5c9be386e8be6a72fce8526aca1e11` contains only the allowlisted 5A files above. Failure of this integrity check makes the run INVALID, not REASSESS.

The 5A harness may replace the case registry/evaluator only inside the disposable evaluation process. It may not patch the frozen 4W planner, compiler, binder, reranker, contract validator, probe logic, schema resolver or replay logic.

## Blindness definition

“Blind” means the following:

1. all holdout case definitions, build inputs, changed replay inputs, semantic validators and GO thresholds are frozen in this preregistration before the first live 5A benchmark;
2. the frozen 4W engine receives the task intent and build input needed to solve a case, but no expected answer, provider/domain seed, endpoint seed or evaluator result;
3. replay inputs are used only by the existing replay phase and are not a tuning signal;
4. no compiler or workload tuning is permitted after observing 5A live results.

This is a preregistered holdout, not a claim that the case file is cryptographically secret from the repository owner.

## Novelty constraints

The 18 case IDs below are absent from the 24-case 4A–4W development workload.

No task intent names a concrete API host, endpoint, provider company or domain. Ecosystem/identifier names such as Rust crate, Ruby gem, CVE, SPDX, arXiv, Ensembl-style gene identifier or NORAD catalog number are semantic parts of the requested object and are not runtime provider seeds.

No successful 4W provider host is seeded into 5A. The successful 4W provider set was:

- npm registry
- PostalCodes.info
- TheMealDB
- TheCocktailDB
- Agify
- Genderize
- Metropolitan Museum of Art collection API
- NHTSA vPIC

5A runtime code must not contain those provider domains as candidate seeds.

## Frozen workload

Exactly 18 cases across 10 semantic families.

### 1. `country_alpha_metadata` — geography / far transfer

Intent: Given an ISO alpha-2 country code, identify a public machine-readable operation that returns the same alpha-2 code, a human-readable country name and a human-readable region.

- input: `country_code`
- required outputs: `country_code`, `country_name`, `region`
- build: `CR`
- replay: `JP`
- strict validator: output country code equals input case-insensitively; country name and region are non-empty strings.

### 2. `city_country_geocode_metadata` — geography / far transfer

Intent: Given a city name and ISO alpha-2 country code, identify a public machine-readable operation that returns that city/country pair plus finite latitude and longitude.

- inputs: `city_name`, `country_code`
- required outputs: `city_name`, `country_code`, `latitude`, `longitude`
- build: `Ottawa`, `CA`
- replay: `Canberra`, `AU`
- strict validator: city and country code equal the supplied inputs case-insensitively; latitude and longitude are finite and inside physical bounds.

### 3. `pokemon_name_metadata` — games / far transfer

Intent: Given a Pokémon species name, identify a public machine-readable operation that returns its canonical name, positive numeric identifier and positive height value.

- input: `pokemon_name`
- required outputs: `name`, `id`, `height`
- build: `pikachu`
- replay: `bulbasaur`
- strict validator: canonical name equals input case-insensitively; id and height are positive finite numbers.

### 4. `english_word_definition_metadata` — language / far transfer

Intent: Given an English word, identify a public machine-readable dictionary operation that returns the same word and at least one non-empty human-readable definition.

- input: `word`
- required outputs: `word`, `definition`
- build: `hello`
- replay: `world`
- strict validator: returned word equals input case-insensitively; definition is a non-empty string.

### 5. `source_repository_metadata` — software / far transfer

Intent: Given a public source-code repository owner and repository name, identify a public machine-readable operation that returns the canonical `owner/repository` full name and its default branch.

- inputs: `owner`, `repository`
- required outputs: `full_name`, `default_branch`
- build: `torvalds`, `linux`
- replay: `python`, `cpython`
- strict validator: `full_name` equals the supplied `owner/repository` case-insensitively; default branch is non-empty.

### 6. `rust_crate_metadata` — software / near transfer

Intent: Given a Rust crate name, identify a public machine-readable operation that returns the canonical crate name and a current version string.

- input: `package_name`
- required outputs: `name`, `version`
- build: `serde`
- replay: `tokio`
- strict validator: returned name equals input case-insensitively; version is a non-empty version-like string containing a numeric component.

### 7. `ruby_gem_metadata` — software / near transfer

Intent: Given a Ruby gem name, identify a public machine-readable operation that returns the canonical gem name and a current version string.

- input: `package_name`
- required outputs: `name`, `version`
- build: `rails`
- replay: `rake`
- strict validator: returned name equals input case-insensitively; version is a non-empty version-like string containing a numeric component.

### 8. `chess_player_metadata` — games / far transfer

Intent: Given a public chess username, identify a public machine-readable operation that returns the same canonical username and a non-empty chess title.

- input: `username`
- required outputs: `username`, `title`
- build: `magnuscarlsen`
- replay: `hikaru`
- strict validator: returned username equals input case-insensitively and title is a non-empty string.

### 9. `protein_structure_metadata` — science / far transfer

Intent: Given a Protein Data Bank structure identifier, identify a public machine-readable operation that returns the same structure identifier and a non-empty human-readable structure title.

- input: `structure_id`
- required outputs: `structure_id`, `title`
- build: `1CRN`
- replay: `4HHB`
- strict validator: returned identifier equals input case-insensitively and title is non-empty.

### 10. `public_domain_book_metadata` — literature / near transfer

Intent: Given a numeric public-domain ebook catalog identifier, identify a public machine-readable operation that returns the same numeric identifier and the book title.

- input: `book_id`
- required outputs: `id`, `title`
- build: `1342`
- replay: `84`
- strict validator: numeric returned id equals input and title is non-empty.

### 11. `cve_vulnerability_metadata` — security / far transfer

Intent: Given a CVE identifier, identify a public machine-readable operation that returns the same CVE identifier and a non-empty human-readable vulnerability description.

- input: `cve_id`
- required outputs: `cve_id`, `description`
- build: `CVE-2021-44228`
- replay: `CVE-2014-0160`
- strict validator: returned CVE id equals input case-insensitively and description contains at least 20 non-whitespace characters.

### 12. `television_show_metadata` — media / far transfer

Intent: Given a television show name, identify a public machine-readable operation that returns the canonical matching show name, a positive numeric identifier and a premiere date.

- input: `show_name`
- required outputs: `name`, `id`, `premiered`
- build: `Breaking Bad`
- replay: `Severance`
- strict validator: returned name equals input case-insensitively; id is positive; premiere date matches `YYYY-MM-DD`.

### 13. `satellite_catalog_metadata` — space / far transfer

Intent: Given a NORAD catalog number, identify a public machine-readable operation that returns the same catalog number and a non-empty satellite/object name.

- input: `norad_catalog_id`
- required outputs: `norad_catalog_id`, `name`
- build: `25544`
- replay: `20580`
- strict validator: numeric catalog id equals input and name is non-empty.

### 14. `spdx_license_metadata` — software / far transfer

Intent: Given an SPDX license identifier, identify a public machine-readable operation that returns the same license identifier, its human-readable license name and a boolean OSI-approval indicator.

- input: `license_id`
- required outputs: `license_id`, `name`, `osi_approved`
- build: `MIT`
- replay: `Apache-2.0`
- strict validator: returned identifier equals input case-insensitively; name is non-empty; OSI approval is boolean.

### 15. `arxiv_preprint_metadata` — publication / far transfer

Intent: Given an arXiv identifier, identify a public machine-readable operation that returns an identifier referring to that same arXiv record and its non-empty title.

- input: `arxiv_id`
- required outputs: `arxiv_id`, `title`
- build: `1706.03762`
- replay: `1810.04805`
- strict validator: normalized returned identifier contains the supplied arXiv identifier after URL/version normalization; title is non-empty.

### 16. `gene_identifier_metadata` — science / far transfer

Intent: Given a stable Ensembl-style gene identifier, identify a public machine-readable operation that returns the same gene identifier, a non-empty display name and a non-empty species value.

- input: `gene_id`
- required outputs: `gene_id`, `display_name`, `species`
- build: `ENSG00000157764`
- replay: `ENSG00000139618`
- strict validator: gene id equals input case-insensitively; display name and species are non-empty.

### 17. `dns_a_record_metadata` — network / far transfer

Intent: Given a domain name, identify a public machine-readable DNS lookup operation that returns at least one A-record answer whose owner name is the supplied domain and whose data is an IPv4 address.

- input: `domain_name`
- required outputs: `answer_name`, `address`
- build: `example.com`
- replay: `iana.org`
- strict validator: answer owner name, after removal of a trailing dot, equals input case-insensitively; address is syntactically valid IPv4.

### 18. `ip_geolocation_metadata` — network / far transfer

Intent: Given a public IPv4 address, identify a public machine-readable geolocation operation that returns that same IP address, a two-letter country code and a human-readable country name.

- input: `ip_address`
- required outputs: `ip_address`, `country_code`, `country_name`
- build: `8.8.8.8`
- replay: `1.1.1.1`
- strict validator: returned IP equals input; country code is exactly two alphabetic characters; country name is non-empty.

## Frozen evaluation budget

- cases: 18
- semantic families: 10
- maximum provider attempts per case: 8
- maximum documentation pages per provider: 8
- maximum documentation depth: 2
- maximum fetched bytes per document: 4 MiB
- model and token pricing: identical to frozen 4W
- maximum total LLM cost: USD 3.00
- maximum mean LLM cost per successful manufacture: USD 0.15
- maximum median successful latency: 90 seconds
- maximum p90 successful latency: 180 seconds

## Primary generalization threshold

A valid 5A run is GO only if ALL of the following hold:

1. at least 6 / 18 holdout cases manufacture successfully;
2. successful cases span at least 6 of the 10 holdout semantic families;
3. successful recipes use at least 6 distinct providers;
4. every successful manufacture persists a recipe;
5. changed-input replay succeeds for at least 95% of persisted successful recipes;
6. replay performs zero catalog discovery, reranking, documentation acquisition, synthesis or schema-role LLM calls;
7. no auth-like request is rendered or probed;
8. no known-auth endpoint is probed;
9. no wrong-task/entity-incompatible structural probe is executed;
10. no confirmed request origin/path/input/literal binding is mutated after successful execution;
11. no external OpenAPI reference is fetched;
12. no unverified schema-role field or generated output value is accepted;
13. `validatorGraphMismatchRejects == 0`;
14. no duplicate probe/acquisition/spec network fetch regression occurs;
15. total and mean LLM cost remain within the frozen budget;
16. median and p90 successful latency remain within the frozen budget;
17. the frozen-engine integrity check passes;
18. all 18 cases are executed exactly once in the primary workload and all 18 have a completed rerank attempt.

The threshold of 6 / 18 is exactly the same one-third manufacture rate reached by 4W (8 / 24); it is not lowered after observing holdout performance.

## Secondary diagnostics — not GO criteria

Report, without changing the decision:

- near-transfer success rate;
- far-transfer success rate;
- family-by-family success;
- provider diversity;
- inherited lane vs native OpenAPI lane success;
- semantic-witness use;
- JSON vs XML/CSV success;
- per-case cost and latency;
- failures by stage: provider discovery, documentation, operation construction, probe transport, structured decoding, semantic grounding, validation or replay.

## Invalidation conditions

Return `INVALID_5A_ENGINE_INTEGRITY` rather than GO/REASSESS if any of the following occurs:

- a pre-existing non-5A source file differs from frozen commit `a0ae7506df5c9be386e8be6a72fce8526aca1e11`;
- workload count or case fingerprint differs from this preregistration;
- any case, replay input, semantic validator or threshold is changed after the first live run begins;
- a provider/domain/endpoint seed is added specifically for a holdout case;
- MISSING receives an expected answer or semantic-validator result before producing its candidate output;
- the live benchmark is run from the PR branch before merge.

A harness/build failure that occurs before the first holdout case is attempted may be fixed only as an implementation hotfix that does not modify this preregistration, workload, validator, frozen engine or thresholds. A failure after any holdout case has been observed consumes the 5A holdout; subsequent changes require a new experiment/workload.

## Decision strings

- `GO_5A_BLIND_GENERALIZATION_HOLDOUT`
- `REASSESS_5A_BLIND_GENERALIZATION_HOLDOUT`
- `INVALID_5A_ENGINE_INTEGRITY`

## Execution rule

The live benchmark is manual-only after merge to `main` through workflow:

`Run MISSING Experiment 5A`

Do not run the live 5A benchmark from the PR.
