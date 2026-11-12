"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithRequestContext = runWithRequestContext;
exports.getRequestScope = getRequestScope;
const async_hooks_1 = require("async_hooks");
const requestScope = new async_hooks_1.AsyncLocalStorage();
function runWithRequestContext(owner, instanceContext, fn) {
    return requestScope.run({ owner, instanceContext }, fn);
}
function getRequestScope(owner) {
    const scope = requestScope.getStore();
    return scope?.owner === owner ? scope : undefined;
}
//# sourceMappingURL=request-context.js.map