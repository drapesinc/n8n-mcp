"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTANCE_ARGUMENT = void 0;
exports.isInstanceArgumentEnabled = isInstanceArgumentEnabled;
exports.withInstanceArgument = withInstanceArgument;
exports.withoutInstanceArgument = withoutInstanceArgument;
exports.INSTANCE_ARGUMENT = 'instance';
const INSTANCE_PROPERTY = {
    type: 'string',
    description: 'Optional. Name of the n8n instance this call targets (as listed by n8n_instances). ' +
        'Targets only this call and changes nothing for other chats or agents; pass it on every call when working on several instances in parallel. ' +
        'Omit it to use the current instance.',
};
function isInstanceArgumentEnabled(context) {
    return context?.instanceArgument === true;
}
function withInstanceArgument(tool) {
    const schema = tool.inputSchema ?? { type: 'object', properties: {} };
    return {
        ...tool,
        inputSchema: {
            ...schema,
            properties: { ...(schema.properties ?? {}), [exports.INSTANCE_ARGUMENT]: INSTANCE_PROPERTY },
        },
    };
}
function withoutInstanceArgument(args) {
    if (!args || typeof args !== 'object' || !(exports.INSTANCE_ARGUMENT in args))
        return args;
    const { [exports.INSTANCE_ARGUMENT]: _dropped, ...rest } = args;
    return rest;
}
//# sourceMappingURL=instance-argument.js.map