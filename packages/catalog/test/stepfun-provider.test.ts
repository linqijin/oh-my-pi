import { afterEach, describe, expect, test, vi } from "bun:test";
import { getOAuthProviders } from "@oh-my-pi/pi-ai/registry/oauth";
import { getEnvApiKey } from "@oh-my-pi/pi-ai/stream";
import { Effort } from "@oh-my-pi/pi-catalog/effort";
import { getBundledModels } from "@oh-my-pi/pi-catalog/models";
import { DEFAULT_MODEL_PER_PROVIDER, PROVIDER_DESCRIPTORS } from "@oh-my-pi/pi-catalog/provider-models/descriptors";
import {
	STEPFUN_STEP_PLAN_BASE_URL,
	stepfunModelManagerOptions,
} from "@oh-my-pi/pi-catalog/provider-models/openai-compat";
import type { FetchImpl } from "@oh-my-pi/pi-catalog/types";

const ORIGINAL_ENV = {
	STEPFUN_API_KEY: Bun.env.STEPFUN_API_KEY,
	STEP_PLAN_API_KEY: Bun.env.STEP_PLAN_API_KEY,
	STEPFUN_BASE_URL: Bun.env.STEPFUN_BASE_URL,
	STEP_PLAN_BASE_URL: Bun.env.STEP_PLAN_BASE_URL,
} as const;

function restoreEnvVar(name: keyof typeof ORIGINAL_ENV): void {
	const value = ORIGINAL_ENV[name];
	if (value === undefined) {
		delete Bun.env[name];
		return;
	}
	Bun.env[name] = value;
}

afterEach(() => {
	restoreEnvVar("STEPFUN_API_KEY");
	restoreEnvVar("STEP_PLAN_API_KEY");
	restoreEnvVar("STEPFUN_BASE_URL");
	restoreEnvVar("STEP_PLAN_BASE_URL");
	vi.restoreAllMocks();
});

describe("StepFun Step Plan provider support", () => {
	test("resolves StepFun API key environment fallbacks", () => {
		delete Bun.env.STEPFUN_API_KEY;
		Bun.env.STEP_PLAN_API_KEY = "step-plan-test-key";
		expect(getEnvApiKey("stepfun")).toBe("step-plan-test-key");

		Bun.env.STEPFUN_API_KEY = "stepfun-test-key";
		expect(getEnvApiKey("stepfun")).toBe("stepfun-test-key");
	});

	test("registers descriptor, default model, bundled models, and login provider", () => {
		const descriptor = PROVIDER_DESCRIPTORS.find(item => item.providerId === "stepfun");
		expect(descriptor).toBeDefined();
		expect(descriptor?.defaultModel).toBe("step-3.7-flash");
		expect(descriptor?.catalogDiscovery?.envVars).toEqual(["STEPFUN_API_KEY", "STEP_PLAN_API_KEY"]);
		expect(descriptor?.dynamicModelsAuthoritative).toBe(true);
		expect(DEFAULT_MODEL_PER_PROVIDER.stepfun).toBe("step-3.7-flash");

		const bundled = getBundledModels("stepfun");
		expect(bundled.map(model => model.id).sort()).toEqual([
			"step-3.5-flash",
			"step-3.5-flash-2603",
			"step-3.7-flash",
			"step-image-edit-2",
			"step-router-v1",
			"stepaudio-2.5-asr",
			"stepaudio-2.5-chat",
			"stepaudio-2.5-realtime",
			"stepaudio-2.5-tts",
		]);
		for (const model of bundled) {
			expect(model.api).toBe("openai-completions");
			expect(model.baseUrl).toBe(STEPFUN_STEP_PLAN_BASE_URL);
			if (model.id.startsWith("step-3.")) {
				expect(model.reasoning).toBe(true);
				expect(model.thinking?.efforts).toEqual([Effort.Low, Effort.Medium, Effort.High]);
			} else {
				expect(model.reasoning).toBe(false);
			}
			if (model.id.startsWith("stepaudio-") || model.id === "step-image-edit-2") {
				expect(model.supportsTools).toBe(false);
			}
		}

		const provider = getOAuthProviders().find(item => item.id === "stepfun");
		expect(provider?.name).toBe("StepFun Step Plan");
	});

	test("discovers Step Plan models from the configured OpenAI-compatible endpoint", async () => {
		Bun.env.STEPFUN_BASE_URL = "https://gateway.stepfun.test/step_plan/v1";
		const fetchMock: FetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ id: "step-3.7-flash", name: "Step 3.7 Flash" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		) as unknown as FetchImpl;

		const options = stepfunModelManagerOptions({ apiKey: "step-key", fetch: fetchMock });
		const models = await options.fetchDynamicModels?.();

		expect(fetchMock).toHaveBeenCalledWith(
			"https://gateway.stepfun.test/step_plan/v1/models",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({ Authorization: "Bearer step-key" }),
			}),
		);
		expect(models?.[0]?.provider).toBe("stepfun");
		expect(models?.[0]?.baseUrl).toBe("https://gateway.stepfun.test/step_plan/v1");
	});
});
