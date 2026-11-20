import { describe, expect, it } from "vitest";
import { assessCompleteness } from "../completeness";
import { aiSummarySchema, SAFETY_NOTICE } from "../schemas/ai";

const full = {
  policyReferenceMasked: "****1234",
  incidentAt: new Date(),
  incidentLocation: "Ikorodu Road, Lagos",
  incidentType: "COLLISION",
  narrative: "Another car reversed into my parked vehicle outside the market.",
  vehicleDescription: "2018 Toyota Corolla, silver",
  injuriesReported: false,
  otherPartiesInvolved: true,
  contactChannel: "EMAIL",
};

describe("assessCompleteness", () => {
  it("is ready when fields and damage evidence are present", () => {
    const result = assessCompleteness(full, ["DAMAGE"]);
    expect(result.readyToSubmit).toBe(true);
    expect(result.percent).toBe(100);
  });
  it("reports missing damage evidence", () => {
    const result = assessCompleteness(full, ["FRONT"]);
    expect(result.readyToSubmit).toBe(false);
    expect(result.missingEvidence).toEqual(["damage"]);
  });
  it("treats a very short narrative as missing", () => {
    const result = assessCompleteness({ ...full, narrative: "hit" }, ["DAMAGE"]);
    expect(result.missingFields).toContain("Description of what happened");
  });
  it("treats injuriesReported=false as answered", () => {
    expect(assessCompleteness({ ...full, injuriesReported: false }, ["DAMAGE"]).missingFields).toEqual([]);
  });
});

describe("other parties question", () => {
  it("is required and cannot be assumed", () => {
    const { otherPartiesInvolved: _omit, ...without } = full;
    const result = assessCompleteness(without, ["DAMAGE"]);
    expect(result.readyToSubmit).toBe(false);
    expect(result.missingFields).toContain("Whether another vehicle or person was involved");
  });
});

describe("aiSummarySchema", () => {
  it("rejects output without the safety notice", () => {
    const bad = {
      incident_summary: "x",
      customer_reported_facts: [],
      missing_information: [],
      follow_up_questions: [],
      evidence_checklist: [],
      uncertainties: [],
      safety_notice: "all good",
    };
    expect(aiSummarySchema.safeParse(bad).success).toBe(false);
    expect(aiSummarySchema.safeParse({ ...bad, safety_notice: SAFETY_NOTICE }).success).toBe(true);
  });
});
