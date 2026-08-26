import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3i/README.md","utf8");

describe("Experiment 3I preregistration",()=>{
  it("freezes deterministic canonicalization",()=>{
    expect(readme).toContain("`id`, `identifier`, `key` -> `identifier`");
    expect(readme).toContain("`url`, `uri`, `link`, `href` -> `url`");
    expect(readme).toContain("The canonical concept is the sorted remaining token set joined by `+`");
  });
  it("requires different surface names and context evidence",()=>{
    expect(readme).toContain("uses **different surface field names** but the same canonical concept");
    expect(readme).toContain("direct exact-normalized field-name equality among successful bridges = **0**");
    expect(readme).toContain("textual context evidence");
  });
  it("forbids learned semantic shortcuts",()=>{
    expect(readme).toContain("uses **no LLM**, **no embeddings**, **no credentials**, and **no paid APIs**");
    expect(readme).toContain("planner/LLM/embedding calls = **0**");
  });
});
