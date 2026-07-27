import Anthropic from "@anthropic-ai/sdk";
import type { Bridge } from "@/lib/coalition";

// Optional Claude refinement for the Coalition Engine: classifies the top
// lexical matches into real relationships with a one-line rationale.
// Requires ANTHROPIC_API_KEY in .env; without it the app runs lexical-only.

export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface BridgeVerdict {
  verdict: "SAME_EFFORT" | "COMPLEMENTARY" | "WEAK";
  rationale: string;
}

const VERDICT_SCHEMA = {
  type: "object" as const,
  properties: {
    verdicts: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          index: { type: "integer" as const },
          verdict: {
            type: "string" as const,
            enum: ["SAME_EFFORT", "COMPLEMENTARY", "WEAK"],
          },
          rationale: {
            type: "string" as const,
            description: "One short sentence explaining the relationship",
          },
        },
        required: ["index", "verdict", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
};

// In-memory cache keyed by the bridge's node-id pair.
const verdictCache = new Map<string, BridgeVerdict>();

/**
 * Classify bridges with Claude. Returns a map keyed by "aId|bId". Cached
 * per pair; only uncached pairs are sent. Fails soft: on any API error the
 * uncached pairs simply stay unclassified.
 */
export async function refineBridges(
  bridges: Bridge[]
): Promise<Map<string, BridgeVerdict>> {
  const result = new Map<string, BridgeVerdict>();
  if (!aiAvailable()) return result;

  const pending: { key: string; bridge: Bridge }[] = [];
  for (const br of bridges) {
    const key = `${br.a.id}|${br.b.id}`;
    const cached = verdictCache.get(key);
    if (cached) result.set(key, cached);
    else pending.push({ key, bridge: br });
  }
  if (pending.length === 0) return result;

  const list = pending
    .map(
      ({ bridge: br }, i) =>
        `${i}. [${br.a.boardName}] "${br.a.title}"  <->  [${br.b.boardName}] "${br.b.title}"`
    )
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      system:
        "You analyze pairs of goals/strategies from different civic movements and judge whether they describe the same effort (could share organizing, resources, or a legislative vehicle), complementary efforts (distinct but naturally allied), or only a weak textual overlap. Be strict: shared vocabulary alone is WEAK.",
      output_config: {
        format: {
          type: "json_schema",
          schema: VERDICT_SCHEMA,
        },
      },
      messages: [
        {
          role: "user",
          content: `Classify each pair by index:\n\n${list}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return result;
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return result;
    const parsed = JSON.parse(block.text) as {
      verdicts: { index: number; verdict: BridgeVerdict["verdict"]; rationale: string }[];
    };
    for (const v of parsed.verdicts) {
      const entry = pending[v.index];
      if (!entry) continue;
      const verdict: BridgeVerdict = {
        verdict: v.verdict,
        rationale: v.rationale,
      };
      verdictCache.set(entry.key, verdict);
      result.set(entry.key, verdict);
    }
  } catch (err) {
    console.error("Coalition AI refinement failed:", err);
  }
  return result;
}
