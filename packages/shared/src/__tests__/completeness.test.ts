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

import { keepCompliantSentences, violatesNoDecisionRule, violatesPhotoRules } from "../safety";
import { photoModelOutputSchema } from "../schemas/ai";

describe("photo observation rules", () => {
  it("accepts a neutral description", () => {
    expect(violatesNoDecisionRule(["A dent and scratches are visible on a rear bumper."])).toBe(false);
  });
  it("rejects fault, fraud, authenticity and money language", () => {
    expect(violatesNoDecisionRule(["The driver was clearly at fault."])).toBe(true);
    expect(violatesNoDecisionRule(["This photo looks edited."])).toBe(true);
    expect(violatesNoDecisionRule(["Repair cost would be about 50000."])).toBe(true);
    expect(violatesNoDecisionRule(["This is a total loss."])).toBe(true);
  });
  it("requires a valid quality value", () => {
    const ok = { visible_description: "Rear bumper dent.", photo_quality: "clear", matches_label: "yes" };
    expect(photoModelOutputSchema.safeParse(ok).success).toBe(true);
    expect(photoModelOutputSchema.safeParse({ ...ok, photo_quality: "perfect" }).success).toBe(false);
  });
});

describe("stricter photo rules", () => {
  it("accepts a list of visible marks", () => {
    expect(violatesPhotoRules(["Crumpled front bumper, cracked headlight, dent on the hood of a silver car."])).toBe(false);
    expect(violatesPhotoRules(["Scratches along the driver's side door."])).toBe(false);
  });
  it("rejects people, causes and severity judgements", () => {
    expect(violatesPhotoRules(["Several people are standing around the vehicles."])).toBe(true);
    expect(violatesPhotoRules(["It appears to have collided with a large truck."])).toBe(true);
    expect(violatesPhotoRules(["The car has sustained significant damage."])).toBe(true);
    expect(violatesPhotoRules(["The car was wrecked."])).toBe(true);
    expect(violatesPhotoRules(["The front is severely damaged."])).toBe(true);
    expect(violatesPhotoRules(["Significant deformation to the hood."])).toBe(true);
    expect(violatesPhotoRules(["Light grey car with a crumpled hood."])).toBe(false);
  });
});

describe("number plates", () => {
  it("are allowed in photo descriptions", () => {
    expect(violatesPhotoRules(["The sedan's number plate reads SMK 436 JB."])).toBe(false);
  });
});

describe("photo description filtering", () => {
  it("allows car-part terms such as passenger side and driver side", () => {
    expect(violatesPhotoRules(["Scratches on the passenger side door."])).toBe(false);
    expect(violatesPhotoRules(["The driver side mirror is cracked."])).toBe(false);
    expect(violatesPhotoRules(["The damaged side faces the camera."])).toBe(false);
  });
  it("still rejects people and drivers", () => {
    expect(violatesPhotoRules(["The driver is standing nearby."])).toBe(true);
  });
  it("drops only the offending sentences", () => {
    const out = keepCompliantSentences("Dent on the hood. The damage is severe. People stand nearby. Cracked headlight.");
    expect(out).toBe("Dent on the hood. Cracked headlight.");
  });
  it("returns an empty string when nothing is usable", () => {
    expect(keepCompliantSentences("The damage is severe. People stand nearby.")).toBe("");
  });
});
