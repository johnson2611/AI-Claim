// Firebase AI Logic hybrid inference: on-device (Chrome Prompt API) first, cloud fallback.
// Docs: https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
//       https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import type { AiFallbackReason, AiRoute } from "@claims/shared";
import { firebaseApp } from "./app";

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const CLOUD_MODEL = "gemini-3.5-flash-lite";

export type InferencePolicy =
  "PREFER_ON_DEVICE" | "ONLY_ON_DEVICE" | "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD";

export type OnDeviceAvailability =
  "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

interface PromptApi {
  availability(options?: unknown): Promise<OnDeviceAvailability>;
  create(options?: unknown): Promise<unknown>;
}
const promptApi = (): PromptApi | undefined =>
  (globalThis as unknown as { LanguageModel?: PromptApi }).LanguageModel;

const TEXT_EN = [{ type: "text" as const, languages: ["en"] }];
const MODEL_OPTIONS = { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN };

/** Is Chrome's on-device model usable right now? Never assume every Chrome install supports it. */
export async function onDeviceAvailability(): Promise<OnDeviceAvailability> {
  const api = promptApi();
  if (!api?.availability) return "unsupported";
  try {
    return await api.availability(MODEL_OPTIONS);
  } catch {
    return "unavailable";
  }
}

/**
 * Starts the on-device model (and downloads it if needed). Must be called from a user gesture such as a
 * button click. TODO: confirm against step 6 of the Firebase hybrid guide whether the SDK exposes its own
 * initialisation helper that you should call instead of, or as well as, this Chrome-level warm-up.
 */
export async function prepareOnDeviceModel(onProgress?: (percent: number) => void): Promise<void> {
  const api = promptApi();
  if (!api) throw new Error("The Prompt API is not available in this browser.");
  await api.create({
    ...MODEL_OPTIONS,
    monitor(m: EventTarget) {
      m.addEventListener("downloadprogress", (e) =>
        onProgress?.(Math.round(((e as ProgressEvent).loaded ?? 0) * 100)),
      );
    },
  });
}

export interface HybridResult<T> {
  data: T;
  route: AiRoute;
  latencyMs: number;
  fallbackReason?: AiFallbackReason;
}

export class HybridTaskError extends Error {
  constructor(
    message: string,
    public route: AiRoute,
    public latencyMs: number,
    public kind: "FAILED" | "REJECTED_OUTPUT",
  ) {
    super(message);
  }
}

const prefersDevice = (p: InferencePolicy) => p === "PREFER_ON_DEVICE" || p === "ONLY_ON_DEVICE";

export async function runHybridTask<T>(opts: {
  policy: InferencePolicy;
  systemInstruction: string;
  prompt: string;
  parse: (text: string) => T;
}): Promise<HybridResult<T>> {
  const availability = prefersDevice(opts.policy) ? await onDeviceAvailability() : undefined;
  if (opts.policy === "ONLY_ON_DEVICE" && availability !== "available") {
    throw new HybridTaskError(
      "On-device AI is not ready in this browser, so nothing was sent to the cloud.",
      "ON_DEVICE",
      0,
      "FAILED",
    );
  }

  const model = getGenerativeModel(ai, {
    mode: InferenceMode[opts.policy],
    onDeviceParams: { createOptions: MODEL_OPTIONS },
    inCloudParams: { model: CLOUD_MODEL },
  });

  // The instruction travels inside the prompt so both routes receive identical guidance.
  const fullPrompt = `${opts.systemInstruction}\n\n---\n${opts.prompt}`;
  const started = performance.now();
  const guessedRoute: AiRoute = opts.policy === "ONLY_ON_DEVICE" ? "ON_DEVICE" : "IN_CLOUD";

  let text: string;
  let route: AiRoute;
  try {
    const result = await model.generateContent(fullPrompt);
    text = result.response.text();
    route = /device/i.test(String(result.response.inferenceSource)) ? "ON_DEVICE" : "IN_CLOUD";
  } catch (e) {
    throw new HybridTaskError(
      e instanceof Error ? e.message : "AI request failed",
      guessedRoute,
      Math.round(performance.now() - started),
      "FAILED",
    );
  }
  const latencyMs = Math.round(performance.now() - started);

  let data: T;
  try {
    data = opts.parse(text);
  } catch {
    throw new HybridTaskError(
      "The AI response was not in the expected format.",
      route,
      latencyMs,
      "REJECTED_OUTPUT",
    );
  }

  let fallbackReason: AiFallbackReason | undefined;
  if (opts.policy === "ONLY_IN_CLOUD") fallbackReason = "POLICY_CLOUD_ONLY";
  else if (route === "IN_CLOUD" && prefersDevice(opts.policy)) {
    fallbackReason = availability === "available" ? "ON_DEVICE_ERROR" : "ON_DEVICE_UNAVAILABLE";
  }
  return { data, route, latencyMs, fallbackReason };
}
