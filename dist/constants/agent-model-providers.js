"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_SUPPORTED_CREDENTIAL_TYPES = exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES = exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES = void 0;
exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES = {
    openai: ['openAiApi'],
    anthropic: ['anthropicApi'],
    google: ['googlePalmApi'],
    'azure-openai': ['azureOpenAiApi', 'azureEntraCognitiveServicesOAuth2Api'],
    'aws-bedrock': ['aws'],
    xai: ['xAiApi'],
    groq: ['groqApi'],
    openrouter: ['openRouterApi'],
    deepseek: ['deepSeekApi'],
    cohere: ['cohereApi'],
    mistral: ['mistralCloudApi'],
    vercel: ['vercelAiGatewayApi'],
    nvidia: ['nvidiaApi'],
    moonshotai: ['moonshotApi'],
    alibaba: ['alibabaCloudApi'],
    minimax: ['minimaxApi'],
};
exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES = {
    azureOpenAiApi: 'not mapped in LLM_PROVIDER_DEFAULTS (verified on n8n 2.41.5)',
    azureEntraCognitiveServicesOAuth2Api: 'not mapped in LLM_PROVIDER_DEFAULTS (verified on n8n 2.41.5)',
    aws: 'not mapped in LLM_PROVIDER_DEFAULTS (verified on n8n 2.41.5)',
};
exports.AGENT_SUPPORTED_CREDENTIAL_TYPES = Object.values(exports.AGENT_MODEL_PROVIDER_CREDENTIAL_TYPES)
    .flat()
    .filter(t => !(t in exports.AGENT_UNSUPPORTED_CREDENTIAL_TYPES));
//# sourceMappingURL=agent-model-providers.js.map