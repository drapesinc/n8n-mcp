"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateWorkflowVersionsInstanceId = migrateWorkflowVersionsInstanceId;
const logger_1 = require("../../utils/logger");
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL DEFAULT '',
    workflow_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    workflow_name TEXT NOT NULL,
    workflow_snapshot TEXT NOT NULL,
    trigger TEXT NOT NULL CHECK(trigger IN (
      'partial_update',
      'full_update',
      'autofix'
    )),
    operations TEXT,
    fix_types TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, workflow_id, version_number)
  );
`;
const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_workflow_versions_instance ON workflow_versions(instance_id, workflow_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_versions_created_at ON workflow_versions(created_at);
  CREATE INDEX IF NOT EXISTS idx_workflow_versions_trigger ON workflow_versions(trigger);
`;
function migrateWorkflowVersionsInstanceId(db) {
    try {
        const columns = db.prepare('PRAGMA table_info(workflow_versions)').all();
        const tableExists = columns.length > 0;
        const hasInstanceId = columns.some((col) => col.name === 'instance_id');
        if (tableExists && hasInstanceId) {
            return false;
        }
        db.exec(`
      DROP TABLE IF EXISTS workflow_versions;
      ${CREATE_TABLE}
      ${CREATE_INDEXES}
    `);
        logger_1.logger.info(tableExists
            ? 'Migrated workflow_versions: added instance_id tenant scoping (legacy version backups purged)'
            : 'Created workflow_versions table with instance_id tenant scoping');
        return true;
    }
    catch (error) {
        logger_1.logger.warn('Could not apply workflow_versions instance_id migration', { error });
        return false;
    }
}
//# sourceMappingURL=add-workflow-versions-instance-id.js.map