import { describe, it, expect } from "vitest";
import {
  detectTarget, matchingRules, ruleWinner, findMentionedGroups, groupNamePattern,
  type DetectionGroup, type DetectionRule,
} from "@/lib/ruleEngine";

const groups: DetectionGroup[] = [
  { id: "g2027", name: "Batch 2027" },
  { id: "gintern", name: "Internship Group" },
  { id: "gplace", name: "Placement Updates" },
];

const rule = (over: Partial<DetectionRule> = {}): DetectionRule => ({
  id: "r1",
  targetBatchId: "gintern",
  priority: 0,
  active: true,
  senderPattern: null,
  subjectKeywords: [],
  bodyKeywords: [],
  ...over,
});

describe("group name mentions", () => {
  it("detects a configured group from the subject", () => {
    expect(detectTarget({ groups, rules: [], sender: "a@x.com", subject: "Internship Opportunity - Batch 2027", body: "" }))
      .toEqual({ kind: "single", batchId: "g2027", matchedBy: "name" });
  });

  it("tolerates flexible separators and case", () => {
    const re = groupNamePattern("Internship Group")!;
    expect(re.test("INTERNSHIP-GROUP update")).toBe(true);
    expect(re.test("internship group update")).toBe(true);
    expect(findMentionedGroups("update", "the internship_group notice", groups)).toEqual(["gintern"]);
  });

  it("respects token boundaries (Batch 20270 does not match Batch 2027)", () => {
    expect(findMentionedGroups("Batch 20270", "", groups)).toEqual([]);
    expect(findMentionedGroups("ref 12027", "", groups)).toEqual([]);
    expect(findMentionedGroups("Batch 2027", "", groups)).toEqual(["g2027"]);
  });

  it("no configured group mentioned -> none", () => {
    expect(detectTarget({ groups, rules: [], sender: "a@x.com", subject: "Weekly newsletter", body: "—" }))
      .toEqual({ kind: "none" });
  });

  it("two groups mentioned -> ambiguous, never auto-picked", () => {
    const out = detectTarget({
      groups, rules: [], sender: "a@x.com",
      subject: "Opportunity for Batch 2027 and Internship Group", body: "",
    });
    expect(out.kind).toBe("ambiguous");
    if (out.kind === "ambiguous") expect(out.candidates.sort()).toEqual(["g2027", "gintern"]);
  });
});

describe("rule matching semantics", () => {
  it("subject keyword match with no mentions -> single by rule", () => {
    const out = detectTarget({
      groups, rules: [rule({ subjectKeywords: ["stipend"] })],
      sender: "a@x.com", subject: "Stipend details", body: "",
    });
    expect(out).toEqual({ kind: "single", batchId: "gintern", matchedBy: "rule" });
  });

  it("AND across specified fields, OR within a field", () => {
    const r = rule({ subjectKeywords: ["stipend", "internship"], bodyKeywords: ["apply"] });
    // subject hit + body hit => match
    expect(matchingRules([r], "a@x.com", "Internship stipend", "Please apply now")).toHaveLength(1);
    // subject hit but body miss => no match
    expect(matchingRules([r], "a@x.com", "Internship stipend", "nothing relevant")).toHaveLength(0);
    // OR within subject list
    expect(matchingRules([r], "a@x.com", "stipend announced", "apply")).toHaveLength(1);
  });

  it("sender pattern must match exactly (case-insensitive)", () => {
    const r = rule({ senderPattern: "hr@corp.com", subjectKeywords: ["notice"] });
    expect(matchingRules([r], "HR@Corp.com", "notice", "")).toHaveLength(1);
    expect(matchingRules([r], "other@corp.com", "notice", "")).toHaveLength(0);
  });

  it("inactive rules and keyword-less rules never match", () => {
    expect(matchingRules([rule({ active: false, subjectKeywords: ["x"] })], "a@x", "x", "")).toHaveLength(0);
    expect(matchingRules([rule({})], "a@x", "", "")).toHaveLength(0);
  });

  it("unconfigured groups in text do not create candidates", () => {
    // Only configured group names participate — 2026 is not a workspace group.
    const out = detectTarget({ groups, rules: [], sender: "a@x.com", subject: "Notice for Batch 2026 and Batch 2027", body: "" });
    expect(out).toEqual({ kind: "single", batchId: "g2027", matchedBy: "name" });
  });
});

describe("rule priority and conflicts", () => {
  it("unique highest priority wins across differing targets", () => {
    const matches = [
      rule({ id: "r1", targetBatchId: "g2027", priority: 10, subjectKeywords: ["x"] }),
      rule({ id: "r2", targetBatchId: "gplace", priority: 5, subjectKeywords: ["x"] }),
    ];
    const { winner, conflict } = ruleWinner(matches);
    expect(conflict).toBe(false);
    expect(winner?.targetBatchId).toBe("g2027");
  });

  it("same top priority + different targets => conflict", () => {
    const { winner, conflict } = ruleWinner([
      rule({ id: "r1", targetBatchId: "g2027", priority: 5, subjectKeywords: ["x"] }),
      rule({ id: "r2", targetBatchId: "gplace", priority: 5, subjectKeywords: ["x"] }),
    ]);
    expect(winner).toBeNull();
    expect(conflict).toBe(true);
  });

  it("conflicting rules => ambiguous (Needs Review)", () => {
    const out = detectTarget({
      groups,
      rules: [
        rule({ id: "r1", targetBatchId: "g2027", priority: 5, subjectKeywords: ["meet"] }),
        rule({ id: "r2", targetBatchId: "gplace", priority: 5, subjectKeywords: ["meet"] }),
      ],
      sender: "a@x.com", subject: "meeting soon", body: "",
    });
    expect(out.kind).toBe("ambiguous");
  });

  it("rule target conflicting with mentioned group => ambiguous", () => {
    const out = detectTarget({
      groups,
      rules: [rule({ targetBatchId: "gplace", subjectKeywords: ["batch 2027"] })],
      sender: "a@x.com", subject: "Batch 2027 update", body: "",
    });
    expect(out.kind).toBe("ambiguous");
    if (out.kind === "ambiguous") expect(out.candidates.sort()).toEqual(["g2027", "gplace"]);
  });

  it("rule target agreeing with mentioned group => single", () => {
    const out = detectTarget({
      groups,
      rules: [rule({ targetBatchId: "g2027", subjectKeywords: ["batch 2027"] })],
      sender: "a@x.com", subject: "Batch 2027 update", body: "",
    });
    expect(out).toEqual({ kind: "single", batchId: "g2027", matchedBy: "rule" });
  });
});
