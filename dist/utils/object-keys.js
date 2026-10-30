"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVED_OBJECT_KEYS = void 0;
exports.isReservedObjectKey = isReservedObjectKey;
exports.hasOwnKey = hasOwnKey;
exports.RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isReservedObjectKey(key) {
    return key !== null && key !== undefined && typeof key !== 'symbol' && exports.RESERVED_OBJECT_KEYS.has(String(key));
}
function hasOwnKey(obj, key) {
    return obj !== null && obj !== undefined && Object.prototype.hasOwnProperty.call(obj, key);
}
//# sourceMappingURL=object-keys.js.map