"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_SUPPORTED_CREDENTIAL_TYPES = exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES = exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES = void 0;
exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES = {
    openai: ['openAiApi'],
    anthropic: ['anthropicApi'],
    google: ['googlePalmApi'],
    'azure-openai': ['azureOpenAiApi'],
    'aws-bedrock': ['aws'],
    xai: ['xAiApi'],
    groq: ['groqApi'],
    openrouter: ['openRouterApi'],
    deepseek: ['deepSeekApi'],
    cohere: ['cohereApi'],
    mistral: ['mistralCloudApi'],
    vercel: ['vercelAiGatewayApi'],
    nvidia: ['nvidiaApi'],
};
exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES = {
    azureOpenAiApi: 'not mapped in LLM_PROVIDER_DEFAULTS (verified on n8n 2.36.7)',
    aws: 'not mapped in LLM_PROVIDER_DEFAULTS (verified on n8n 2.36.7)',
};
exports.AGENT_SUPPORTED_CREDENTIAL_TYPES = Object.values(exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES)
    .flat()
    .filter(t => !(t in exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES));
//# sourceMappingURL=agent-model-providers.js.map