function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function publicLandingHtml(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  const mcpUrl = `${normalized}/mcp`;
  const a2aUrl = `${normalized}/.well-known/agent-card.json`;
  const resolveUrl = `${normalized}/v1/agent/resolve`;
  const githubUrl = "https://github.com/leoleon506/MISSING";
  const smitheryUrl = "https://smithery.ai/servers/leo-leon506/missing";

  const example = JSON.stringify({
    capability: "ip_geolocation_metadata",
    input: { ip_address: "1.1.1.1" },
  }, null, 2);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="MISSING is a capability fallback network for AI agents: discover replay-verified capabilities for free and execute them through x402." />
  <title>MISSING — Capability Fallback Network for AI Agents</title>
  <style>
    :root { color-scheme: dark; --bg:#07110f; --panel:#0d1916; --line:#20312c; --text:#f5f7f6; --muted:#a9b8b3; --accent:#53e3ad; --accent2:#9cf4d2; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 75% 0,#123328 0,transparent 34%),var(--bg); color:var(--text); }
    a { color:inherit; }
    .wrap { width:min(1120px,calc(100% - 40px)); margin:0 auto; }
    header { display:flex; justify-content:space-between; align-items:center; padding:26px 0; border-bottom:1px solid var(--line); }
    .brand { font-weight:800; letter-spacing:.08em; }
    nav { display:flex; gap:20px; color:var(--muted); font-size:14px; }
    main { padding:72px 0 84px; }
    .hero { display:grid; grid-template-columns:1.25fr .75fr; gap:48px; align-items:center; }
    .pill { display:inline-block; border:1px solid #2c5c4c; color:var(--accent2); padding:7px 11px; border-radius:999px; font-size:13px; margin-bottom:18px; }
    h1 { font-size:clamp(44px,7vw,82px); line-height:.96; margin:0 0 24px; letter-spacing:-.055em; }
    h2 { font-size:30px; margin:0 0 14px; letter-spacing:-.025em; }
    p { color:var(--muted); line-height:1.7; font-size:17px; }
    .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:30px; }
    .btn { text-decoration:none; border-radius:10px; padding:12px 16px; font-weight:700; border:1px solid var(--line); }
    .btn.primary { background:var(--accent); color:#052017; border-color:var(--accent); }
    .terminal,.card { background:rgba(13,25,22,.88); border:1px solid var(--line); border-radius:16px; }
    .terminal { padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.28); }
    .terminal small { color:var(--accent); }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; color:#dff7ee; line-height:1.6; margin:12px 0 0; font-size:13px; }
    section { margin-top:86px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
    .card { padding:22px; }
    .card strong { display:block; margin-bottom:8px; }
    .step { color:var(--accent); font-weight:800; font-size:13px; letter-spacing:.08em; }
    code { color:#cdf7e7; }
    .facts { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:22px; }
    .fact { border-top:1px solid var(--line); padding-top:12px; color:var(--muted); font-size:14px; }
    footer { border-top:1px solid var(--line); padding:26px 0 40px; color:var(--muted); font-size:13px; }
    @media (max-width:800px) { .hero,.grid,.facts { grid-template-columns:1fr; } nav { display:none; } main { padding-top:42px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">MISSING</div>
      <nav><a href="#how">How it works</a><a href="#connect">Connect</a><a href="${escapeHtml(githubUrl)}">GitHub</a></nav>
    </header>
    <main>
      <div class="hero">
        <div>
          <span class="pill">Public MCP + A2A + x402</span>
          <h1>Fallback capabilities for AI agents.</h1>
          <p>MISSING lets an agent search a replay-verified capability catalog, record unresolved demand, and hand off paid execution to one durable x402 rail. Discovery is free. Provider execution happens only after payment.</p>
          <div class="actions">
            <a class="btn primary" href="${escapeHtml(mcpUrl)}">MCP endpoint</a>
            <a class="btn" href="${escapeHtml(smitheryUrl)}">Open in Smithery</a>
            <a class="btn" href="${escapeHtml(githubUrl)}">View source</a>
          </div>
        </div>
        <div class="terminal">
          <small>POST ${escapeHtml(resolveUrl)}</small>
          <pre>${escapeHtml(example)}</pre>
          <pre>→ 402 PAYMENT-REQUIRED
→ sign x402 challenge
→ retry exact request
→ verified provider execution
→ settlement + response</pre>
        </div>
      </div>

      <section id="how">
        <h2>Agent flow</h2>
        <p>MISSING keeps discovery, demand collection, and paid execution separate so an agent can reason about each step explicitly.</p>
        <div class="grid">
          <div class="card"><span class="step">01 DISCOVER</span><strong>Search verified supply</strong><p>Use <code>search_verified_capabilities</code> for natural-language intent or <code>list_verified_capabilities</code> for the full catalog.</p></div>
          <div class="card"><span class="step">02 FALLBACK</span><strong>Record what is missing</strong><p>If nothing matches, <code>record_missing_capability_demand</code> persists the unresolved need for trusted acquisition.</p></div>
          <div class="card"><span class="step">03 EXECUTE</span><strong>Pay only at execution</strong><p><code>resolve_capability</code> returns the exact x402 handoff. The canonical HTTP endpoint performs the paid execution.</p></div>
        </div>
      </section>

      <section id="connect">
        <h2>Connect an agent</h2>
        <div class="grid">
          <div class="card"><strong>MCP Streamable HTTP</strong><p><code>${escapeHtml(mcpUrl)}</code></p><p>Public tools only. Discovery is free; execution returns an x402 handoff.</p></div>
          <div class="card"><strong>A2A Agent Card</strong><p><code>${escapeHtml(a2aUrl)}</code></p><p>Natural-language discovery plus exact-capability paid handoff through A2A JSON-RPC.</p></div>
          <div class="card"><strong>x402 paid endpoint</strong><p><code>${escapeHtml(resolveUrl)}</code></p><p>The single payment authority for verification, provider execution, settlement, recovery, and finality.</p></div>
        </div>
        <div class="facts">
          <div class="fact"><strong>Registry</strong><br/>Official MCP Registry</div>
          <div class="fact"><strong>Directories</strong><br/>Smithery + Glama</div>
          <div class="fact"><strong>Payment</strong><br/>x402 on Base</div>
          <div class="fact"><strong>Trust</strong><br/>Replay-verified supply only</div>
        </div>
      </section>
    </main>
    <footer>MISSING — capability discovery and paid resolution infrastructure for AI agents.</footer>
  </div>
</body>
</html>`;
}
