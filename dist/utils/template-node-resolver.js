"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplateNodeTypes = resolveTemplateNodeTypes;
const logger_1 = require("./logger");
function resolveTemplateNodeTypes(nodeTypes) {
    const resolvedTypes = new Set();
    for (const nodeType of nodeTypes) {
        const variations = generateTemplateNodeVariations(nodeType);
        variations.forEach(v => resolvedTypes.add(v));
    }
    const result = Array.from(resolvedTypes);
    logger_1.logger.debug(`Resolved ${nodeTypes.length} input types to ${result.length} template variations`, {
        input: nodeTypes,
        output: result
    });
    return result;
}
function generateTemplateNodeVariations(nodeType) {
    const variations = new Set();
    if (nodeType.startsWith('n8n-nodes-base.') || nodeType.startsWith('@n8n/n8n-nodes-langchain.')) {
        variations.add(nodeType);
        return Array.from(variations);
    }
    if (nodeType.startsWith('nodes-base.')) {
        const nodeName = nodeType.replace('nodes-base.', '');
        variations.add(`n8n-nodes-base.${nodeName}`);
        addCamelCaseVariations(variations, nodeName, 'n8n-nodes-base');
    }
    else if (nodeType.startsWith('nodes-langchain.')) {
        const nodeName = nodeType.replace('nodes-langchain.', '');
        variations.add(`@n8n/n8n-nodes-langchain.${nodeName}`);
        addCamelCaseVariations(variations, nodeName, '@n8n/n8n-nodes-langchain');
    }
    else if (!nodeType.includes('.')) {
        variations.add(`n8n-nodes-base.${nodeType}`);
        addCamelCaseVariations(variations, nodeType, 'n8n-nodes-base');
        variations.add(`@n8n/n8n-nodes-langchain.${nodeType}`);
        addCamelCaseVariations(variations, nodeType, '@n8n/n8n-nodes-langchain');
        addRelatedNodeTypes(variations, nodeType);
    }
    return Array.from(variations);
}
function addCamelCaseVariations(variations, nodeName, packagePrefix) {
    const lowerName = nodeName.toLowerCase();
    const patterns = [
        { suffix: 'trigger', capitalize: true },
        { suffix: 'Trigger', capitalize: false },
        { suffix: 'request', capitalize: true },
        { suffix: 'Request', capitalize: false },
        { suffix: 'database', capitalize: true },
        { suffix: 'Database', capitalize: false },
        { suffix: 'sheet', capitalize: true },
        { suffix: 'Sheet', capitalize: false },
        { suffix: 'sheets', capitalize: true },
        { suffix: 'Sheets', capitalize: false },
    ];
    for (const pattern of patterns) {
        const lowerSuffix = pattern.suffix.toLowerCase();
        if (lowerName.endsWith(lowerSuffix)) {
            const baseName = lowerName.slice(0, -lowerSuffix.length);
            if (baseName) {
                if (pattern.capitalize) {
                    const capitalizedSuffix = pattern.suffix.charAt(0).toUpperCase() + pattern.suffix.slice(1).toLowerCase();
                    variations.add(`${packagePrefix}.${baseName}${capitalizedSuffix}`);
                }
                else {
                    variations.add(`${packagePrefix}.${baseName}${pattern.suffix}`);
                }
            }
        }
        else if (!lowerName.includes(lowerSuffix)) {
            if (pattern.capitalize) {
                const capitalizedSuffix = pattern.suffix.charAt(0).toUpperCase() + pattern.suffix.slice(1).toLowerCase();
                variations.add(`${packagePrefix}.${lowerName}${capitalizedSuffix}`);
            }
        }
    }
    const specificCases = {
        'http': ['httpRequest'],
        'httprequest': ['httpRequest'],
        'mysql': ['mysql', 'mysqlDatabase'],
        'postgres': ['postgres', 'postgresDatabase'],
        'postgresql': ['postgres', 'postgresDatabase'],
        'mongo': ['mongoDb', 'mongodb'],
        'mongodb': ['mongoDb', 'mongodb'],
        'google': ['googleSheets', 'googleDrive', 'googleCalendar'],
        'googlesheet': ['googleSheets'],
        'googlesheets': ['googleSheets'],
        'microsoft': ['microsoftTeams', 'microsoftExcel', 'microsoftOutlook'],
        'slack': ['slack'],
        'discord': ['discord'],
        'telegram': ['telegram'],
        'webhook': ['webhook'],
        'schedule': ['scheduleTrigger'],
        'cron': ['cron', 'scheduleTrigger'],
        'email': ['emailSend', 'emailReadImap', 'gmail'],
        'gmail': ['gmail', 'gmailTrigger'],
        'code': ['code'],
        'javascript': ['code'],
        'python': ['code'],
        'js': ['code'],
        'set': ['set'],
        'if': ['if'],
        'switch': ['switch'],
        'merge': ['merge'],
        'loop': ['splitInBatches'],
        'split': ['splitInBatches', 'splitOut'],
        'ai': ['openAi'],
        'openai': ['openAi'],
        'chatgpt': ['openAi'],
        'gpt': ['openAi'],
        'api': ['httpRequest', 'graphql', 'webhook'],
        'csv': ['spreadsheetFile', 'readBinaryFile'],
        'excel': ['microsoftExcel', 'spreadsheetFile'],
        'spreadsheet': ['spreadsheetFile', 'googleSheets', 'microsoftExcel'],
    };
    const cases = specificCases[lowerName];
    if (cases) {
        cases.forEach(c => variations.add(`${packagePrefix}.${c}`));
    }
}
function addRelatedNodeTypes(variations, nodeName) {
    const lowerName = nodeName.toLowerCase();
    const relatedTypes = {
        'slack': ['slack', 'slackTrigger'],
        'gmail': ['gmail', 'gmailTrigger'],
        'telegram': ['telegram', 'telegramTrigger'],
        'discord': ['discord', 'discordTrigger'],
        'webhook': ['webhook', 'webhookTrigger'],
        'http': ['httpRequest', 'webhook'],
        'email': ['emailSend', 'emailReadImap', 'gmail', 'gmailTrigger'],
        'google': ['googleSheets', 'googleDrive', 'googleCalendar', 'googleDocs'],
        'microsoft': ['microsoftTeams', 'microsoftExcel', 'microsoftOutlook', 'microsoftOneDrive'],
        'database': ['postgres', 'mysql', 'mongoDb', 'redis', 'postgresDatabase', 'mysqlDatabase'],
        'db': ['postgres', 'mysql', 'mongoDb', 'redis'],
        'sql': ['postgres', 'mysql', 'mssql'],
        'nosql': ['mongoDb', 'redis', 'couchDb'],
        'schedule': ['scheduleTrigger', 'cron'],
        'time': ['scheduleTrigger', 'cron', 'wait'],
        'file': ['readBinaryFile', 'writeBinaryFile', 'moveBinaryFile'],
        'binary': ['readBinaryFile', 'writeBinaryFile', 'moveBinaryFile'],
        'csv': ['spreadsheetFile', 'readBinaryFile'],
        'excel': ['microsoftExcel', 'spreadsheetFile'],
        'json': ['set', 'code'],
        'transform': ['set', 'aggregate', 'summarize', 'splitOut', 'merge', 'code'],
        'ai': ['openAi', 'agent', 'lmChatOpenAi', 'lmChatAnthropic'],
        'llm': ['openAi', 'agent', 'lmChatOpenAi', 'lmChatAnthropic', 'lmChatGoogleGemini'],
        'agent': ['agent', 'toolAgent'],
        'chat': ['chatTrigger', 'agent'],
    };
    const related = relatedTypes[lowerName];
    if (related) {
        related.forEach(r => {
            variations.add(`n8n-nodes-base.${r}`);
            if (['agent', 'toolAgent', 'chatTrigger', 'lmChatOpenAi', 'lmChatAnthropic', 'lmChatGoogleGemini'].includes(r)) {
                variations.add(`@n8n/n8n-nodes-langchain.${r}`);
            }
        });
    }
}
//# sourceMappingURL=template-node-resolver.js.map