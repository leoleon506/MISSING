# MISSING — Experiment 0

This repository contains only the preregistration-oriented infrastructure for **Experiment 0**: whether adding a clearly described fallback tool changes an agent's tool-selection behavior when a required capability is outside its inventory. It does not implement Experiment 1, capability generation, payments, deployment, UI, persistence, a marketplace, or Demand Genome. Do not treat mock runs as behavioral evidence.

## Two distinct layers

### A. Provider-level behavioral experiment

An OpenAI-compatible chat-completions provider makes a real, temperature-zero tool-selection decision. The provider sees the user task plus names, descriptions, and JSON input schemas returned by MCP. It never receives `ground_truth`, `case_family`, `difficulty`, `expected_tool`, case IDs, or condition labels. Its final text is retained as `final_agent_outcome` for later/manual analysis; this revision adds no LLM judge.

### B. Actual MCP transport and tool inventory

`createBenchmarkServer` is the single authoritative registration point for every schema and implementation. Each condition creates an MCP TypeScript SDK v2 server and client connected with the official in-memory transport. The runner obtains inventory with `listTools()` and performs every requested execution with `callTool()`. The standalone server uses the v2 Node stdio transport. There is no hand-maintained OpenAI schema copy.

The control and MISSING conditions preserve normal-tool order. A seed determines that order, the insertion position of `resolve_missing_capability`, and which member of each adjacent case pair runs first. Recorded fallback events contain request/case association, timestamp, requested capability, and invocation sequence; case association is evaluator-side and is not a tool argument.

## Dataset

`experiments/experiment-0/cases.json` contains 66 deterministic evaluator cases: 33 solvable and 33 requiring a genuinely absent external capability, across at least 15 paired capability families. Metadata fields `ground_truth`, `case_family`, optional `difficulty`, and `expected_tool` remain evaluator-only. Partial-coverage and realistic external-data boundaries are included; nonexistent attachments and reserved `.test` tasks are not.

## Metrics

Metrics are reported separately per condition:

- `fallback_selection_rate`: required-capability cases with an observed fallback invocation / all required-capability cases.
- `false_positive_rate`: normally solvable cases with an observed fallback invocation / all normally solvable cases.
- `no_fallback_rate`: required-capability cases without an observed fallback invocation / all required-capability cases. This is **not** called a give-up rate because selection alone cannot distinguish refusal, hallucination, or an unsupported answer.
- `correct_normal_tool_rate`: solvable cases where the expected normal tool appears anywhere in the call sequence.
- `first_tool_correct_rate`: solvable cases whose first call is the expected normal tool.
- `missing_first_call_rate`: required-capability cases whose first call is the MISSING tool.
- `precision_missing`: truly required fallback invocations / all fallback invocations (or `null` when none occur).

## Commands

```sh
npm ci
npm test
npm run build
# Paid behavioral run — intentionally not run as part of this revision:
OPENAI_API_KEY=... npm run benchmark
```

The benchmark command writes a JSON artifact under `results/`. CI only installs, tests, and builds; it never calls a paid provider.

The manual GitHub Actions workflow `Run MISSING Experiment 0` requires the repository secret `OPENAI_API_KEY`. It runs the locked dependency install, tests, build, then the real-agent benchmark and uploads the resulting `results/*.json` files as an artifact. The benchmark uses the configured model, seed, and MISSING description without changing the dataset or tool schemas.

## Remaining validity limits

The benchmark is still provider/model/prompt sensitive, has only 66 hand-authored cases, and records tool behavior rather than judging factual final answers. Tool descriptions can induce position or wording effects despite paired randomization. External-capability cases are evaluator assertions rather than live probes, while deterministic normal tools are deliberately artificial. A paid run, multi-model replication, blinded human review of final outcomes, power analysis, and confidence intervals remain future experimental work—not part of this revision.
