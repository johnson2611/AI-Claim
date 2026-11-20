import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition } from "../status";

describe("claim status machine", () => {
  it("lets a customer submit a draft", () => {
    expect(canTransition("DRAFT", "SUBMITTED", "CUSTOMER")).toBe(true);
  });
  it("stops a customer from marking a claim reviewed", () => {
    expect(canTransition("UNDER_REVIEW", "REVIEWED", "CUSTOMER")).toBe(false);
  });
  it("stops an officer from skipping straight to reviewed", () => {
    expect(canTransition("SUBMITTED", "REVIEWED", "OFFICER")).toBe(false);
  });
  it("lets an officer request more information only while under review", () => {
    expect(canTransition("UNDER_REVIEW", "MORE_INFO_REQUIRED", "OFFICER")).toBe(true);
    expect(canTransition("SUBMITTED", "MORE_INFO_REQUIRED", "OFFICER")).toBe(false);
  });
  it("treats reviewed as terminal", () => {
    expect(allowedTransitions("REVIEWED", "ADMIN")).toEqual([]);
  });
});
