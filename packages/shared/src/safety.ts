/**
 * The AI may describe what is visible. It may not decide anything. If a photo description drifts into
 * fault, fraud, authenticity, money or approval language, it is rejected instead of shown.
 */
const DECISION_PATTERN =
  /\b(fault|liab\w*|fraud\w*|fake|staged|forg\w+|tamper\w*|manipulat\w*|edited|photoshopp?\w*|authentic\w*|genuine|total loss|write[- ]?off|approv\w*|reject\w*|den(y|ied)|settle\w*|payout|worth)\b|repair cost|estimated? (cost|repair)|[$€£₦]\s?\d/i;

export function violatesNoDecisionRule(texts: readonly string[]): boolean {
  return texts.some((t) => DECISION_PATTERN.test(t));
}

// "Driver's side", "passenger door" and similar are car parts, not people, so they are removed before the people check.
const VEHICLE_SIDE_TERMS = /\b(driver|passenger)(['\u2019]s)?[ -]?(side|door|seat|window|mirror|headlight|taillight|fender|quarter|panel|wheel|tyre|tire|area)s?\b/gi;
const PEOPLE_PATTERN = /\b(people|persons?|m[ae]n|wom[ae]n|child(ren)?|pedestrians?|bystanders?|crowd|onlookers?|passengers?|driver)\b/i;
const CAUSE_PATTERN = /\b(collided|collision with|crash(ed)? into|hit by|struck by|caused by|due to|appears? to have (been|collided|hit|struck)|rear-?ended|ran into)\b/i;
const SEVERITY_PATTERN = /\b(severe\w*|serious\w*|significant\w*|major|extensive\w*|substantial\w*|heavily|badly|slight\w*|minor|totaled|destroyed|wrecked|smashed|devastat\w*)\b/i;

/** Photo descriptions must only list what is visible: no people, no cause, no severity judgement, no decisions. */
export function violatesPhotoRules(texts: readonly string[]): boolean {
  return (
    violatesNoDecisionRule(texts) ||
    texts.some((t) => {
      const withoutCarParts = t.replace(VEHICLE_SIDE_TERMS, "");
      return PEOPLE_PATTERN.test(withoutCarParts) || CAUSE_PATTERN.test(t) || SEVERITY_PATTERN.test(t);
    })
  );
}

/** Keeps only the sentences that pass the photo rules, so one bad sentence does not discard a good description. */
export function keepCompliantSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() !== "" && !violatesPhotoRules([sentence]))
    .join(" ")
    .trim();
}
