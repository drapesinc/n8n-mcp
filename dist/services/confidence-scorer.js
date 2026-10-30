"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfidenceScorer = void 0;
class ConfidenceScorer {
    static scoreResourceLocatorRecommendation(fieldName, nodeType, value) {
        const factors = [];
        let totalWeight = 0;
        let matchedWeight = 0;
        const exactFieldMatch = this.checkExactFieldMatch(fieldName, nodeType);
        factors.push({
            name: 'exact-field-match',
            weight: 0.5,
            matched: exactFieldMatch,
            description: `Field name '${fieldName}' is known to use resource locator in ${nodeType}`
        });
        const patternMatch = this.checkFieldPattern(fieldName);
        factors.push({
            name: 'field-pattern',
            weight: 0.3,
            matched: patternMatch,
            description: `Field name '${fieldName}' matches common resource locator patterns`
        });
        const valuePattern = this.checkValuePattern(value);
        factors.push({
            name: 'value-pattern',
            weight: 0.1,
            matched: valuePattern,
            description: 'Value contains patterns typical of resource identifiers'
        });
        const nodeCategory = this.checkNodeCategory(nodeType);
        factors.push({
            name: 'node-category',
            weight: 0.1,
            matched: nodeCategory,
            description: `Node type '${nodeType}' typically uses resource locators`
        });
        for (const factor of factors) {
            totalWeight += factor.weight;
            if (factor.matched) {
                matchedWeight += factor.weight;
            }
        }
        const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;
        let reason;
        if (score >= 0.8) {
            reason = 'High confidence: Multiple strong indicators suggest resource locator format';
        }
        else if (score >= 0.5) {
            reason = 'Medium confidence: Some indicators suggest resource locator format';
        }
        else if (score >= 0.3) {
            reason = 'Low confidence: Weak indicators for resource locator format';
        }
        else {
            reason = 'Very low confidence: Minimal evidence for resource locator format';
        }
        return {
            value: score,
            reason,
            factors
        };
    }
    static checkExactFieldMatch(fieldName, nodeType) {
        const nodeBase = nodeType.split('.').pop()?.toLowerCase() || '';
        for (const [pattern, fields] of Object.entries(this.EXACT_FIELD_MAPPINGS)) {
            if (nodeBase === pattern || nodeBase.startsWith(`${pattern}-`)) {
                return fields.includes(fieldName);
            }
        }
        return false;
    }
    static checkFieldPattern(fieldName) {
        return this.FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
    }
    static checkValuePattern(value) {
        const content = value.startsWith('=') ? value.substring(1) : value;
        if (!content.includes('{{') || !content.includes('}}')) {
            return false;
        }
        const keyword = /id|key|name|path|url|uri/i;
        return content.split(/[\n\r\u2028\u2029]/).some(line => {
            const open = line.indexOf('{{');
            if (open === -1)
                return false;
            const close = line.lastIndexOf('}}');
            return close > open + 2 && keyword.test(line.slice(open + 2, close));
        });
    }
    static checkNodeCategory(nodeType) {
        const nodeBase = nodeType.split('.').pop()?.toLowerCase() || '';
        return this.RESOURCE_HEAVY_NODES.some(category => nodeBase.includes(category));
    }
    static getConfidenceLevel(score) {
        if (score >= 0.8)
            return 'high';
        if (score >= 0.5)
            return 'medium';
        if (score >= 0.3)
            return 'low';
        return 'very-low';
    }
    static shouldApplyRecommendation(score, threshold = 'normal') {
        const thresholds = {
            strict: 0.8,
            normal: 0.5,
            relaxed: 0.3
        };
        return score >= thresholds[threshold];
    }
}
exports.ConfidenceScorer = ConfidenceScorer;
ConfidenceScorer.EXACT_FIELD_MAPPINGS = {
    'github': ['owner', 'repository', 'user', 'organization'],
    'googlesheets': ['sheetId', 'documentId', 'spreadsheetId'],
    'googledrive': ['fileId', 'folderId', 'driveId'],
    'slack': ['channel', 'user', 'channelId', 'userId'],
    'notion': ['databaseId', 'pageId', 'blockId'],
    'airtable': ['baseId', 'tableId', 'viewId']
};
ConfidenceScorer.FIELD_PATTERNS = [
    /^.*Id$/i,
    /^.*Ids$/i,
    /^.*Key$/i,
    /^.*Name$/i,
    /^.*Path$/i,
    /^.*Url$/i,
    /^.*Uri$/i,
    /^(table|database|collection|bucket|folder|file|document|sheet|board|project|issue|user|channel|team|organization|repository|owner)$/i
];
ConfidenceScorer.RESOURCE_HEAVY_NODES = [
    'github', 'gitlab', 'bitbucket',
    'googlesheets', 'googledrive', 'dropbox',
    'slack', 'discord', 'telegram',
    'notion', 'airtable', 'baserow',
    'jira', 'asana', 'trello', 'monday',
    'salesforce', 'hubspot', 'pipedrive',
    'stripe', 'paypal', 'square',
    'aws', 'gcp', 'azure',
    'mysql', 'postgres', 'mongodb', 'redis'
];
//# sourceMappingURL=confidence-scorer.js.map