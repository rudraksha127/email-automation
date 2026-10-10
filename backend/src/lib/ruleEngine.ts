/**
 * Generic, deterministic group-detection + forwarding-rule engine.
 *
 * SEMantics (explicit and testable — no "first match wins"):
 *
 * 1. Group-name mentions: every configured group name is matched literally in
 *    subject+body (case-insensitive; spaces/hyphens/underscores flexible,
 *    token-boundary anchored). Example: group "Internship Group" matches
 *    "internship-group update" but not "internshipgroups".
 *
 * 2. Rule matches: a rule participates only when it is active, its optional
 *    sender_pattern equals the sender (exact, case-insensitive), AND every
 *    keyword field it specifies has at least one hit (AND across fields,
 *    OR within a field, case-insensitive substring). A rule with no keywords
 *    at all is invalid and never matches. A rule without a target never matches.
 *
 * 3. Precedence: matching rules with DIFFERENT targets are only a conflict if
 *    they share the highest priority among them — the unique highest-priority
 *    target wins (explicitly configured precedence). Two different targets at
 *    the SAME top priority => ambiguous => Needs Review.
 *
 * 4. Combination with mentions:
 *      - exactly one group mentioned, and no conflicting rule winner => single
 *      - rule winner exists, no mentions => single (matched by rule)
 *      - rule winner differs from the single mentioned group => ambiguous
 *      - 2+ groups mentioned => ambiguous
 *      - nothing matches => none
 *    Ambiguous / none => Needs Review, never automatic forwarding.
 */

export interface DetectionGroup {
  id: string;
  name: string;
}

export interface DetectionRule {
  id: string;
  targetBatchId: string;
  priority: number;
  active: boolean;
  /** exact sender email or null = any sender */
  senderPattern: string | null;
  subjectKeywords: string[];
  bodyKeywords: string[];
}

export type DetectionOutcome =
  | { kind: "single"; batchId: string; matchedBy: "rule" | "name" }
  | { kind: "none" }
  | { kind: "ambiguous"; reason: string; candidates: string[] };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Flexible, token-boundary-anchored literal match for a group name.
 *  Matches the name in order ("Batch 2028") AND fully reversed ("2028 batch"). */
export function groupNamePattern(name: string): RegExp | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/[\s\-_]+/).filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return null;
  const sep = "[\\s\\-_]+";
  const ordered = tokens.join(sep);
  const reversed = [...tokens].reverse().join(sep);
  const body = ordered === reversed ? ordered : `(?:${ordered}|${reversed})`;
  return new RegExp(`(?<![\\w])${body}(?![\\w])`, "i");
}

/** Distinct configured group ids mentioned anywhere in subject+body. */
export function findMentionedGroups(
  subject: string,
  body: string,
  groups: DetectionGroup[]
): string[] {
  const haystack = `${subject ?? ""}\n${body ?? ""}`;
  const found = new Set<string>();
  for (const g of groups) {
    const re = groupNamePattern(g.name);
    if (re && re.test(haystack)) found.add(g.id);
  }
  return [...found];
}

function keywordsHit(keywords: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const kk = k.trim().toLowerCase();
    return kk.length > 0 && lower.includes(kk);
  });
}

/** Which rules match this message (rule semantics §2 above). */
export function matchingRules(
  rules: DetectionRule[],
  sender: string,
  subject: string,
  body: string
): DetectionRule[] {
  const senderLower = (sender ?? "").trim().toLowerCase();
  return rules.filter((r) => {
    if (!r.active || !r.targetBatchId) return false;
    if (r.senderPattern && r.senderPattern.trim().toLowerCase() !== senderLower) return false;
    const subj = r.subjectKeywords.filter((k) => k.trim());
    const bod = r.bodyKeywords.filter((k) => k.trim());
    if (subj.length === 0 && bod.length === 0) return false; // invalid rule
    if (subj.length > 0 && !keywordsHit(subj, subject ?? "")) return false;
    if (bod.length > 0 && !keywordsHit(bod, body ?? "")) return false;
    return true;
  });
}

/**
 * Rule winner under §3: unique highest priority among matching rules;
 * distinct targets at the same top priority => conflict (null + conflict=true).
 */
export function ruleWinner(matches: DetectionRule[]): {
  winner: DetectionRule | null;
  conflict: boolean;
} {
  if (matches.length === 0) return { winner: null, conflict: false };
  const sorted = [...matches].sort((a, b) => b.priority - a.priority);
  const top = sorted[0]!.priority;
  const topRules = sorted.filter((r) => r.priority === top);
  const targets = [...new Set(topRules.map((r) => r.targetBatchId))];
  if (targets.length > 1) return { winner: null, conflict: true };
  return { winner: topRules[0]!, conflict: false };
}

/** Full decision for one message (§4). */
export function detectTarget(opts: {
  groups: DetectionGroup[];
  rules: DetectionRule[];
  sender: string;
  subject: string;
  body: string;
}): DetectionOutcome {
  const mentioned = findMentionedGroups(opts.subject, opts.body, opts.groups);
  const matches = matchingRules(opts.rules, opts.sender, opts.subject, opts.body);
  const { winner, conflict } = ruleWinner(matches);

  if (conflict) {
    return {
      kind: "ambiguous",
      reason: "Conflicting rules with equal priority match this message",
      candidates: [...new Set(matches.filter((m) => m.priority === Math.max(...matches.map((x) => x.priority))).map((m) => m.targetBatchId))],
    };
  }

  if (mentioned.length > 1) {
    return {
      kind: "ambiguous",
      reason: `Multiple groups mentioned (${mentioned.length})`,
      candidates: mentioned,
    };
  }

  if (mentioned.length === 1) {
    const mentionedId = mentioned[0]!;
    if (winner && winner.targetBatchId !== mentionedId) {
      return {
        kind: "ambiguous",
        reason: "Rule target conflicts with the mentioned group",
        candidates: [winner.targetBatchId, mentionedId],
      };
    }
    return { kind: "single", batchId: mentionedId, matchedBy: winner ? "rule" : "name" };
  }

  if (winner) return { kind: "single", batchId: winner.targetBatchId, matchedBy: "rule" };

  if (matches.length > 0) {
    // reachable only when every matching rule was invalid (no target)
    return { kind: "none" };
  }
  return { kind: "none" };
}
