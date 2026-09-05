"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DERIVED_SETTINGS_PROPERTIES = exports.SETTINGS_PASS_THROUGH_FLOOR = exports.WORKFLOW_SETTINGS_PROPERTIES = void 0;
const v = (major, minor, patch = 0) => ({ major, minor, patch });
exports.WORKFLOW_SETTINGS_PROPERTIES = {
    saveExecutionProgress: { since: v(0, 0, 0) },
    saveManualExecutions: { since: v(0, 0, 0) },
    saveDataErrorExecution: { since: v(0, 0, 0) },
    saveDataSuccessExecution: { since: v(0, 0, 0) },
    executionTimeout: { since: v(0, 0, 0) },
    errorWorkflow: { since: v(0, 0, 0) },
    timezone: { since: v(0, 0, 0) },
    executionOrder: { since: v(1, 37, 0) },
    callerPolicy: { since: v(1, 119, 0) },
    callerIds: { since: v(1, 119, 0) },
    timeSavedPerExecution: { since: v(1, 119, 0) },
    availableInMCP: { since: v(1, 119, 0) },
    customTelemetryTags: { since: v(2, 24, 0) },
    redactionPolicy: { since: v(2, 26, 0) },
    binaryMode: { since: v(2, 33, 0), derived: true },
    timeSavedMode: { since: v(2, 33, 0) },
    credentialResolverId: { since: v(2, 33, 0), derived: true },
    engineType: { since: v(2, 36, 0), derived: true, entityOnly: true },
};
exports.SETTINGS_PASS_THROUGH_FLOOR = v(2, 24, 0);
exports.DERIVED_SETTINGS_PROPERTIES = new Set(Object.entries(exports.WORKFLOW_SETTINGS_PROPERTIES)
    .filter(([, meta]) => meta.derived)
    .map(([name]) => name));
//# sourceMappingURL=workflow-settings.js.map