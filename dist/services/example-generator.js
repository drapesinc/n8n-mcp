"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleGenerator = void 0;
class ExampleGenerator {
    static getExamples(nodeType, essentials) {
        const examples = this.NODE_EXAMPLES[nodeType];
        if (examples) {
            return examples;
        }
        return this.generateBasicExamples(nodeType, essentials);
    }
    static generateBasicExamples(nodeType, essentials) {
        const minimal = {};
        if (essentials?.required) {
            for (const prop of essentials.required) {
                minimal[prop.name] = this.getDefaultValue(prop);
            }
        }
        if (Object.keys(minimal).length === 0 && essentials?.common?.length > 0) {
            const firstCommon = essentials.common[0];
            minimal[firstCommon.name] = this.getDefaultValue(firstCommon);
        }
        return { minimal };
    }
    static getDefaultValue(prop) {
        if (prop.default !== undefined) {
            return prop.default;
        }
        switch (prop.type) {
            case 'string':
                return this.getStringDefault(prop);
            case 'number':
                return prop.name.includes('port') ? 80 :
                    prop.name.includes('timeout') ? 30000 :
                        prop.name.includes('limit') ? 10 : 0;
            case 'boolean':
                return false;
            case 'options':
            case 'multiOptions':
                return prop.options?.[0]?.value || '';
            case 'json':
                return '{\n  "key": "value"\n}';
            case 'collection':
            case 'fixedCollection':
                return {};
            default:
                return '';
        }
    }
    static getStringDefault(prop) {
        const name = prop.name.toLowerCase();
        if (name.includes('url') || name === 'endpoint') {
            return 'https://api.example.com';
        }
        if (name.includes('email')) {
            return name.includes('from') ? 'sender@example.com' : 'recipient@example.com';
        }
        if (name.includes('path')) {
            return name.includes('webhook') ? 'my-webhook' : '/path/to/file';
        }
        if (name === 'name' || name.includes('username')) {
            return 'John Doe';
        }
        if (name.includes('key')) {
            return 'myKey';
        }
        if (name === 'query' || name.includes('sql')) {
            return 'SELECT * FROM table_name LIMIT 10';
        }
        if (name === 'collection' || name === 'table') {
            return 'users';
        }
        if (prop.placeholder) {
            return prop.placeholder;
        }
        return '';
    }
    static getTaskExample(nodeType, task) {
        const examples = this.NODE_EXAMPLES[nodeType];
        if (!examples)
            return undefined;
        const taskMap = {
            'basic': 'minimal',
            'simple': 'minimal',
            'typical': 'common',
            'standard': 'common',
            'complex': 'advanced',
            'full': 'advanced'
        };
        const exampleType = taskMap[task] || 'common';
        return examples[exampleType] || examples.minimal;
    }
}
exports.ExampleGenerator = ExampleGenerator;
ExampleGenerator.NODE_EXAMPLES = {
    'nodes-base.httpRequest': {
        minimal: {
            url: 'https://api.example.com/data'
        },
        common: {
            method: 'POST',
            url: 'https://api.example.com/users',
            sendBody: true,
            contentType: 'json',
            specifyBody: 'json',
            jsonBody: '{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
        },
        advanced: {
            method: 'POST',
            url: 'https://api.example.com/protected/resource',
            authentication: 'genericCredentialType',
            genericAuthType: 'headerAuth',
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'X-API-Version',
                        value: 'v2'
                    }
                ]
            },
            sendBody: true,
            contentType: 'json',
            specifyBody: 'json',
            jsonBody: '{\n  "action": "update",\n  "data": {}\n}',
            onError: 'continueRegularOutput',
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 1000,
            alwaysOutputData: true
        }
    },
    'nodes-base.webhook': {
        minimal: {
            path: 'my-webhook',
            httpMethod: 'POST'
        },
        common: {
            path: 'webhook-endpoint',
            httpMethod: 'POST',
            responseMode: 'lastNode',
            responseData: 'allEntries',
            responseCode: 200,
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        }
    },
    'nodes-base.code.webhookProcessing': {
        minimal: {
            language: 'javaScript',
            jsCode: `// ⚠️ CRITICAL: Webhook data is nested under 'body' property!
// This Code node should be connected after a Webhook node

// ❌ WRONG - This will be undefined:
// const command = items[0].json.testCommand;

// ✅ CORRECT - Access webhook data through body:
const webhookData = items[0].json.body;
const headers = items[0].json.headers;
const query = items[0].json.query;

// Process webhook payload
return [{
  json: {
    // Extract data from webhook body
    command: webhookData.testCommand,
    userId: webhookData.userId,
    data: webhookData.data,
    
    // Add metadata
    timestamp: DateTime.now().toISO(),
    requestId: headers['x-request-id'] || crypto.randomUUID(),
    source: query.source || 'webhook',
    
    // Original webhook info
    httpMethod: items[0].json.httpMethod,
    webhookPath: items[0].json.webhookPath
  }
}];`
        }
    },
    'nodes-base.code': {
        minimal: {
            language: 'javaScript',
            jsCode: 'return [{json: {result: "success"}}];'
        },
        common: {
            language: 'javaScript',
            jsCode: `// Process each item and add timestamp
return items.map(item => ({
  json: {
    ...item.json,
    processed: true,
    timestamp: DateTime.now().toISO()
  }
}));`,
            onError: 'continueRegularOutput'
        },
        advanced: {
            language: 'javaScript',
            jsCode: `// Advanced data processing with proper helper checks
const crypto = require('crypto');
const results = [];

for (const item of items) {
  try {
    // Validate required fields
    if (!item.json.email || !item.json.name) {
      throw new Error('Missing required fields: email or name');
    }
    
    // Generate secure API key
    const apiKey = crypto.randomBytes(16).toString('hex');
    
    // Check if $helpers is available before using
    let response;
    if (typeof $helpers !== 'undefined' && $helpers.httpRequest) {
      response = await $helpers.httpRequest({
        method: 'POST',
        url: 'https://api.example.com/process',
        body: {
          email: item.json.email,
          name: item.json.name,
          apiKey
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      // Fallback if $helpers not available
      response = { message: 'HTTP requests not available in this n8n version' };
    }
    
    // Add to results with response data
    results.push({
      json: {
        ...item.json,
        apiResponse: response,
        processedAt: DateTime.now().toISO(),
        status: 'success'
      }
    });
    
  } catch (error) {
    // Include failed items with error info
    results.push({
      json: {
        ...item.json,
        error: error.message,
        status: 'failed',
        processedAt: DateTime.now().toISO()
      }
    });
  }
}

return results;`,
            onError: 'continueRegularOutput',
            retryOnFail: true,
            maxTries: 2
        }
    },
    'nodes-base.code.dataTransform': {
        minimal: {
            language: 'javaScript',
            jsCode: `// Transform CSV-like data to JSON
return items.map(item => {
  const lines = item.json.data.split('\\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, i) => {
      obj[header.trim()] = values[i]?.trim() || '';
      return obj;
    }, {});
  });
  
  return {json: {rows, count: rows.length}};
});`
        }
    },
    'nodes-base.code.aggregation': {
        minimal: {
            language: 'javaScript',
            jsCode: `// Aggregate data from all items
const totals = items.reduce((acc, item) => {
  acc.count++;
  acc.sum += item.json.amount || 0;
  acc.categories[item.json.category] = (acc.categories[item.json.category] || 0) + 1;
  return acc;
}, {count: 0, sum: 0, categories: {}});

return [{
  json: {
    totalItems: totals.count,
    totalAmount: totals.sum,
    averageAmount: totals.sum / totals.count,
    categoryCounts: totals.categories,
    processedAt: DateTime.now().toISO()
  }
}];`
        }
    },
    'nodes-base.code.filtering': {
        minimal: {
            language: 'javaScript',
            jsCode: `// Filter items based on conditions
return items
  .filter(item => {
    const amount = item.json.amount || 0;
    const status = item.json.status || '';
    return amount > 100 && status === 'active';
  })
  .map(item => ({json: item.json}));`
        }
    },
    'nodes-base.code.jmespathFiltering': {
        minimal: {
            language: 'javaScript',
            jsCode: `// JMESPath filtering - IMPORTANT: Use backticks for numeric literals!
const allItems = items.map(item => item.json);

// ✅ CORRECT - Filter with numeric literals using backticks
const expensiveItems = $jmespath(allItems, '[?price >= \`100\`]');
const lowStock = $jmespath(allItems, '[?inventory < \`10\`]');
const highPriority = $jmespath(allItems, '[?priority == \`1\`]');

// Combine multiple conditions
const urgentExpensive = $jmespath(allItems, '[?price >= \`100\` && priority == \`1\`]');

// String comparisons don't need backticks
const activeItems = $jmespath(allItems, '[?status == "active"]');

// Return filtered results
return expensiveItems.map(item => ({json: item}));`
        }
    },
    'nodes-base.code.pythonExample': {
        minimal: {
            language: 'python',
            pythonCode: `# Python data processing - use underscore prefix for built-in variables
import json
from datetime import datetime
import re

results = []

# Use _input.all() to get items in Python
for item in _input.all():
    # Convert JsProxy to Python dict to avoid issues with null values
    item_data = item.json.to_py()
    
    # Clean email addresses
    email = item_data.get('email', '')
    if email and re.match(r'^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$', email):
        cleaned_data = {
            'email': email.lower(),
            'name': item_data.get('name', '').title(),
            'validated': True,
            'timestamp': datetime.now().isoformat()
        }
    else:
        # Spread operator doesn't work with JsProxy, use dict()
        cleaned_data = dict(item_data)
        cleaned_data['validated'] = False
        cleaned_data['error'] = 'Invalid email format'
    
    results.append({'json': cleaned_data})

return results`
        }
    },
    'nodes-base.code.aiTool': {
        minimal: {
            language: 'javaScript',
            mode: 'runOnceForEachItem',
            jsCode: `// Code node as AI tool - calculate discount
const quantity = $json.quantity || 1;
const price = $json.price || 0;

let discountRate = 0;
if (quantity >= 100) discountRate = 0.20;
else if (quantity >= 50) discountRate = 0.15;
else if (quantity >= 20) discountRate = 0.10;
else if (quantity >= 10) discountRate = 0.05;

const subtotal = price * quantity;
const discount = subtotal * discountRate;
const total = subtotal - discount;

return [{
  json: {
    quantity,
    price,
    subtotal,
    discountRate: discountRate * 100,
    discountAmount: discount,
    total,
    savings: discount
  }
}];`
        }
    },
    'nodes-base.code.crypto': {
        minimal: {
            language: 'javaScript',
            jsCode: `// Using crypto in Code nodes - it IS available!
const crypto = require('crypto');

// Generate secure tokens
const token = crypto.randomBytes(32).toString('hex');
const uuid = crypto.randomUUID();

// Create hashes
const hash = crypto.createHash('sha256')
  .update(items[0].json.data || 'test')
  .digest('hex');

return [{
  json: {
    token,
    uuid,
    hash,
    timestamp: DateTime.now().toISO()
  }
}];`
        }
    },
    'nodes-base.code.staticData': {
        minimal: {
            language: 'javaScript',
            jsCode: `// Using workflow static data correctly
// IMPORTANT: $getWorkflowStaticData is a standalone function!
const staticData = $getWorkflowStaticData('global');

// Initialize counter if not exists
if (!staticData.processCount) {
  staticData.processCount = 0;
  staticData.firstRun = DateTime.now().toISO();
}

// Update counter
staticData.processCount++;
staticData.lastRun = DateTime.now().toISO();

// Process items
const results = items.map(item => ({
  json: {
    ...item.json,
    runNumber: staticData.processCount,
    processed: true
  }
}));

return results;`
        }
    },
    'nodes-base.set': {
        minimal: {
            mode: 'manual',
            assignments: {
                assignments: [
                    {
                        id: '1',
                        name: 'status',
                        value: 'active',
                        type: 'string'
                    }
                ]
            }
        },
        common: {
            mode: 'manual',
            includeOtherFields: true,
            assignments: {
                assignments: [
                    {
                        id: '1',
                        name: 'status',
                        value: 'processed',
                        type: 'string'
                    },
                    {
                        id: '2',
                        name: 'processedAt',
                        value: '={{ $now.toISO() }}',
                        type: 'string'
                    },
                    {
                        id: '3',
                        name: 'itemCount',
                        value: '={{ $items().length }}',
                        type: 'number'
                    }
                ]
            }
        }
    },
    'nodes-base.if': {
        minimal: {
            conditions: {
                options: {
                    version: 2,
                    leftValue: '',
                    caseSensitive: true,
                    typeValidation: 'strict'
                },
                combinator: 'and',
                conditions: [
                    {
                        id: '1',
                        leftValue: '={{ $json.status }}',
                        rightValue: 'active',
                        operator: {
                            type: 'string',
                            operation: 'equals'
                        }
                    }
                ]
            }
        },
        common: {
            conditions: {
                options: {
                    version: 2,
                    leftValue: '',
                    caseSensitive: true,
                    typeValidation: 'strict'
                },
                combinator: 'and',
                conditions: [
                    {
                        id: '1',
                        leftValue: '={{ $json.status }}',
                        rightValue: 'active',
                        operator: {
                            type: 'string',
                            operation: 'equals'
                        }
                    },
                    {
                        id: '2',
                        leftValue: '={{ $json.count }}',
                        rightValue: 10,
                        operator: {
                            type: 'number',
                            operation: 'gt'
                        }
                    }
                ]
            },
            combineOperation: 'all'
        }
    },
    'nodes-base.postgres': {
        minimal: {
            operation: 'executeQuery',
            query: 'SELECT * FROM users LIMIT 10'
        },
        common: {
            operation: 'insert',
            table: 'users',
            columns: 'name,email,created_at',
            additionalFields: {}
        },
        advanced: {
            operation: 'executeQuery',
            query: `INSERT INTO users (name, email, status)
VALUES ($1, $2, $3)
ON CONFLICT (email) 
DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = NOW()
RETURNING *;`,
            additionalFields: {
                queryParams: '={{ $json.name }},{{ $json.email }},active'
            },
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 2000,
            onError: 'continueErrorOutput'
        }
    },
    'nodes-base.openAi': {
        minimal: {
            resource: 'chat',
            operation: 'message',
            modelId: 'gpt-3.5-turbo',
            messages: {
                values: [
                    {
                        role: 'user',
                        content: 'Hello, how can you help me?'
                    }
                ]
            }
        },
        common: {
            resource: 'chat',
            operation: 'message',
            modelId: 'gpt-4',
            messages: {
                values: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that summarizes text concisely.'
                    },
                    {
                        role: 'user',
                        content: '={{ $json.text }}'
                    }
                ]
            },
            options: {
                maxTokens: 150,
                temperature: 0.7
            },
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 5000,
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        }
    },
    'nodes-base.googleSheets': {
        minimal: {
            operation: 'read',
            documentId: {
                __rl: true,
                value: 'https://docs.google.com/spreadsheets/d/your-sheet-id',
                mode: 'url'
            },
            sheetName: 'Sheet1'
        },
        common: {
            operation: 'append',
            documentId: {
                __rl: true,
                value: 'your-sheet-id',
                mode: 'id'
            },
            sheetName: 'Sheet1',
            dataStartRow: 2,
            columns: {
                mappingMode: 'defineBelow',
                value: {
                    'Name': '={{ $json.name }}',
                    'Email': '={{ $json.email }}',
                    'Date': '={{ $now.toISO() }}'
                }
            }
        }
    },
    'nodes-base.slack': {
        minimal: {
            resource: 'message',
            operation: 'post',
            channel: '#general',
            text: 'Hello from n8n!'
        },
        common: {
            resource: 'message',
            operation: 'post',
            channel: '#notifications',
            text: 'New order received!',
            attachments: [
                {
                    color: '#36a64f',
                    title: 'Order #{{ $json.orderId }}',
                    fields: {
                        item: [
                            {
                                title: 'Customer',
                                value: '{{ $json.customerName }}',
                                short: true
                            },
                            {
                                title: 'Amount',
                                value: '${{ $json.amount }}',
                                short: true
                            }
                        ]
                    }
                }
            ],
            retryOnFail: true,
            maxTries: 2,
            waitBetweenTries: 3000,
            onError: 'continueRegularOutput'
        }
    },
    'nodes-base.emailSend': {
        minimal: {
            fromEmail: 'sender@example.com',
            toEmail: 'recipient@example.com',
            subject: 'Test Email',
            text: 'This is a test email from n8n.'
        },
        common: {
            fromEmail: 'notifications@company.com',
            toEmail: '={{ $json.email }}',
            subject: 'Welcome to our service, {{ $json.name }}!',
            html: `<h1>Welcome!</h1>
<p>Hi {{ $json.name }},</p>
<p>Thank you for signing up. We're excited to have you on board!</p>
<p>Best regards,<br>The Team</p>`,
            options: {
                ccEmail: 'admin@company.com'
            },
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 2000,
            onError: 'continueRegularOutput'
        }
    },
    'nodes-base.merge': {
        minimal: {
            mode: 'append'
        },
        common: {
            mode: 'mergeByKey',
            propertyName1: 'id',
            propertyName2: 'userId'
        }
    },
    'nodes-base.function': {
        minimal: {
            functionCode: 'return items;'
        },
        common: {
            functionCode: `// Add a timestamp to each item
const processedItems = items.map(item => {
  return {
    ...item,
    json: {
      ...item.json,
      processedAt: new Date().toISOString()
    }
  };
});

return processedItems;`
        }
    },
    'nodes-base.splitInBatches': {
        minimal: {
            batchSize: 10
        },
        common: {
            batchSize: 100,
            options: {
                reset: false
            }
        }
    },
    'nodes-base.redis': {
        minimal: {
            operation: 'set',
            key: 'myKey',
            value: 'myValue'
        },
        common: {
            operation: 'set',
            key: 'user:{{ $json.userId }}',
            value: '={{ JSON.stringify($json) }}',
            expire: true,
            ttl: 3600
        }
    },
    'nodes-base.mongoDb': {
        minimal: {
            operation: 'find',
            collection: 'users'
        },
        common: {
            operation: 'findOneAndUpdate',
            collection: 'users',
            query: '{ "email": "{{ $json.email }}" }',
            update: '{ "$set": { "lastLogin": "{{ $now.toISO() }}" } }',
            options: {
                upsert: true,
                returnNewDocument: true
            },
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 1000,
            onError: 'continueErrorOutput'
        }
    },
    'nodes-base.mySql': {
        minimal: {
            operation: 'executeQuery',
            query: 'SELECT * FROM products WHERE active = 1'
        },
        common: {
            operation: 'insert',
            table: 'orders',
            columns: 'customer_id,product_id,quantity,order_date',
            options: {
                queryBatching: 'independently'
            },
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 2000,
            onError: 'stopWorkflow'
        }
    },
    'nodes-base.ftp': {
        minimal: {
            operation: 'download',
            path: '/files/data.csv'
        },
        common: {
            operation: 'upload',
            path: '/uploads/',
            fileName: 'report_{{ $now.format("yyyy-MM-dd") }}.csv',
            binaryData: true,
            binaryPropertyName: 'data'
        }
    },
    'nodes-base.ssh': {
        minimal: {
            resource: 'command',
            operation: 'execute',
            command: 'ls -la'
        },
        common: {
            resource: 'command',
            operation: 'execute',
            command: 'cd /var/logs && tail -n 100 app.log | grep ERROR',
            cwd: '/home/user'
        }
    },
    'nodes-base.executeCommand': {
        minimal: {
            command: 'echo "Hello from n8n"'
        },
        common: {
            command: 'node process-data.js --input "{{ $json.filename }}"',
            cwd: '/app/scripts'
        }
    },
    'nodes-base.github': {
        minimal: {
            resource: 'issue',
            operation: 'get',
            owner: 'n8n-io',
            repository: 'n8n',
            issueNumber: 123
        },
        common: {
            resource: 'issue',
            operation: 'create',
            owner: '={{ $json.organization }}',
            repository: '={{ $json.repo }}',
            title: 'Bug: {{ $json.title }}',
            body: `## Description
{{ $json.description }}

## Steps to Reproduce
{{ $json.steps }}

## Expected Behavior
{{ $json.expected }}`,
            assignees: ['maintainer'],
            labels: ['bug', 'needs-triage']
        }
    },
    'error-handling.modern-patterns': {
        minimal: {
            onError: 'continueRegularOutput'
        },
        common: {
            onError: 'continueErrorOutput',
            alwaysOutputData: true
        },
        advanced: {
            onError: 'stopWorkflow',
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 2000
        }
    },
    'error-handling.api-with-retry': {
        minimal: {
            url: 'https://api.example.com/data',
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 1000
        },
        common: {
            method: 'GET',
            url: 'https://api.example.com/users/{{ $json.userId }}',
            retryOnFail: true,
            maxTries: 5,
            waitBetweenTries: 2000,
            alwaysOutputData: true,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'X-Request-ID',
                        value: '={{ $workflow.id }}-{{ $execution.id }}'
                    }
                ]
            }
        },
        advanced: {
            method: 'POST',
            url: 'https://api.example.com/critical-operation',
            sendBody: true,
            contentType: 'json',
            specifyBody: 'json',
            jsonBody: '{{ JSON.stringify($json) }}',
            retryOnFail: true,
            maxTries: 5,
            waitBetweenTries: 1000,
            alwaysOutputData: true,
            onError: 'stopWorkflow'
        }
    },
    'error-handling.fault-tolerant': {
        minimal: {
            onError: 'continueRegularOutput'
        },
        common: {
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        },
        advanced: {
            onError: 'continueRegularOutput',
            retryOnFail: true,
            maxTries: 2,
            waitBetweenTries: 500,
            alwaysOutputData: true
        }
    },
    'error-handling.database-patterns': {
        minimal: {
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        },
        common: {
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 2000,
            onError: 'stopWorkflow'
        },
        advanced: {
            onError: 'continueErrorOutput',
            retryOnFail: false,
            alwaysOutputData: true
        }
    },
    'error-handling.webhook-patterns': {
        minimal: {
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        },
        common: {
            onError: 'continueErrorOutput',
            alwaysOutputData: true,
            responseCode: 200,
            responseData: 'allEntries'
        }
    },
    'error-handling.ai-patterns': {
        minimal: {
            retryOnFail: true,
            maxTries: 3,
            waitBetweenTries: 5000,
            onError: 'continueRegularOutput'
        },
        common: {
            retryOnFail: true,
            maxTries: 5,
            waitBetweenTries: 2000,
            onError: 'continueRegularOutput',
            alwaysOutputData: true
        }
    }
};
//# sourceMappingURL=example-generator.js.map