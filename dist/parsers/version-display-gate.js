"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isShownAtVersion = isShownAtVersion;
exports.filterPropertiesForVersion = filterPropertiesForVersion;
function matchesCondition(condition, version) {
    if (typeof condition !== 'object' || condition === null || !('_cnd' in condition)) {
        return Number(condition) === version;
    }
    const [operator, target] = Object.entries(condition._cnd)[0] ?? [];
    switch (operator) {
        case 'eq': return version === Number(target);
        case 'not': return version !== Number(target);
        case 'gte': return version >= Number(target);
        case 'lte': return version <= Number(target);
        case 'gt': return version > Number(target);
        case 'lt': return version < Number(target);
        case 'between': return version >= Number(target?.from) && version <= Number(target?.to);
        default: return false;
    }
}
function matchesAny(conditions, version) {
    const list = Array.isArray(conditions) ? conditions : [conditions];
    return list.some(condition => matchesCondition(condition, version));
}
function isShownAtVersion(property, version) {
    const show = property?.displayOptions?.show?.['@version'];
    const hide = property?.displayOptions?.hide?.['@version'];
    if (show !== undefined && !matchesAny(show, version))
        return false;
    if (hide !== undefined && matchesAny(hide, version))
        return false;
    return true;
}
function filterPropertiesForVersion(properties, version) {
    const numeric = Number(version);
    if (!Number.isFinite(numeric))
        return properties;
    return filterList(properties, numeric);
}
function filterList(properties, version) {
    const result = [];
    for (const property of properties) {
        if (!isShownAtVersion(property, version))
            continue;
        if (property.type === 'collection' && Array.isArray(property.options)) {
            result.push({ ...property, options: filterList(property.options, version) });
        }
        else if (property.type === 'fixedCollection' && Array.isArray(property.options)) {
            result.push({
                ...property,
                options: property.options.map((group) => Array.isArray(group?.values) ? { ...group, values: filterList(group.values, version) } : group)
            });
        }
        else {
            result.push(property);
        }
    }
    return result;
}
//# sourceMappingURL=version-display-gate.js.map