"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripTrailingSlashes = stripTrailingSlashes;
function stripTrailingSlashes(value) {
    let end = value.length;
    while (end > 0 && value.charCodeAt(end - 1) === 47) {
        end--;
    }
    return end === value.length ? value : value.slice(0, end);
}
//# sourceMappingURL=strip-trailing-slashes.js.map