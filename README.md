# MISSING — Experiment 0

MISSING Experiment 0 asks one narrow behavioral question: **will a real agent autonomously call a fallback tool named `resolve_missing_capability` when its other tools cannot satisfactorily perform a task?** It compares the same 60 balanced tasks under a control condition (five normal tools) and a MISSING condition (the same tools plus the fallback). Tool order is reproducibly randomized.

This is measurement infrastructure, not the MISSING product. It does **not** build capabilities, a Factory, discovery, a marketplace, persistence, authentication, x402, a UI, deployment, or any mechanism that solves the requested task. The fallback only records an invocation and acknowledges that the capability is not available.

## Install and test

Requires Node.js 20 or newer.

```sh
npm install
npm test
npm run build
```

Tests are deterministic infrastructure checks. Their mocked agent is explicitly marked `infrastructure-mock`; mock output is never evidence for the hypothesis.

## Run a real-agent benchmark

The runner uses a real OpenAI-compatible Chat Completions tool-calling decision. It contains no task routing rules, keyword matching, labels, expected-tool hints, or hardcoded tool choices.

```sh
cp .env.example .env
# export values from .env in your preferred way, then:
OPENAI_API_KEY=... OPENAI_MODEL=gpt-4.1-mini npm run benchmark
```

For another compatible provider, set `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY`, and optionally `AGENT_PROVIDER`. Provider use can incur charges and requires network access. Results are written to `results/<run-id>.json`; console output includes every misclassification. The standalone MCP stdio server is available with `npm run mcp`.

### Fallback description variants

Set `MISSING_DESCRIPTION` without changing code:

```sh
MISSING_DESCRIPTION='Your experimental description' npm run benchmark
```

The exact description is saved in the result. Experiment 0 does not optimize it.

### Reproduce tool ordering

Every run records its base seed and every case result records the derived `random_seed`. Reuse the base seed printed in the run ID/configuration:

```sh
BENCHMARK_SEED=20250824 OPENAI_API_KEY=... npm run benchmark
```

This reproduces tool order, not necessarily provider output: hosted model behavior can be nondeterministic even at temperature zero.

## Isolation and interpretation

Fixtures contain evaluator-only `ground_truth` and `expected_tool` fields. `agentVisibleCase` creates a new object containing only `user_task` before the provider boundary. The agent sees the task and shuffled tool definitions only; labels, case IDs, expected tools, success thresholds, and condition names are never placed in its messages. Labels are joined back afterward for scoring.

Metrics are calculated separately by condition:

- **fallback selection rate**: required-capability cases that called MISSING / all required-capability cases.
- **false positive rate**: normally solvable cases that called MISSING / all normally solvable cases.
- **give-up rate**: required-capability cases that did not call MISSING / all required-capability cases. In control this is expected to be 100%, because MISSING is absent.
- **correct normal tool rate**: normally solvable cases that selected their evaluator-designated normal tool / all normally solvable cases.
- **precision MISSING**: required-capability MISSING calls / all MISSING calls (reported as `n/a` when there are none).

Human evaluation may regard fallback selection ≥70% with false positives ≤10% as a strong signal, 40–69% selection as promising, and below 40% as weak. These thresholds never enter agent context, and the report always preserves failures and raw outcomes.
