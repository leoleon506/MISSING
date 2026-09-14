import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { quoteCapability } from "../runtime/charging.js";
import { publicPaidResolutionHandoff } from "../runtime/publicPaidHandoff.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import type { RuntimeInput, VerifiedRecipe } from "../runtime/types.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

const RESERVED_TOOL_NAMES = new Set([
  "list_verified_capabilities",
  "search_verified_capabilities",
  "record_missing_capability_demand",
  "resolve_capability",
  "missing_demand_snapshot",
  "missing_supply_opportunities",
  "discover_supply_candidates",
  "verify_supply_candidate",
  "acquire_verified_supply_candidate",
  "missing_supply_promotion_evidence",
  "missing_agent_rank",
  "missing_economics",
  "missing_prepaid_credits",
  "missing_credit_account",
  "missing_runtime_health",
  "missing_charge_quote",
  "resolve_capability_charged",
  "missing_charging_snapshot",
  "compile_openapi_candidate",
  "run_supply_acquisition_cycle",
]);

const PURPOSES: Record<string, string> = {
  country_alpha_metadata: "look up a country's name and region from its alpha country code",
  pokemon_name_metadata: "look up Pokémon metadata by name",
  chess_player_metadata: "look up public Chess.com player metadata by username",
  television_show_metadata: "look up television-show metadata by show name",
  satellite_catalog_metadata: "look up satellite catalog metadata by NORAD catalog identifier",
  ip_geolocation_metadata: "look up country-level geolocation metadata for an IP address",
  currency_exchange_rate: "look up the current exchange rate between two currencies",
  dns_record_lookup: "look up public DNS records for a hostname and record type",
  domain_rdap_metadata: "look up public RDAP registration metadata for a domain",
  npm_package_metadata: "look up current npm package metadata",
  pypi_package_metadata: "look up current PyPI package metadata",
  nuget_package_versions: "look up published NuGet package versions",
  github_repository_metadata: "look up public GitHub repository metadata",
  github_user_metadata: "look up public GitHub user metadata",
  postal_code_location_metadata: "look up place and coordinate metadata from a country code and postal code",
};

function titleFromCapability(capability: string): string {
  return capability
    .split("_")
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function purposeForCapability(capability: string): string {
  return PURPOSES[capability] ?? `resolve the verified MISSING capability ${capability}`;
}

function fieldSchema(name: string, value: unknown): z.ZodTypeAny {
  const example = JSON.stringify(value);
  const description = `Required input field '${name}'. Example: ${example}.`;
  if (typeof value === "string") return z.string().min(1).describe(description);
  if (typeof value === "number") return z.number().finite().describe(description);
  if (typeof value === "boolean") return z.boolean().describe(description);
  if (Array.isArray(value)) return z.array(z.unknown()).describe(description);
  if (value && typeof value === "object") return z.record(z.string(), z.unknown()).describe(description);
  return z.unknown().describe(description);
}

export function nativeCapabilityToolName(capability: string): string | null {
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(capability)) return null;
  if (RESERVED_TOOL_NAMES.has(capability)) return null;
  return capability;
}

function inputSchemaForRecipe(recipe: VerifiedRecipe) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, value] of Object.entries(recipe.example_input)) shape[name] = fieldSchema(name, value);
  return z.object(shape);
}

export interface NativeCapabilityToolDescriptor {
  name: string;
  capability: string;
  title: string;
  description: string;
  family: string;
  providers: string[];
  example_input: RuntimeInput;
  inputSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

/**
 * Return only capabilities that are both replay-verified and commercially
 * executable under the current fail-closed Kappa economics policy.
 */
export function nativeCapabilityToolDescriptors(): NativeCapabilityToolDescriptor[] {
  const grouped = new Map<string, VerifiedRecipe[]>();
  for (const recipe of VERIFIED_RECIPES) {
    const bucket = grouped.get(recipe.capability) ?? [];
    bucket.push(recipe);
    grouped.set(recipe.capability, bucket);
  }

  const descriptors: NativeCapabilityToolDescriptor[] = [];
  for (const [capability, recipes] of grouped) {
    const name = nativeCapabilityToolName(capability);
    if (!name) continue;
    const quote = quoteCapability(capability);
    if (quote.status !== "quoted") continue;

    const primary = recipes[0];
    descriptors.push({
      name,
      capability,
      title: titleFromCapability(capability),
      description: `Use this direct MISSING tool to ${purposeForCapability(capability)}. Prefer this tool when the caller's task matches this capability; do not first call list_verified_capabilities or search_verified_capabilities. This MCP call is a free, non-charging preparation step and does not contact the provider. It returns the canonical payment_required x402 handoff for /v1/agent/resolve, including the current price and exact request body. Complete the returned HTTP x402 instructions to execute the provider.`,
      family: primary.family,
      providers: [...new Set(recipes.map(recipe => recipe.provider))],
      example_input: structuredClone(primary.example_input),
      inputSchema: inputSchemaForRecipe(primary),
    });
  }

  return descriptors.sort((a, b) => a.name.localeCompare(b.name));
}

/** Register native capability tools before the four meta-tools to maximize tool selection. */
export function registerNativeCapabilityTools(server: McpServer) {
  for (const descriptor of nativeCapabilityToolDescriptors()) {
    server.registerTool(descriptor.name, {
      title: descriptor.title,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async args => content(publicPaidResolutionHandoff(descriptor.capability, args as RuntimeInput, "mcp")));
  }
}
