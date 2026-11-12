"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeGroupInputSchema = exports.GROUP_DESCRIPTION_MAX_LENGTH = void 0;
exports.parseNodeGroupsInput = parseNodeGroupsInput;
exports.toWorkflowNodeGroup = toWorkflowNodeGroup;
exports.nodeGroupsField = nodeGroupsField;
exports.sanitizeGroupsForApi = sanitizeGroupsForApi;
exports.repairNodeGroups = repairNodeGroups;
exports.checkNodeGroups = checkNodeGroups;
exports.dropRejectedGroup = dropRejectedGroup;
exports.classifyGroupError = classifyGroupError;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const mcp_input_normalizer_1 = require("../utils/mcp-input-normalizer");
exports.GROUP_DESCRIPTION_MAX_LENGTH = 155;
exports.nodeGroupInputSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1).optional(),
    name: zod_1.z.string().trim().min(1),
    nodeIds: zod_1.z.array(zod_1.z.string().trim().min(1)).min(1),
    description: zod_1.z.string().trim().max(exports.GROUP_DESCRIPTION_MAX_LENGTH).optional()
});
function parseNodeGroupsInput(value) {
    if (value === undefined || value === null)
        return undefined;
    const groups = zod_1.z.array(exports.nodeGroupInputSchema).parse((0, mcp_input_normalizer_1.normalizeMcpJsonValue)(value));
    return groups.map(toWorkflowNodeGroup);
}
function toWorkflowNodeGroup(group) {
    const normalized = {
        id: group.id?.trim() || (0, uuid_1.v4)(),
        name: group.name.trim(),
        nodeIds: group.nodeIds
    };
    const description = typeof group.description === 'string' ? group.description.trim() : '';
    if (description)
        normalized.description = description;
    return normalized;
}
function isGroupLike(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const group = value;
    return typeof group.id === 'string' && typeof group.name === 'string' && Array.isArray(group.nodeIds);
}
function groupLabel(group) {
    return group.name?.trim() ? group.name : group.id;
}
const MAX_NAME_IN_MESSAGE = 120;
const MAX_MEMBER_ISSUES_PER_GROUP = 5;
const MAX_EXAMPLES_IN_SUMMARY = 3;
const MAX_GROUP_ISSUES = 50;
const MAX_MISSING_IN_ERROR = 20;
const MAX_CLASSIFY_TEXT_LENGTH = 8192;
function clip(text) {
    return text.length > MAX_NAME_IN_MESSAGE ? `${text.slice(0, MAX_NAME_IN_MESSAGE)}…` : text;
}
function nodeGroupsField(groups) {
    return Array.isArray(groups) && groups.length > 0 ? { nodeGroups: groups } : {};
}
function sanitizeGroupsForApi(groups, options) {
    if (!Array.isArray(groups))
        return [];
    return groups.filter(isGroupLike).map(group => {
        const sanitized = {
            id: group.id,
            name: group.name,
            nodeIds: group.nodeIds.filter(id => typeof id === 'string')
        };
        if (options.includeDescription && typeof group.description === 'string') {
            const description = group.description.trim();
            if (description)
                sanitized.description = description;
        }
        return sanitized;
    });
}
function repairNodeGroups(workflow, options = {}) {
    const groups = workflow.nodeGroups;
    if (!Array.isArray(groups) || groups.length === 0) {
        return { nodeGroups: groups, issues: [] };
    }
    const knownIds = new Set((workflow.nodes ?? []).map(node => node?.id).filter((id) => typeof id === 'string'));
    const authored = options.authoredGroups ?? new Set();
    const issues = [];
    const repaired = [];
    const errors = [];
    let changed = false;
    for (const group of groups) {
        if (!isGroupLike(group)) {
            changed = true;
            issues.push({
                code: 'group-malformed',
                group: 'unknown',
                message: 'A canvas group was dropped because it is missing an id, a name, or its member list.'
            });
            continue;
        }
        const label = groupLabel(group);
        const keptIds = group.nodeIds.filter(id => typeof id === 'string' && knownIds.has(id));
        const removedCount = group.nodeIds.length - keptIds.length;
        if (removedCount > 0 && authored.has(group.name)) {
            const missing = group.nodeIds.filter(id => typeof id !== 'string' || !knownIds.has(id));
            const listed = missing.slice(0, MAX_MISSING_IN_ERROR).map(id => `"${id}"`).join(', ');
            const more = missing.length > MAX_MISSING_IN_ERROR ? ` and ${missing.length - MAX_MISSING_IN_ERROR} more` : '';
            errors.push(`Node group "${label}" references ${missing.length === 1 ? 'node' : 'nodes'} ${listed}${more} that ${missing.length === 1 ? 'is' : 'are'} not in the workflow.`);
            repaired.push(group);
            continue;
        }
        if (keptIds.length === 0) {
            changed = true;
            issues.push({
                code: 'group-empty',
                group: label,
                message: `Node group "${label}" was removed because none of its nodes are left in the workflow.`
            });
            continue;
        }
        if (removedCount > 0) {
            changed = true;
            issues.push({
                code: 'group-member-removed',
                group: label,
                message: `Node group "${label}" lost ${removedCount} member${removedCount === 1 ? '' : 's'} that no longer exist in the workflow; the group was kept with its remaining ${keptIds.length} node${keptIds.length === 1 ? '' : 's'}.`
            });
            repaired.push({ ...group, nodeIds: keptIds });
            continue;
        }
        repaired.push(group);
    }
    return {
        nodeGroups: changed ? repaired : groups,
        issues,
        errors: errors.length > 0 ? errors : undefined
    };
}
function checkNodeGroups(workflow, options = {}) {
    const groups = workflow.nodeGroups;
    if (!Array.isArray(groups) || groups.length === 0)
        return [];
    const issues = [];
    const nodesById = new Map();
    for (const node of workflow.nodes ?? []) {
        if (node?.id)
            nodesById.set(node.id, node);
    }
    const seenNames = new Set();
    const groupByNodeId = new Map();
    let truncated = false;
    const emit = (issue) => {
        if (issues.length >= MAX_GROUP_ISSUES) {
            truncated = true;
            return false;
        }
        issues.push(issue);
        return true;
    };
    for (const group of groups) {
        if (!isGroupLike(group))
            continue;
        const label = clip(groupLabel(group));
        if (seenNames.has(group.name)) {
            const added = emit({
                code: 'group-duplicate-name',
                group: label,
                message: `Two node groups are named "${clip(group.name)}"; n8n requires group names to be unique.`
            });
            if (!added)
                break;
        }
        seenNames.add(group.name);
        if (group.nodeIds.length === 0) {
            const added = emit({
                code: 'group-empty',
                group: label,
                message: `Node group "${label}" has no members; n8n rejects empty groups.`
            });
            if (!added)
                break;
        }
        const memberIssues = [];
        const missing = [];
        const shared = [];
        const triggers = [];
        const counts = { missing: 0, shared: 0, triggers: 0 };
        const note = (list, value) => {
            if (list.length < MAX_EXAMPLES_IN_SUMMARY)
                list.push(clip(value));
        };
        const seenInGroup = new Set();
        const reportedShared = new Set();
        const reportShared = (nodeId, node, owner) => {
            reportedShared.add(nodeId);
            counts.shared++;
            note(shared, String(node.name));
            if (counts.shared <= MAX_MEMBER_ISSUES_PER_GROUP) {
                memberIssues.push({
                    code: 'group-node-in-multiple-groups',
                    group: label,
                    message: `Node "${clip(String(node.name))}" is in both "${owner}" and "${label}"; a node can only belong to one group.`
                });
            }
        };
        for (const nodeId of group.nodeIds) {
            const node = nodesById.get(nodeId);
            if (seenInGroup.has(nodeId)) {
                if (node && !reportedShared.has(nodeId))
                    reportShared(nodeId, node, groupByNodeId.get(nodeId) ?? label);
                continue;
            }
            seenInGroup.add(nodeId);
            if (!node) {
                counts.missing++;
                note(missing, String(nodeId));
                if (counts.missing <= MAX_MEMBER_ISSUES_PER_GROUP) {
                    memberIssues.push({
                        code: 'group-member-removed',
                        group: label,
                        message: `Node group "${label}" references node ID "${clip(String(nodeId))}", which is not in the workflow.`
                    });
                }
                continue;
            }
            const nodeName = clip(String(node.name));
            const owner = groupByNodeId.get(nodeId);
            if (owner) {
                reportShared(nodeId, node, owner);
            }
            else {
                groupByNodeId.set(nodeId, label);
            }
            if (options.isTrigger?.(node)) {
                counts.triggers++;
                note(triggers, String(node.name));
                if (counts.triggers <= MAX_MEMBER_ISSUES_PER_GROUP) {
                    memberIssues.push({
                        code: 'group-contains-trigger',
                        group: label,
                        message: `Node group "${label}" contains trigger node "${nodeName}"; n8n does not allow triggers inside a group.`
                    });
                }
            }
        }
        const summarise = {
            'group-member-removed': counts.missing > MAX_MEMBER_ISSUES_PER_GROUP,
            'group-node-in-multiple-groups': counts.shared > MAX_MEMBER_ISSUES_PER_GROUP,
            'group-contains-trigger': counts.triggers > MAX_MEMBER_ISSUES_PER_GROUP
        };
        const groupIssues = memberIssues.filter(issue => !summarise[issue.code]);
        const examples = (list) => list.map(value => `"${value}"`).join(', ');
        if (summarise['group-member-removed']) {
            groupIssues.push({
                code: 'group-member-removed',
                group: label,
                message: `Node group "${label}" references ${counts.missing} node IDs that are not in the workflow, for example ${examples(missing)}.`
            });
        }
        if (summarise['group-node-in-multiple-groups']) {
            groupIssues.push({
                code: 'group-node-in-multiple-groups',
                group: label,
                message: `${counts.shared} nodes in "${label}" are also in another group, for example ${examples(shared)}; a node can only belong to one group.`
            });
        }
        if (summarise['group-contains-trigger']) {
            groupIssues.push({
                code: 'group-contains-trigger',
                group: label,
                message: `Node group "${label}" contains ${counts.triggers} trigger nodes, for example ${examples(triggers)}; n8n does not allow triggers inside a group.`
            });
        }
        if (!groupIssues.every(emit))
            break;
    }
    if (truncated) {
        issues.push({
            code: 'group-issues-truncated',
            group: 'unknown',
            message: `Only the first ${MAX_GROUP_ISSUES} node group issues are listed; fix these and validate again to see the rest.`
        });
    }
    return issues;
}
function dropRejectedGroup(groups, target) {
    const byId = target.groupId ? groups.findIndex(group => group.id === target.groupId) : -1;
    const index = byId !== -1
        ? byId
        : target.groupName
            ? groups.findIndex(group => group.name === target.groupName)
            : -1;
    if (index === -1)
        return { groups, dropped: null };
    return { groups: groups.filter((_, i) => i !== index), dropped: groups[index] };
}
function classifyGroupError(error) {
    const apiError = error;
    const message = typeof apiError?.message === 'string' ? apiError.message : '';
    if (!apiError || apiError.statusCode !== 400) {
        return { kind: 'unrelated', message };
    }
    let detailsText = '';
    try {
        detailsText = apiError.details === undefined ? '' : JSON.stringify(apiError.details);
    }
    catch {
        detailsText = '';
    }
    const haystack = `${message.slice(0, MAX_CLASSIFY_TEXT_LENGTH)} ${String(detailsText).slice(0, MAX_CLASSIFY_TEXT_LENGTH)}`;
    if (/must NOT have additional propert|Unrecognized key\(s\) in object/i.test(haystack)) {
        const nested = /request\/body\/([A-Za-z0-9_]+)/.exec(haystack);
        if (nested) {
            return nested[1] === 'nodeGroups'
                ? { kind: 'schema-description', message }
                : { kind: 'unrelated', message };
        }
        return { kind: 'schema-field', message };
    }
    const identified = findIdentifiedGroup(haystack);
    if (identified) {
        return { kind: 'semantic', groupName: identified.name, groupId: identified.id, message };
    }
    const named = /(?:node group|group)\s+"([^"]+)"/i.exec(haystack);
    if (named) {
        return { kind: 'semantic', groupName: named[1], message };
    }
    if (/nodeGroups/.test(haystack)) {
        return { kind: 'semantic', message };
    }
    return { kind: 'unrelated', message };
}
function isGroupWordAt(text, index) {
    return ((text.charCodeAt(index) | 0x20) === 0x67 &&
        (text.charCodeAt(index + 1) | 0x20) === 0x72 &&
        (text.charCodeAt(index + 2) | 0x20) === 0x6f &&
        (text.charCodeAt(index + 3) | 0x20) === 0x75 &&
        (text.charCodeAt(index + 4) | 0x20) === 0x70);
}
function findIdentifiedGroup(text) {
    const n = text.length;
    const whitespace = /\s/;
    const lineBreak = /[\n\r\u2028\u2029]/;
    const nextNonSpace = new Int32Array(n + 1).fill(n);
    const nextClose = new Int32Array(n + 1).fill(n);
    const nextBreak = new Int32Array(n + 1).fill(n);
    for (let i = n - 1; i >= 0; i--) {
        const ch = text[i];
        nextNonSpace[i] = whitespace.test(ch) ? nextNonSpace[i + 1] : i;
        nextClose[i] = ch === ')' ? i : nextClose[i + 1];
        nextBreak[i] = lineBreak.test(ch) ? i : nextBreak[i + 1];
    }
    const nextNameEnd = new Int32Array(n + 1).fill(n);
    for (let i = n - 1; i >= 0; i--) {
        let closes = false;
        if (text[i] === '"') {
            const open = nextNonSpace[i + 1];
            closes = open < n && text[open] === '(' && nextClose[open + 1] < n && nextClose[open + 1] > open + 1;
        }
        nextNameEnd[i] = closes ? i : nextNameEnd[i + 1];
    }
    for (let k = 0; k + 5 <= n; k++) {
        if (!isGroupWordAt(text, k))
            continue;
        if (k + 5 >= n || !whitespace.test(text[k + 5]))
            continue;
        const quote = nextNonSpace[k + 5];
        if (quote >= n || text[quote] !== '"')
            continue;
        const start = quote + 1;
        if (start >= n)
            continue;
        const end = nextNameEnd[start + 1];
        if (end >= n || nextBreak[start] < end)
            continue;
        const open = nextNonSpace[end + 1];
        return { name: text.slice(start, end), id: text.slice(open + 1, nextClose[open + 1]) };
    }
    return null;
}
//# sourceMappingURL=node-groups.js.map