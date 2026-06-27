import { createApiKeyLogin } from "./api-key-login";
import type { OAuthLoginCallbacks } from "./oauth/types";
import type { ProviderDefinition } from "./types";

const AUTH_URL = "https://platform.stepfun.com/";
const API_BASE_URL = Bun.env.STEPFUN_BASE_URL ?? Bun.env.STEP_PLAN_BASE_URL ?? "https://api.stepfun.com/step_plan/v1";
const VALIDATION_MODEL = "step-3.7-flash";

export const loginStepfun = createApiKeyLogin({
	providerLabel: "StepFun Step Plan",
	authUrl: AUTH_URL,
	instructions: "Copy your API key from the StepFun dashboard",
	promptMessage: "Paste your StepFun API key",
	placeholder: "...",
	validation: {
		kind: "chat-completions",
		provider: "StepFun",
		baseUrl: API_BASE_URL,
		model: VALIDATION_MODEL,
	},
});

export const stepfunProvider = {
	id: "stepfun",
	name: "StepFun Step Plan",
	login: (cb: OAuthLoginCallbacks) => loginStepfun(cb),
} as const satisfies ProviderDefinition;
