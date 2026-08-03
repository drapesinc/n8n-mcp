"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSpecificValidators = void 0;
const MAX_CODE_LENGTH = 200000;
const MAX_SHORT_INPUT_LENGTH = 2000;
const MAX_PARAM_SCAN = 2000;
const JS_PRIMITIVE_RETURN_RE = /return\s+(?:(?:true|false|null|undefined)\b|\d+|['"`])/m;
class NodeSpecificValidators {
    static validateSlack(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const { resource, operation } = config;
        if (resource === 'message') {
            switch (operation) {
                case 'send':
                    this.validateSlackSendMessage(context);
                    break;
                case 'update':
                    this.validateSlackUpdateMessage(context);
                    break;
                case 'delete':
                    this.validateSlackDeleteMessage(context);
                    break;
            }
        }
        else if (resource === 'channel') {
            switch (operation) {
                case 'create':
                    this.validateSlackCreateChannel(context);
                    break;
                case 'get':
                case 'getAll':
                    break;
            }
        }
        else if (resource === 'user') {
            if (operation === 'get' && !config.user) {
                errors.push({
                    type: 'missing_required',
                    property: 'user',
                    message: 'User identifier required - use email, user ID, or username',
                    fix: 'Set user to an email like "john@example.com" or user ID like "U1234567890"'
                });
            }
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            warnings.push({
                type: 'best_practice',
                property: 'errorHandling',
                message: 'Slack API can have rate limits and transient failures',
                suggestion: 'Add onError: "continueRegularOutput" with retryOnFail for resilience'
            });
            autofix.onError = 'continueRegularOutput';
            autofix.retryOnFail = true;
            autofix.maxTries = 2;
            autofix.waitBetweenTries = 3000;
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput"'
            });
        }
    }
    static validateSlackSendMessage(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        if (!config.channel && !config.channelId) {
            errors.push({
                type: 'missing_required',
                property: 'channel',
                message: 'Channel is required to send a message',
                fix: 'Set channel to a channel name (e.g., "#general") or ID (e.g., "C1234567890")'
            });
        }
        if (!config.text && !config.blocks && !config.attachments) {
            errors.push({
                type: 'missing_required',
                property: 'text',
                message: 'Message content is required - provide text, blocks, or attachments',
                fix: 'Add text field with your message content'
            });
        }
        if (config.text && config.text.length > 40000) {
            warnings.push({
                type: 'inefficient',
                property: 'text',
                message: 'Message text exceeds Slack\'s 40,000 character limit',
                suggestion: 'Split into multiple messages or use a file upload'
            });
        }
        if (config.replyToThread && !config.threadTs) {
            warnings.push({
                type: 'missing_common',
                property: 'threadTs',
                message: 'Thread timestamp required when replying to thread',
                suggestion: 'Set threadTs to the timestamp of the thread parent message'
            });
        }
        if (config.text?.includes('@') && !config.linkNames) {
            suggestions.push('Set linkNames=true to convert @mentions to user links');
            autofix.linkNames = true;
        }
    }
    static validateSlackUpdateMessage(context) {
        const { config, errors } = context;
        if (!config.ts) {
            errors.push({
                type: 'missing_required',
                property: 'ts',
                message: 'Message timestamp (ts) is required to update a message',
                fix: 'Provide the timestamp of the message to update'
            });
        }
        if (!config.channel && !config.channelId) {
            errors.push({
                type: 'missing_required',
                property: 'channel',
                message: 'Channel is required to update a message',
                fix: 'Provide the channel where the message exists'
            });
        }
    }
    static validateSlackDeleteMessage(context) {
        const { config, errors, warnings } = context;
        if (!config.ts) {
            errors.push({
                type: 'missing_required',
                property: 'ts',
                message: 'Message timestamp (ts) is required to delete a message',
                fix: 'Provide the timestamp of the message to delete'
            });
        }
        if (!config.channel && !config.channelId) {
            errors.push({
                type: 'missing_required',
                property: 'channel',
                message: 'Channel is required to delete a message',
                fix: 'Provide the channel where the message exists'
            });
        }
        warnings.push({
            type: 'security',
            message: 'Message deletion is permanent and cannot be undone',
            suggestion: 'Consider archiving or updating the message instead if you need to preserve history'
        });
    }
    static validateSlackCreateChannel(context) {
        const { config, errors, warnings } = context;
        if (!config.name) {
            errors.push({
                type: 'missing_required',
                property: 'name',
                message: 'Channel name is required',
                fix: 'Provide a channel name (lowercase, no spaces, 1-80 characters)'
            });
        }
        else {
            const name = config.name;
            if (name.includes(' ')) {
                errors.push({
                    type: 'invalid_value',
                    property: 'name',
                    message: 'Channel names cannot contain spaces',
                    fix: 'Use hyphens or underscores instead of spaces'
                });
            }
            if (name !== name.toLowerCase()) {
                errors.push({
                    type: 'invalid_value',
                    property: 'name',
                    message: 'Channel names must be lowercase',
                    fix: 'Convert the channel name to lowercase'
                });
            }
            if (name.length > 80) {
                errors.push({
                    type: 'invalid_value',
                    property: 'name',
                    message: 'Channel name exceeds 80 character limit',
                    fix: 'Shorten the channel name'
                });
            }
        }
    }
    static validateGoogleSheets(context) {
        const { config, errors, warnings, suggestions } = context;
        const { operation } = config;
        switch (operation) {
            case 'append':
                this.validateGoogleSheetsAppend(context);
                break;
            case 'read':
                this.validateGoogleSheetsRead(context);
                break;
            case 'update':
                this.validateGoogleSheetsUpdate(context);
                break;
            case 'delete':
                this.validateGoogleSheetsDelete(context);
                break;
        }
        if (config.range) {
            this.validateGoogleSheetsRange(config.range, errors, warnings);
        }
        const filteredErrors = [];
        for (const error of errors) {
            if (error.property === 'sheetId' && error.type === 'missing_required') {
                continue;
            }
            if (error.property && error.property.includes('sheetId') && error.type === 'missing_required') {
                continue;
            }
            filteredErrors.push(error);
        }
        errors.length = 0;
        errors.push(...filteredErrors);
    }
    static hasColumnsMapping(config) {
        return !!(config.columns && (config.columns.mappingMode || config.columns.value));
    }
    static validateGoogleSheetsAppend(context) {
        const { config, errors, warnings, autofix } = context;
        if (!config.range && !this.hasColumnsMapping(config)) {
            errors.push({
                type: 'missing_required',
                property: 'range',
                message: 'Range or columns mapping is required for append operation',
                fix: 'Specify range like "Sheet1!A:B" OR use columns with mappingMode'
            });
        }
        if (!config.options?.valueInputMode) {
            warnings.push({
                type: 'missing_common',
                property: 'options.valueInputMode',
                message: 'Consider setting valueInputMode for proper data formatting',
                suggestion: 'Use "USER_ENTERED" to parse formulas and dates, or "RAW" for literal values'
            });
            autofix.options = { ...config.options, valueInputMode: 'USER_ENTERED' };
        }
    }
    static validateGoogleSheetsRead(context) {
        const { config, suggestions } = context;
        if (!config.options?.dataStructure) {
            suggestions.push('Consider setting options.dataStructure to "object" for easier data manipulation');
        }
    }
    static validateGoogleSheetsUpdate(context) {
        const { config, errors } = context;
        const hasColumnsMapping = this.hasColumnsMapping(config);
        if (!config.range && !hasColumnsMapping) {
            errors.push({
                type: 'missing_required',
                property: 'range',
                message: 'Range or columns mapping is required for update operation',
                fix: 'Specify range like "Sheet1!A1:B10" OR use columns with mappingMode (e.g. defineBelow)'
            });
        }
        if (!config.values && !config.rawData && !hasColumnsMapping) {
            errors.push({
                type: 'missing_required',
                property: 'values',
                message: 'Values or columns mapping is required for update operation',
                fix: 'Provide data via values/rawData OR use columns.value with defineBelow mapping'
            });
        }
    }
    static validateGoogleSheetsDelete(context) {
        const { config, errors, warnings } = context;
        if (!config.toDelete) {
            errors.push({
                type: 'missing_required',
                property: 'toDelete',
                message: 'Specify what to delete (rows or columns)',
                fix: 'Set toDelete to "rows" or "columns"'
            });
        }
        if (config.toDelete === 'rows' && !config.startIndex && config.startIndex !== 0) {
            errors.push({
                type: 'missing_required',
                property: 'startIndex',
                message: 'Start index is required when deleting rows',
                fix: 'Specify the starting row index (0-based)'
            });
        }
        warnings.push({
            type: 'security',
            message: 'Deletion is permanent. Consider backing up data first',
            suggestion: 'Read the data before deletion to create a backup'
        });
    }
    static validateGoogleSheetsRange(range, errors, warnings) {
        if (!range.includes('!')) {
            warnings.push({
                type: 'inefficient',
                property: 'range',
                message: 'Range should include sheet name for clarity',
                suggestion: 'Format: "SheetName!A1:B10" or "SheetName!A:B"'
            });
        }
        if (range.includes(' ') && !range.match(/^'[^']+'/)) {
            errors.push({
                type: 'invalid_value',
                property: 'range',
                message: 'Sheet names with spaces must be quoted',
                fix: 'Use single quotes around sheet name: \'Sheet Name\'!A1:B10'
            });
        }
        const a1Pattern = /^('[^']+'|[^!]+)!([A-Z]+\d*:?[A-Z]*\d*|[A-Z]+:[A-Z]+|\d+:\d+)$/i;
        if (range.length <= MAX_SHORT_INPUT_LENGTH && !a1Pattern.test(range)) {
            warnings.push({
                type: 'inefficient',
                property: 'range',
                message: 'Range may not be in valid A1 notation',
                suggestion: 'Examples: "Sheet1!A1:B10", "Sheet1!A:B", "Sheet1!1:10"'
            });
        }
    }
    static validateOpenAI(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const { resource, operation } = config;
        if (resource === 'chat' && operation === 'create') {
            if (!config.model) {
                errors.push({
                    type: 'missing_required',
                    property: 'model',
                    message: 'Model selection is required',
                    fix: 'Choose a model like "gpt-4", "gpt-3.5-turbo", etc.'
                });
            }
            else {
                const deprecatedModels = ['text-davinci-003', 'text-davinci-002'];
                if (deprecatedModels.includes(config.model)) {
                    warnings.push({
                        type: 'deprecated',
                        property: 'model',
                        message: `Model ${config.model} is deprecated`,
                        suggestion: 'Use "gpt-3.5-turbo" or "gpt-4" instead'
                    });
                }
            }
            if (!config.messages && !config.prompt) {
                errors.push({
                    type: 'missing_required',
                    property: 'messages',
                    message: 'Messages or prompt required for chat completion',
                    fix: 'Add messages array or use the prompt field'
                });
            }
            if (config.maxTokens && config.maxTokens > 4000) {
                warnings.push({
                    type: 'inefficient',
                    property: 'maxTokens',
                    message: 'High token limit may increase costs significantly',
                    suggestion: 'Consider if you really need more than 4000 tokens'
                });
            }
            if (config.temperature !== undefined) {
                if (config.temperature < 0 || config.temperature > 2) {
                    errors.push({
                        type: 'invalid_value',
                        property: 'temperature',
                        message: 'Temperature must be between 0 and 2',
                        fix: 'Set temperature between 0 (deterministic) and 2 (creative)'
                    });
                }
            }
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            warnings.push({
                type: 'best_practice',
                property: 'errorHandling',
                message: 'AI APIs have rate limits and can return errors',
                suggestion: 'Add onError: "continueRegularOutput" with retryOnFail and longer wait times'
            });
            autofix.onError = 'continueRegularOutput';
            autofix.retryOnFail = true;
            autofix.maxTries = 3;
            autofix.waitBetweenTries = 5000;
            autofix.alwaysOutputData = true;
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput"'
            });
        }
    }
    static validateMongoDB(context) {
        const { config, errors, warnings, autofix } = context;
        const { operation } = config;
        if (!config.collection) {
            errors.push({
                type: 'missing_required',
                property: 'collection',
                message: 'Collection name is required',
                fix: 'Specify the MongoDB collection to work with'
            });
        }
        switch (operation) {
            case 'find':
                if (config.query && typeof config.query === 'string'
                    && !config.query.trim().startsWith('=') && !config.query.includes('{{')) {
                    try {
                        JSON.parse(config.query);
                    }
                    catch (e) {
                        errors.push({
                            type: 'invalid_value',
                            property: 'query',
                            message: 'Query must be valid JSON',
                            fix: 'Ensure query is valid JSON like: {"name": "John"}'
                        });
                    }
                }
                break;
            case 'insert':
                if (!config.fields && !config.documents) {
                    errors.push({
                        type: 'missing_required',
                        property: 'fields',
                        message: 'Document data is required for insert',
                        fix: 'Provide the data to insert'
                    });
                }
                break;
            case 'update':
                if (!config.query) {
                    warnings.push({
                        type: 'security',
                        message: 'Update without query will affect all documents',
                        suggestion: 'Add a query to target specific documents'
                    });
                }
                break;
            case 'delete':
                if (!config.query || config.query === '{}') {
                    errors.push({
                        type: 'invalid_value',
                        property: 'query',
                        message: 'Delete without query would remove all documents - this is a critical security issue',
                        fix: 'Add a query to specify which documents to delete'
                    });
                }
                break;
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            if (operation === 'find') {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'MongoDB queries can fail due to connection issues',
                    suggestion: 'Add onError: "continueRegularOutput" with retryOnFail'
                });
                autofix.onError = 'continueRegularOutput';
                autofix.retryOnFail = true;
                autofix.maxTries = 3;
            }
            else if (['insert', 'update', 'delete'].includes(operation)) {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'MongoDB write operations should handle errors carefully',
                    suggestion: 'Add onError: "continueErrorOutput" to handle write failures separately'
                });
                autofix.onError = 'continueErrorOutput';
                autofix.retryOnFail = true;
                autofix.maxTries = 2;
                autofix.waitBetweenTries = 1000;
            }
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput" or "continueErrorOutput"'
            });
        }
    }
    static validatePostgres(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const { operation } = config;
        if (['execute', 'select', 'insert', 'update', 'delete'].includes(operation)) {
            this.validateSQLQuery(context, 'postgres');
        }
        switch (operation) {
            case 'insert':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for insert operation',
                        fix: 'Specify the table to insert data into'
                    });
                }
                if (!config.columns && !config.dataMode) {
                    warnings.push({
                        type: 'missing_common',
                        property: 'columns',
                        message: 'No columns specified for insert',
                        suggestion: 'Define which columns to insert data into'
                    });
                }
                break;
            case 'update':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for update operation',
                        fix: 'Specify the table to update'
                    });
                }
                if (!config.updateKey) {
                    warnings.push({
                        type: 'missing_common',
                        property: 'updateKey',
                        message: 'No update key specified',
                        suggestion: 'Set updateKey to identify which rows to update (e.g., "id")'
                    });
                }
                break;
            case 'delete':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for delete operation',
                        fix: 'Specify the table to delete from'
                    });
                }
                if (!config.deleteKey) {
                    errors.push({
                        type: 'missing_required',
                        property: 'deleteKey',
                        message: 'Delete key is required to identify rows',
                        fix: 'Set deleteKey (e.g., "id") to specify which rows to delete'
                    });
                }
                break;
            case 'execute':
                if (!config.query) {
                    errors.push({
                        type: 'missing_required',
                        property: 'query',
                        message: 'SQL query is required',
                        fix: 'Provide the SQL query to execute'
                    });
                }
                break;
        }
        if (config.connectionTimeout === undefined) {
            suggestions.push('Consider setting connectionTimeout to handle slow connections');
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            if (operation === 'execute' && config.query?.toLowerCase().includes('select')) {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'Database reads can fail due to connection issues',
                    suggestion: 'Add onError: "continueRegularOutput" and retryOnFail: true'
                });
                autofix.onError = 'continueRegularOutput';
                autofix.retryOnFail = true;
                autofix.maxTries = 3;
            }
            else if (['insert', 'update', 'delete'].includes(operation)) {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'Database writes should handle errors carefully',
                    suggestion: 'Add onError: "stopWorkflow" with retryOnFail for transient failures'
                });
                autofix.onError = 'stopWorkflow';
                autofix.retryOnFail = true;
                autofix.maxTries = 2;
                autofix.waitBetweenTries = 2000;
            }
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput" or "stopWorkflow"'
            });
        }
    }
    static validateAIAgent(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        if (config.promptType === 'define') {
            if (!config.text || (typeof config.text === 'string' && config.text.trim() === '')) {
                errors.push({
                    type: 'missing_required',
                    property: 'text',
                    message: 'Custom prompt text is required when promptType is "define"',
                    fix: 'Provide a custom prompt in the text field, or change promptType to "auto"'
                });
            }
        }
        if (!config.systemMessage || (typeof config.systemMessage === 'string' && config.systemMessage.trim() === '')) {
            suggestions.push('AI Agent works best with a system message that defines the agent\'s role, capabilities, and constraints. Set systemMessage to provide context.');
        }
        else if (typeof config.systemMessage === 'string' && config.systemMessage.trim().length < 20) {
            warnings.push({
                type: 'inefficient',
                property: 'systemMessage',
                message: 'System message is very short (< 20 characters)',
                suggestion: 'Consider a more detailed system message to guide the agent\'s behavior'
            });
        }
        if (config.hasOutputParser === true) {
            warnings.push({
                type: 'best_practice',
                property: 'hasOutputParser',
                message: 'Output parser is enabled. Ensure an ai_outputParser connection is configured in the workflow.',
                suggestion: 'Connect an output parser node (e.g., Structured Output Parser) via ai_outputParser connection type'
            });
        }
        if (config.needsFallback === true) {
            warnings.push({
                type: 'best_practice',
                property: 'needsFallback',
                message: 'Fallback model is enabled. Ensure 2 language models are connected via ai_languageModel connections.',
                suggestion: 'Connect a primary model and a fallback model to handle failures gracefully'
            });
        }
        if (config.maxIterations !== undefined) {
            const maxIter = Number(config.maxIterations);
            if (isNaN(maxIter) || maxIter < 1) {
                errors.push({
                    type: 'invalid_value',
                    property: 'maxIterations',
                    message: 'maxIterations must be a positive number',
                    fix: 'Set maxIterations to a value >= 1 (e.g., 10)'
                });
            }
            else if (maxIter > 50) {
                warnings.push({
                    type: 'inefficient',
                    property: 'maxIterations',
                    message: `maxIterations is set to ${maxIter}. High values can lead to long execution times and high costs.`,
                    suggestion: 'Consider reducing maxIterations to 10-20 for most use cases'
                });
            }
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            warnings.push({
                type: 'best_practice',
                property: 'errorHandling',
                message: 'AI models can fail due to API limits, rate limits, or invalid responses',
                suggestion: 'Add onError: "continueRegularOutput" with retryOnFail for resilience'
            });
            autofix.onError = 'continueRegularOutput';
            autofix.retryOnFail = true;
            autofix.maxTries = 2;
            autofix.waitBetweenTries = 5000;
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput" or "stopWorkflow"'
            });
        }
    }
    static validateMySQL(context) {
        const { config, errors, warnings, suggestions } = context;
        const { operation } = config;
        if (['execute', 'insert', 'update', 'delete'].includes(operation)) {
            this.validateSQLQuery(context, 'mysql');
        }
        switch (operation) {
            case 'insert':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for insert operation',
                        fix: 'Specify the table to insert data into'
                    });
                }
                break;
            case 'update':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for update operation',
                        fix: 'Specify the table to update'
                    });
                }
                if (!config.updateKey) {
                    warnings.push({
                        type: 'missing_common',
                        property: 'updateKey',
                        message: 'No update key specified',
                        suggestion: 'Set updateKey to identify which rows to update'
                    });
                }
                break;
            case 'delete':
                if (!config.table) {
                    errors.push({
                        type: 'missing_required',
                        property: 'table',
                        message: 'Table name is required for delete operation',
                        fix: 'Specify the table to delete from'
                    });
                }
                break;
            case 'execute':
                if (!config.query) {
                    errors.push({
                        type: 'missing_required',
                        property: 'query',
                        message: 'SQL query is required',
                        fix: 'Provide the SQL query to execute'
                    });
                }
                break;
        }
        if (config.timezone === undefined) {
            suggestions.push('Consider setting timezone to ensure consistent date/time handling');
        }
        if (!config.onError && !config.retryOnFail && !config.continueOnFail) {
            if (operation === 'execute' && config.query?.toLowerCase().includes('select')) {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'Database queries can fail due to connection issues',
                    suggestion: 'Add onError: "continueRegularOutput" and retryOnFail: true'
                });
            }
            else if (['insert', 'update', 'delete'].includes(operation)) {
                warnings.push({
                    type: 'best_practice',
                    property: 'errorHandling',
                    message: 'Database modifications should handle errors carefully',
                    suggestion: 'Add onError: "stopWorkflow" with retryOnFail for transient failures'
                });
            }
        }
    }
    static validateSQLQuery(context, dbType = 'generic') {
        const { config, errors, warnings, suggestions } = context;
        const query = config.query || config.deleteQuery || config.updateQuery || '';
        if (!query || typeof query !== 'string')
            return;
        const lowerQuery = query.toLowerCase();
        const isExpression = query.trim().startsWith('=') || query.includes('{{');
        const statementText = lowerQuery.replace(/^\s*=/, '');
        const startsStatement = (keyword) => new RegExp(`(^|;)\\s*${keyword}\\b`).test(statementText);
        const hasWhere = /\bwhere\b/.test(statementText);
        if (query.includes('${') || query.includes('{{')) {
            warnings.push({
                type: 'security',
                message: 'Query contains template expressions that might be vulnerable to SQL injection',
                suggestion: 'Use parameterized queries with query parameters instead of string interpolation'
            });
            suggestions.push('Example: Use "SELECT * FROM users WHERE id = $1" with queryParams: [userId]');
        }
        if (startsStatement('delete') && !hasWhere) {
            if (isExpression) {
                warnings.push({
                    type: 'security',
                    property: 'query',
                    message: 'DELETE query without WHERE clause will delete all records',
                    suggestion: 'The query contains an expression resolved at runtime - make sure the final SQL includes a WHERE clause'
                });
            }
            else {
                errors.push({
                    type: 'invalid_value',
                    property: 'query',
                    message: 'DELETE query without WHERE clause will delete all records',
                    fix: 'Add a WHERE clause to specify which records to delete'
                });
            }
        }
        if (startsStatement('update') && !hasWhere) {
            warnings.push({
                type: 'security',
                message: 'UPDATE query without WHERE clause will update all records',
                suggestion: 'Add a WHERE clause to specify which records to update'
            });
        }
        if (startsStatement('truncate')) {
            warnings.push({
                type: 'security',
                message: 'TRUNCATE will remove all data from the table',
                suggestion: 'Consider using DELETE with WHERE clause if you need to keep some data'
            });
        }
        if (startsStatement('drop')) {
            if (isExpression) {
                warnings.push({
                    type: 'security',
                    property: 'query',
                    message: 'DROP operations are extremely dangerous and will permanently delete database objects',
                    suggestion: 'The query contains an expression resolved at runtime - make sure this DROP is intentional'
                });
            }
            else {
                errors.push({
                    type: 'invalid_value',
                    property: 'query',
                    message: 'DROP operations are extremely dangerous and will permanently delete database objects',
                    fix: 'Use this only if you really intend to delete tables/databases permanently'
                });
            }
        }
        if (lowerQuery.includes('select *')) {
            suggestions.push('Consider selecting specific columns instead of * for better performance');
        }
        if (dbType === 'postgres') {
            if (query.includes('$$')) {
                suggestions.push('Dollar-quoted strings detected - ensure they are properly closed');
            }
        }
        else if (dbType === 'mysql') {
            if (query.includes('`')) {
                suggestions.push('Using backticks for identifiers - ensure they are properly paired');
            }
        }
    }
    static validateHttpRequest(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const { method = 'GET', url, sendBody, authentication } = config;
        if (!url) {
            errors.push({
                type: 'missing_required',
                property: 'url',
                message: 'URL is required for HTTP requests',
                fix: 'Provide the full URL including protocol (https://...)'
            });
        }
        else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.includes('{{')) {
            warnings.push({
                type: 'invalid_value',
                property: 'url',
                message: 'URL should start with http:// or https://',
                suggestion: 'Use https:// for secure connections'
            });
        }
        if (['POST', 'PUT', 'PATCH'].includes(method) && !sendBody) {
            warnings.push({
                type: 'missing_common',
                property: 'sendBody',
                message: `${method} requests typically include a body`,
                suggestion: 'Set sendBody: true and configure the body content'
            });
        }
        if (!config.retryOnFail && !config.onError && !config.continueOnFail) {
            warnings.push({
                type: 'best_practice',
                property: 'errorHandling',
                message: 'HTTP requests can fail due to network issues or server errors',
                suggestion: 'Add onError: "continueRegularOutput" and retryOnFail: true for resilience'
            });
            autofix.onError = 'continueRegularOutput';
            autofix.retryOnFail = true;
            autofix.maxTries = 3;
            autofix.waitBetweenTries = 1000;
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput"'
            });
            autofix.onError = config.continueOnFail ? 'continueRegularOutput' : 'stopWorkflow';
            delete autofix.continueOnFail;
        }
        if (config.retryOnFail) {
            if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && (!config.maxTries || config.maxTries > 3)) {
                warnings.push({
                    type: 'best_practice',
                    property: 'maxTries',
                    message: `${method} requests might not be idempotent. Use fewer retries.`,
                    suggestion: 'Set maxTries: 2 for non-idempotent operations'
                });
            }
            if (!config.alwaysOutputData) {
                suggestions.push('Enable alwaysOutputData to capture error responses for debugging');
                autofix.alwaysOutputData = true;
            }
        }
        if (url && url.includes('api') && !authentication) {
            warnings.push({
                type: 'security',
                property: 'authentication',
                message: 'API endpoints typically require authentication',
                suggestion: 'Configure authentication method (Bearer token, API key, etc.)'
            });
        }
        if (!config.timeout) {
            suggestions.push('Consider setting a timeout to prevent hanging requests');
        }
    }
    static validateWebhook(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const { path, httpMethod = 'POST', responseMode } = config;
        if (!path) {
            errors.push({
                type: 'missing_required',
                property: 'path',
                message: 'Webhook path is required',
                fix: 'Provide a unique path like "my-webhook" or "github-events"'
            });
        }
        else if (path.startsWith('/')) {
            warnings.push({
                type: 'invalid_value',
                property: 'path',
                message: 'Webhook path should not start with /',
                suggestion: 'Use "webhook-name" instead of "/webhook-name"'
            });
        }
        if (!config.onError && !config.continueOnFail) {
            warnings.push({
                type: 'best_practice',
                property: 'onError',
                message: 'Webhooks should always send a response, even on error',
                suggestion: 'Set onError: "continueRegularOutput" to ensure webhook responses'
            });
            autofix.onError = 'continueRegularOutput';
        }
        if (config.continueOnFail !== undefined) {
            warnings.push({
                type: 'deprecated',
                property: 'continueOnFail',
                message: 'continueOnFail is deprecated. Use onError instead',
                suggestion: 'Replace with onError: "continueRegularOutput"'
            });
            autofix.onError = 'continueRegularOutput';
            delete autofix.continueOnFail;
        }
        if (!config.alwaysOutputData) {
            suggestions.push('Enable alwaysOutputData to debug webhook payloads');
            autofix.alwaysOutputData = true;
        }
        suggestions.push('Consider adding webhook validation (HMAC signature verification)');
        suggestions.push('Implement rate limiting for public webhooks');
    }
    static validateCode(context) {
        const { config, errors, warnings, suggestions, autofix } = context;
        const rawLanguage = config.language || 'javaScript';
        const language = rawLanguage === 'pythonNative' ? 'python' : rawLanguage;
        const codeField = language === 'python' ? 'pythonCode' : 'jsCode';
        const code = config[codeField] || '';
        if (!code || code.trim() === '') {
            errors.push({
                type: 'missing_required',
                property: codeField,
                message: 'Code cannot be empty',
                fix: 'Add your code logic. Start with: return [{json: {result: "success"}}]'
            });
            return;
        }
        if (language === 'javaScript') {
            this.validateJavaScriptCode(code, errors, warnings, suggestions);
        }
        else if (language === 'python') {
            this.validatePythonCode(code, errors, warnings, suggestions);
        }
        const mode = config.mode || 'runOnceForAllItems';
        this.validateReturnStatement(code, language, errors, warnings, suggestions, mode);
        this.validateN8nVariables(code, language, warnings, suggestions, errors);
        this.validateCodeSecurity(code, language, warnings);
        if (!config.onError && code.length > 100) {
            warnings.push({
                type: 'best_practice',
                property: 'errorHandling',
                message: 'Code nodes can throw errors - consider error handling',
                suggestion: 'Add onError: "continueRegularOutput" to handle errors gracefully'
            });
            autofix.onError = 'continueRegularOutput';
        }
        if (config.mode === 'runOnceForEachItem' && code.includes('items')) {
            warnings.push({
                type: 'best_practice',
                message: 'In "Run Once for Each Item" mode, use $json instead of items array',
                suggestion: 'Access current item data with $json.fieldName'
            });
        }
        if (!config.mode && code.includes('$json')) {
            warnings.push({
                type: 'best_practice',
                message: '$json only works in "Run Once for Each Item" mode',
                suggestion: 'Either set mode: "runOnceForEachItem" or use items[0].json'
            });
        }
    }
    static validateJavaScriptCode(code, errors, warnings, suggestions) {
        const syntaxPatterns = [
            { pattern: /const\s+const/, message: 'Duplicate const declaration' },
            { pattern: /let\s+let/, message: 'Duplicate let declaration' },
            { pattern: /}\s*}\s*}\s*}$/, message: 'Multiple closing braces at end - check your nesting' }
        ];
        syntaxPatterns.forEach(({ pattern, message }) => {
            if (pattern.test(code)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: `Syntax error: ${message}`,
                    fix: 'Check your JavaScript syntax'
                });
            }
        });
        const functionWithAwait = /function\s+\w*\s*\([^)]*\)\s*{[^}]*await/;
        const arrowWithAwait = /\([^)]*\)\s*=>\s*{[^}]*await/;
        if (code.length <= MAX_CODE_LENGTH
            && (functionWithAwait.test(code) || arrowWithAwait.test(code))
            && !code.includes('async')) {
            warnings.push({
                type: 'best_practice',
                message: 'Using await inside a non-async function',
                suggestion: 'Add async keyword to the function, or use top-level await (Code nodes support it)'
            });
        }
        if (code.includes('$helpers.httpRequest')) {
            suggestions.push('$helpers.httpRequest is async - use: const response = await $helpers.httpRequest(...)');
        }
        if (code.includes('DateTime') && !code.includes('DateTime.')) {
            warnings.push({
                type: 'best_practice',
                message: 'DateTime is from Luxon library',
                suggestion: 'Use DateTime.now() or DateTime.fromISO() for date operations'
            });
        }
    }
    static validatePythonCode(code, errors, warnings, suggestions) {
        const lines = code.split('\n');
        if (code.includes('__name__') && code.includes('__main__')) {
            warnings.push({
                type: 'inefficient',
                message: 'if __name__ == "__main__" is not needed in Code nodes',
                suggestion: 'Code node Python runs directly - remove the main check'
            });
        }
        const unavailableImports = [
            { module: 'requests', suggestion: 'Use JavaScript Code node with $helpers.httpRequest for HTTP requests' },
            { module: 'pandas', suggestion: 'Use built-in list/dict operations or JavaScript for data manipulation' },
            { module: 'numpy', suggestion: 'Use standard Python math operations' },
            { module: 'pip', suggestion: 'External packages cannot be installed in Code nodes' }
        ];
        unavailableImports.forEach(({ module, suggestion }) => {
            if (code.includes(`import ${module}`) || code.includes(`from ${module}`)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'pythonCode',
                    message: `Module '${module}' is not available in Code nodes`,
                    fix: suggestion
                });
            }
        });
        lines.forEach((line, i) => {
            if (line.trim().endsWith(':') && i < lines.length - 1) {
                const nextLine = lines[i + 1];
                if (nextLine.trim() && !nextLine.startsWith(' ') && !nextLine.startsWith('\t')) {
                    errors.push({
                        type: 'invalid_value',
                        property: 'pythonCode',
                        message: `Missing indentation after line ${i + 1}`,
                        fix: 'Indent the line after the colon'
                    });
                }
            }
        });
    }
    static validateReturnStatement(code, language, errors, warnings, suggestions, mode = 'runOnceForAllItems') {
        const returnScanCode = (language === 'javaScript' && code.length <= MAX_CODE_LENGTH)
            ? this.stripNestedJavaScriptFunctionBodies(code)
            : code;
        const hasReturn = /return\s+/.test(returnScanCode);
        if (!hasReturn) {
            errors.push({
                type: 'missing_required',
                property: language === 'python' ? 'pythonCode' : 'jsCode',
                message: 'Code must return data for the next node',
                fix: language === 'python'
                    ? 'Add: return [{"json": {"result": "success"}}]'
                    : 'Add: return [{json: {result: "success"}}]'
            });
            return;
        }
        if (language === 'javaScript') {
            const isRunOncePerItem = mode === 'runOnceForEachItem';
            if (!isRunOncePerItem && this.hasTopLevelPrimitiveReturn(code)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: 'Cannot return primitive values directly',
                    fix: 'Return array of objects: return [{json: {value: yourData}}]'
                });
            }
            if (/return\s+\[[\s\n]*['"`\d]/.test(code)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: 'Array items must be objects with json property',
                    fix: 'Use: return [{json: {value: "data"}}] not return ["data"]'
                });
            }
            if (/return\s+items\s*;?$/.test(code) && !code.includes('map')) {
                suggestions.push('Returning items directly is fine if they already have {json: ...} structure. ' +
                    'To modify: return items.map(item => ({json: {...item.json, newField: "value"}}))');
            }
        }
        if (language === 'python') {
            const isRunOncePerItem = mode === 'runOnceForEachItem';
            if (!isRunOncePerItem && /return\s+{(?!.*\[).*}$/s.test(code)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'pythonCode',
                    message: 'Return value must be a list of dicts',
                    fix: 'Wrap in list: return [{"json": your_dict}]'
                });
            }
            if (!isRunOncePerItem && /return\s+(True|False|None|\d+|['"`])/m.test(code)) {
                errors.push({
                    type: 'invalid_value',
                    property: 'pythonCode',
                    message: 'Cannot return primitive values directly',
                    fix: 'Return list of dicts: return [{"json": {"value": your_data}}]'
                });
            }
        }
    }
    static hasTopLevelPrimitiveReturn(code) {
        if (code.length > MAX_CODE_LENGTH) {
            return JS_PRIMITIVE_RETURN_RE.test(code);
        }
        const topLevelCode = this.stripNestedJavaScriptFunctionBodies(code);
        return JS_PRIMITIVE_RETURN_RE.test(topLevelCode);
    }
    static stripStringsCommentsRegex(code) {
        return this.stripNestedJavaScriptFunctionBodies(code, false);
    }
    static stripNestedJavaScriptFunctionBodies(code, blankFunctionBodies = true) {
        let result = '';
        let braceDepth = 0;
        const functionBodyDepths = [];
        const templateInterpolationDepths = [];
        let state = 'code';
        let inRegexClass = false;
        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const next = code[i + 1];
            const inFunctionBody = functionBodyDepths.length > 0;
            if (state === 'lineComment') {
                result += char === '\n' ? '\n' : ' ';
                if (char === '\n')
                    state = 'code';
                continue;
            }
            if (state === 'blockComment') {
                result += char === '\n' ? '\n' : ' ';
                if (char === '*' && next === '/') {
                    result += ' ';
                    i++;
                    state = 'code';
                }
                continue;
            }
            if (state === 'single' || state === 'double' || state === 'template') {
                if (state === 'template' && char === '$' && next === '{') {
                    result += '  ';
                    i++;
                    braceDepth++;
                    templateInterpolationDepths.push(braceDepth);
                    state = 'code';
                    continue;
                }
                result += char === '\n' ? '\n' : ' ';
                if (char === '\\') {
                    if (next) {
                        result += next === '\n' ? '\n' : ' ';
                        i++;
                    }
                    continue;
                }
                if ((state === 'single' && char === "'") ||
                    (state === 'double' && char === '"') ||
                    (state === 'template' && char === '`')) {
                    state = 'code';
                }
                continue;
            }
            if (state === 'regex') {
                if (char === '\n') {
                    state = 'code';
                    result += '\n';
                    continue;
                }
                result += ' ';
                if (char === '\\') {
                    if (next !== undefined) {
                        result += ' ';
                        i++;
                    }
                    continue;
                }
                if (char === '[')
                    inRegexClass = true;
                else if (char === ']')
                    inRegexClass = false;
                else if (char === '/' && !inRegexClass)
                    state = 'code';
                continue;
            }
            if (char === '/' && next === '/') {
                result += '  ';
                i++;
                state = 'lineComment';
                continue;
            }
            if (char === '/' && next === '*') {
                result += '  ';
                i++;
                state = 'blockComment';
                continue;
            }
            if (char === '/' && this.regexLiteralStartsHere(code, i)) {
                result += ' ';
                inRegexClass = false;
                state = 'regex';
                continue;
            }
            if (char === "'") {
                result += (blankFunctionBodies && inFunctionBody) ? ' ' : char;
                state = 'single';
                continue;
            }
            if (char === '"') {
                result += (blankFunctionBodies && inFunctionBody) ? ' ' : char;
                state = 'double';
                continue;
            }
            if (char === '`') {
                result += (blankFunctionBodies && inFunctionBody) ? ' ' : char;
                state = 'template';
                continue;
            }
            if (char === '{') {
                if (this.startsJavaScriptFunctionBody(code, i)) {
                    functionBodyDepths.push(braceDepth + 1);
                }
                braceDepth++;
                result += (blankFunctionBodies && functionBodyDepths.length > 0) ? ' ' : char;
                continue;
            }
            if (char === '}') {
                if (templateInterpolationDepths[templateInterpolationDepths.length - 1] === braceDepth) {
                    templateInterpolationDepths.pop();
                    braceDepth = Math.max(0, braceDepth - 1);
                    result += ' ';
                    state = 'template';
                    continue;
                }
                result += (blankFunctionBodies && inFunctionBody) ? ' ' : char;
                if (functionBodyDepths[functionBodyDepths.length - 1] === braceDepth) {
                    functionBodyDepths.pop();
                }
                braceDepth = Math.max(0, braceDepth - 1);
                continue;
            }
            result += (blankFunctionBodies && inFunctionBody) ? (char === '\n' ? '\n' : ' ') : char;
        }
        return result;
    }
    static stripPythonStringsAndComments(code) {
        let result = '';
        let i = 0;
        while (i < code.length) {
            const char = code[i];
            if (char === '#') {
                while (i < code.length && code[i] !== '\n') {
                    result += ' ';
                    i++;
                }
                continue;
            }
            if (char === "'" || char === '"') {
                const triple = code.slice(i, i + 3) === char.repeat(3);
                const delim = triple ? char.repeat(3) : char;
                result += ' '.repeat(delim.length);
                i += delim.length;
                while (i < code.length) {
                    if (code[i] === '\\') {
                        result += code[i + 1] === '\n' ? ' \n' : '  ';
                        i += 2;
                        continue;
                    }
                    if (code.slice(i, i + delim.length) === delim) {
                        result += ' '.repeat(delim.length);
                        i += delim.length;
                        break;
                    }
                    if (code[i] === '\n' && !triple) {
                        result += '\n';
                        i++;
                        break;
                    }
                    result += code[i] === '\n' ? '\n' : ' ';
                    i++;
                }
                continue;
            }
            result += char;
            i++;
        }
        return result;
    }
    static startsJavaScriptFunctionBody(code, openBraceIndex) {
        const prefix = code.slice(Math.max(0, openBraceIndex - 500), openBraceIndex);
        if (/=>\s*$/.test(prefix))
            return true;
        let i = openBraceIndex - 1;
        while (i >= 0) {
            if (/\s/.test(code[i])) {
                i--;
                continue;
            }
            if (code[i] === '/' && i > 0 && code[i - 1] === '*') {
                i -= 2;
                while (i >= 1 && !(code[i - 1] === '/' && code[i] === '*'))
                    i--;
                i -= 2;
                continue;
            }
            break;
        }
        if (i < 0 || code[i] !== ')')
            return false;
        const scanFloor = Math.max(0, i - MAX_PARAM_SCAN);
        let depth = 0;
        let j = i;
        for (; j >= scanFloor; j--) {
            const c = code[j];
            if (c === ')')
                depth++;
            else if (c === '(') {
                depth--;
                if (depth === 0)
                    break;
            }
        }
        if (depth !== 0)
            return false;
        const head = code.slice(Math.max(0, j - 60), j);
        if (/(?:^|[^\w$])(?:async\s+)?function\s*\*?(?:\s+[\w$]+)?\s*$/.test(head))
            return true;
        const methodHead = /(?:^|[^\w$.])(?:(?:async|get|set)\s+)?\*?\s*([\w$]+)\s*$/.exec(head);
        if (methodHead && !this.NON_FUNCTION_HEADS.has(methodHead[1]))
            return true;
        return false;
    }
    static regexLiteralStartsHere(code, slashIndex) {
        let j = slashIndex - 1;
        while (j >= 0 && /\s/.test(code[j]))
            j--;
        if (j < 0)
            return true;
        const c = code[j];
        if (/[\w$)\].'"`]/.test(c)) {
            if (/[\w$]/.test(c)) {
                let k = j;
                while (k >= 0 && /[\w$]/.test(code[k]))
                    k--;
                const word = code.slice(k + 1, j + 1);
                return this.REGEX_PRECEDING_KEYWORDS.has(word);
            }
            return false;
        }
        return true;
    }
    static validateN8nVariables(code, language, warnings, suggestions, errors) {
        const scanView = code.length <= MAX_CODE_LENGTH
            ? (language === 'javaScript'
                ? this.stripStringsCommentsRegex(code)
                : this.stripPythonStringsAndComments(code))
            : code;
        const inputPatterns = language === 'javaScript'
            ? ['items', '$input', '$json', '$node', '$prevNode', '$(', '$getWorkflowStaticData', '$workflow', '$execution', '$vars']
            : ['items', '_input'];
        const usesInput = inputPatterns.some(pattern => scanView.includes(pattern));
        if (!usesInput && code.length > 50) {
            warnings.push({
                type: 'best_practice',
                message: 'Code doesn\'t reference input data',
                suggestion: language === 'javaScript'
                    ? 'Access input with: items, $input.all(), or $json (single-item mode)'
                    : 'Access input with: items variable'
            });
        }
        if (scanView.includes('{{') && scanView.includes('}}')) {
            errors.push({
                type: 'invalid_value',
                property: language === 'python' ? 'pythonCode' : 'jsCode',
                message: 'Expression syntax {{...}} is not valid in Code nodes',
                fix: 'Use regular JavaScript/Python syntax without double curly braces'
            });
        }
        if (code.includes('$node[')) {
            warnings.push({
                type: 'invalid_value',
                property: language === 'python' ? 'pythonCode' : 'jsCode',
                message: 'Use $(\'Node Name\') instead of $node[\'Node Name\'] in Code nodes',
                suggestion: 'Replace $node[\'NodeName\'] with $(\'NodeName\')'
            });
        }
        const expressionOnlyFunctions = ['$now()', '$today()', '$tomorrow()', '.unique()', '.pluck(', '.keys()', '.hash('];
        expressionOnlyFunctions.forEach(func => {
            if (code.includes(func)) {
                warnings.push({
                    type: 'invalid_value',
                    property: language === 'python' ? 'pythonCode' : 'jsCode',
                    message: `${func} is an expression-only function not available in Code nodes`,
                    suggestion: 'See Code node documentation for alternatives'
                });
            }
        });
        if (language === 'javaScript') {
            if (/\$(?![a-zA-Z_(])/.test(scanView) && !scanView.includes('${')) {
                warnings.push({
                    type: 'best_practice',
                    message: 'Invalid $ usage detected',
                    suggestion: 'n8n variables start with $: $json, $input, $node, $workflow, $execution'
                });
            }
            if (/(?<![.\w$])helpers\s*\./.test(scanView)) {
                warnings.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: 'Use $helpers not helpers',
                    suggestion: 'Change helpers. to $helpers.'
                });
            }
            if (code.includes('$helpers') && !code.includes('typeof $helpers')) {
                warnings.push({
                    type: 'best_practice',
                    message: '$helpers availability varies by n8n version',
                    suggestion: 'Check availability first: if (typeof $helpers !== "undefined" && $helpers.httpRequest) { ... }'
                });
            }
            if (code.includes('$helpers')) {
                suggestions.push('Common $helpers methods: httpRequest(), prepareBinaryData(). Note: getWorkflowStaticData is a standalone function - use $getWorkflowStaticData() instead');
            }
            if (code.includes('$helpers.getWorkflowStaticData')) {
                errors.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: '$helpers.getWorkflowStaticData() will cause "$helpers is not defined" error',
                    fix: 'Use $getWorkflowStaticData("global") or $getWorkflowStaticData("node") directly'
                });
            }
            if (code.includes('$jmespath(') && /\$jmespath\s*\(\s*['"`]/.test(code)) {
                warnings.push({
                    type: 'invalid_value',
                    property: 'jsCode',
                    message: 'Code node $jmespath has reversed parameter order: $jmespath(data, query)',
                    suggestion: 'Use: $jmespath(dataObject, "query.path") not $jmespath("query.path", dataObject)'
                });
            }
            if (code.includes('items[0].json') && !code.includes('.json.body')) {
                if (code.includes('Webhook') || code.includes('webhook') ||
                    code.includes('$("Webhook")') || code.includes("$('Webhook')")) {
                    warnings.push({
                        type: 'invalid_value',
                        property: 'jsCode',
                        message: 'Webhook data is nested under .body property',
                        suggestion: 'Use items[0].json.body.fieldName instead of items[0].json.fieldName for webhook data'
                    });
                }
                else if (/items\[0\]\.json\.(payload|data|command|action|event|message)\b/.test(code)) {
                    warnings.push({
                        type: 'best_practice',
                        message: 'If processing webhook data, remember it\'s nested under .body',
                        suggestion: 'Webhook payloads are at items[0].json.body, not items[0].json'
                    });
                }
            }
        }
        const jmespathFunction = language === 'javaScript' ? '$jmespath' : '_jmespath';
        if (code.length <= MAX_CODE_LENGTH && code.includes(jmespathFunction + '(')) {
            const filterPattern = /\[?\?[^[\]]*(?:>=?|<=?|==|!=)\s*(\d+(?:\.\d+)?)\s*\]/g;
            let match;
            while ((match = filterPattern.exec(code)) !== null) {
                const number = match[1];
                const beforeNumber = code.substring(match.index, match.index + match[0].indexOf(number));
                const afterNumber = code.substring(match.index + match[0].indexOf(number) + number.length);
                if (!beforeNumber.includes('`') || !afterNumber.startsWith('`')) {
                    errors.push({
                        type: 'invalid_value',
                        property: language === 'python' ? 'pythonCode' : 'jsCode',
                        message: `JMESPath numeric literal ${number} must be wrapped in backticks`,
                        fix: `Change [?field >= ${number}] to [?field >= \`${number}\`]`
                    });
                }
            }
            suggestions.push('JMESPath in n8n requires backticks around numeric literals in filters: [?age >= `18`]');
        }
    }
    static validateCodeSecurity(code, language, warnings) {
        const securityView = language === 'javaScript'
            ? this.stripStringsCommentsRegex(code)
            : this.stripPythonStringsAndComments(code);
        const dangerousPatterns = [
            { pattern: /(?<![.\w$])eval\s*\(/, message: 'Avoid eval() - it\'s a security risk' },
            { pattern: /(?<![.\w$])Function\s*\(/, message: 'Avoid Function constructor - use regular functions' },
            { pattern: /(?:window|globalThis)\s*\.\s*eval\s*\(/, message: 'Avoid eval() - it\'s a security risk' },
            { pattern: /(?:window|globalThis)\s*\.\s*Function\s*\(/, message: 'Avoid Function constructor - use regular functions' },
            { pattern: /(?<![.\w$])exec\s*\(/, message: 'Avoid exec() - it\'s a security risk' },
            { pattern: /process\.env/, message: 'Limited environment access in Code nodes' },
            { pattern: /import\s+\*/, message: 'Avoid import * - be specific about imports' }
        ];
        dangerousPatterns.forEach(({ pattern, message }) => {
            if (pattern.test(securityView)) {
                warnings.push({
                    type: 'security',
                    message,
                    suggestion: 'Use safer alternatives or built-in functions'
                });
            }
        });
        if (code.includes('require(')) {
            const builtinModules = ['crypto', 'util', 'querystring', 'url', 'buffer'];
            const requirePattern = /require\s*\(\s*['"`](\w+)['"`]\s*\)/g;
            let match;
            while ((match = requirePattern.exec(code)) !== null) {
                const moduleName = match[1];
                if (!builtinModules.includes(moduleName)) {
                    warnings.push({
                        type: 'security',
                        message: `Cannot require('${moduleName}') - only built-in Node.js modules are available`,
                        suggestion: `Available modules: ${builtinModules.join(', ')}`
                    });
                }
            }
            if (/require\s*\([^'"`]/.test(code)) {
                warnings.push({
                    type: 'security',
                    message: 'Dynamic require() not supported',
                    suggestion: 'Use static require with string literals: require("crypto")'
                });
            }
        }
        if ((code.includes('crypto.') || code.includes('randomBytes') || code.includes('randomUUID')) &&
            !code.includes('require') && language === 'javaScript') {
            warnings.push({
                type: 'invalid_value',
                message: 'Using crypto without require statement',
                suggestion: 'Add: const crypto = require("crypto"); at the beginning (ignore editor warnings)'
            });
        }
        const fsModuleUsagePatterns = [
            /require\s*\(\s*['"`](?:node:)?(?:fs|path|child_process)['"`]\s*\)/,
            /\bimport\b[^;\n]*\bfrom\s*['"](?:node:)?(?:fs|path|child_process)['"]/,
            /\bimport\s*\(\s*['"`](?:node:)?(?:fs|path|child_process)['"`]\s*\)/,
            /(?<![.\w$])(?:fs|child_process)\s*\.\s*\w/
        ];
        if (fsModuleUsagePatterns.some(pattern => pattern.test(code))) {
            warnings.push({
                type: 'security',
                message: 'File system and process access not available in Code nodes',
                suggestion: 'Use other n8n nodes for file operations (e.g., Read/Write Files node)'
            });
        }
    }
    static validateSet(context) {
        const { config, errors, warnings } = context;
        const jsonOutputIsExpression = typeof config.jsonOutput === 'string'
            && (config.jsonOutput.trim().startsWith('=') || config.jsonOutput.includes('{{'));
        if (config.jsonOutput !== undefined && config.jsonOutput !== null && config.jsonOutput !== ''
            && !jsonOutputIsExpression) {
            try {
                const parsed = JSON.parse(config.jsonOutput);
                if (Array.isArray(parsed)) {
                    errors.push({
                        type: 'invalid_value',
                        property: 'jsonOutput',
                        message: 'Set node expects a JSON object {}, not an array []',
                        fix: 'Either wrap array items as object properties: {"items": [...]}, OR use a different approach for multiple items'
                    });
                }
                if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
                    warnings.push({
                        type: 'inefficient',
                        property: 'jsonOutput',
                        message: 'jsonOutput is an empty object - this node will output no data',
                        suggestion: 'Add properties to the object or remove this node if not needed'
                    });
                }
            }
            catch (e) {
                errors.push({
                    type: 'syntax_error',
                    property: 'jsonOutput',
                    message: `Invalid JSON in jsonOutput: ${e instanceof Error ? e.message : 'Syntax error'}`,
                    fix: 'Ensure jsonOutput contains valid JSON syntax'
                });
            }
        }
        if (config.mode === 'manual') {
            const hasFieldsViaValues = config.values && Object.keys(config.values).length > 0;
            const hasFieldsViaAssignments = config.assignments?.assignments
                && Array.isArray(config.assignments.assignments)
                && config.assignments.assignments.length > 0;
            const hasFields = hasFieldsViaValues || hasFieldsViaAssignments;
            if (!hasFields && !config.jsonOutput) {
                warnings.push({
                    type: 'missing_common',
                    message: 'Set node has no fields configured - will output empty items',
                    suggestion: 'Add field assignments or use JSON mode'
                });
            }
        }
    }
}
exports.NodeSpecificValidators = NodeSpecificValidators;
NodeSpecificValidators.NON_FUNCTION_HEADS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'with', 'await',
]);
NodeSpecificValidators.REGEX_PRECEDING_KEYWORDS = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'do', 'else', 'yield', 'await', 'case', 'throw',
]);
//# sourceMappingURL=node-specific-validators.js.map