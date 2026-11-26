// Firebase AI Logic hybrid inference: on-device (Chrome Prompt API) first, cloud fallback.
// Docs: https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
//       https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";
import type { AiFallbackReason, AiRoute } from "@claims/shared";
import { firebaseApp } from "./app";

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

/** Pinned so a retired default model can't break the cloud fallback. */
const CLOUD_MODEL = "gemini-3.5-flash-lite";

export type InferencePolicy = "PREFER_ON_DEVICE" | "ONLY_ON_DEVICE" | "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD";

export type OnDeviceAvailability = "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

interface PromptApi {
  availability(options?: unknown): Promise<OnDeviceAvailability>;
  create(options?: unknown): Promise<unknown>;
}
const promptApi = (): PromptApi | undefined => (globalThis as unknown as { LanguageModel?: PromptApi }).LanguageModel;

const TEXT_EN = [{ type: "text" as const, languages: ["en"] }];
const TEXT_ONLY = { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN };
const WITH_IMAGES = { expectedInputs: [...TEXT_EN, { type: "image" as const }], expectedOutputs: TEXT_EN };

/** Is Chrome's on-device model usable right now? Photos also need the multimodal flag. */
export async function onDeviceAvailability(withImages = false): Promise<OnDeviceAvailability> {
  const api = promptApi();
  if (!api?.availability) return "unsupported";
  try {
    return await api.availability(withImages ? WITH_IMAGES : TEXT_ONLY);
  } catch {
    return "unavailable";
  }
}

/** Starts the on-device model download from a button click (used by the AI route lab). */
export async function prepareOnDeviceModel(onProgress?: (percent: number) => void): Promise<void> {
  const api = promptApi();
  if (!api) throw new Error("The Prompt API is not available in this browser.");
  await api.create({
    ...TEXT_ONLY,
    monitor(m: EventTarget) {
      m.addEventListener("downloadprogress", (e) => onProgress?.(Math.round(((e as ProgressEvent).loaded ?? 0) * 100)));
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

export interface ImageInput {
  data: string;
  mimeType: string;
}

const prefersDevice = (p: InferencePolicy) => p === "PREFER_ON_DEVICE" || p === "ONLY_ON_DEVICE";

const models = new Map<string, GenerativeModel>();
const deviceInitStarted = new Set<string>();

function modelFor(policy: InferencePolicy, withImages: boolean): { key: string; model: GenerativeModel } {
  const key = `${policy}:${withImages ? "img" : "txt"}`;
  let model = models.get(key);
  if (!model) {
    model = getGenerativeModel(ai, {
      mode: InferenceMode[policy],
      onDeviceParams: { createOptions: withImages ? WITH_IMAGES : TEXT_ONLY },
      inCloudParams: { model: CLOUD_MODEL },
    });
    models.set(key, model);
  }
  return { key, model };
}

export async function runHybridTask<T>(opts: {
  policy: InferencePolicy;
  systemInstruction: string;
  prompt: string;
  images?: ImageInput[];
  parse: (text: string) => T;
}): Promise<HybridResult<T>> {
  const withImages = (opts.images?.length ?? 0) > 0;
  const availability = prefersDevice(opts.policy) ? await onDeviceAvailability(withImages) : undefined;

  // Privacy guard: "only on-device" must never reach the cloud, whatever the SDK might do.
  if (opts.policy === "ONLY_ON_DEVICE" && availability !== "available") {
    throw new HybridTaskError(
      withImages
        ? "On-device photo analysis is not ready in this browser, so nothing was sent to the cloud."
        : "On-device AI is not ready in this browser, so nothing was sent to the cloud.",
      "ON_DEVICE",
      0,
      "FAILED",
    );
  }

  const { key, model } = modelFor(opts.policy, withImages);

  // Firebase requires initializeDeviceModel() after a user click and before the first request.
  if (availability && availability !== "unsupported" && availability !== "unavailable" && !deviceInitStarted.has(key)) {
    deviceInitStarted.add(key);
    const init = model.initializeDeviceModel().catch(() => undefined);
    if (availability === "available") await init;
  }

  const fullPrompt = `${opts.systemInstruction}\n\n---\n${opts.prompt}`;
  const contents = withImages
    ? [fullPrompt, ...(opts.images ?? []).map((i) => ({ inlineData: { data: i.data, mimeType: i.mimeType } }))]
    : fullPrompt;

  const started = performance.now();
  const guessedRoute: AiRoute = opts.policy === "ONLY_ON_DEVICE" ? "ON_DEVICE" : "IN_CLOUD";

  let text: string;
  let route: AiRoute;
  try {
    const result = await model.generateContent(contents);
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
    throw new HybridTaskError("The AI response was not in the expected format.", route, latencyMs, "REJECTED_OUTPUT");
  }

  let fallbackReason: AiFallbackReason | undefined;
  if (opts.policy === "ONLY_IN_CLOUD") fallbackReason = "POLICY_CLOUD_ONLY";
  else if (route === "IN_CLOUD" && prefersDevice(opts.policy)) {
    fallbackReason = availability === "available" ? "ON_DEVICE_ERROR" : "ON_DEVICE_UNAVAILABLE";
  }
  return { data, route, latencyMs, fallbackReason };
}
