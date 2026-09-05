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
            const missing = group.nodeIds.filter(id => !keptIds.includes(id));
            errors.push(`Node group "${label}" references ${missing.length === 1 ? 'node' : 'nodes'} ${missing
                .map(id => `"${id}"`)
                .join(', ')} that ${missing.length === 1 ? 'is' : 'are'} not in the workflow.`);
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
    for (const group of groups) {
        if (!isGroupLike(group))
            continue;
        const label = groupLabel(group);
        if (seenNames.has(group.name)) {
            issues.push({
                code: 'group-duplicate-name',
                group: label,
                message: `Two node groups are named "${group.name}"; n8n requires group names to be unique.`
            });
        }
        seenNames.add(group.name);
        if (group.nodeIds.length === 0) {
            issues.push({
                code: 'group-empty',
                group: label,
                message: `Node group "${label}" has no members; n8n rejects empty groups.`
            });
        }
        for (const nodeId of group.nodeIds) {
            const node = nodesById.get(nodeId);
            if (!node) {
                issues.push({
                    code: 'group-member-removed',
                    group: label,
                    message: `Node group "${label}" references node ID "${nodeId}", which is not in the workflow.`
                });
                continue;
            }
            const owner = groupByNodeId.get(nodeId);
            if (owner) {
                issues.push({
                    code: 'group-node-in-multiple-groups',
                    group: label,
                    message: `Node "${node.name}" is in both "${owner}" and "${label}"; a node can only belong to one group.`
                });
            }
            else {
                groupByNodeId.set(nodeId, label);
            }
            if (options.isTrigger?.(node)) {
                issues.push({
                    code: 'group-contains-trigger',
                    group: label,
                    message: `Node group "${label}" contains trigger node "${node.name}"; n8n does not allow triggers inside a group.`
                });
            }
        }
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
    const haystack = `${message} ${detailsText}`;
    if (/must NOT have additional propert|Unrecognized key\(s\) in object/i.test(haystack)) {
        const nested = /request\/body\/([A-Za-z0-9_]+)/.exec(haystack);
        if (nested) {
            return nested[1] === 'nodeGroups'
                ? { kind: 'schema-description', message }
                : { kind: 'unrelated', message };
        }
        return { kind: 'schema-field', message };
    }
    const identified = /(?:node group|group)\s+"(.+?)"\s*\(([^)]+)\)/i.exec(haystack);
    if (identified) {
        return { kind: 'semantic', groupName: identified[1], groupId: identified[2], message };
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
//# sourceMappingURL=node-groups.js.map