import { ToolDocumentation } from '../types';

export const n8nActivateWorkflowDoc: ToolDocumentation = {
  name: 'n8n_activate_workflow',
  category: 'workflow_management',
  essentials: {
    description: 'Activate or deactivate a workflow. Activating enables trigger nodes; deactivating stops them.',
    keyParameters: ['id', 'active'],
    example: 'n8n_activate_workflow({id: "workflow_123", active: true})',
    performance: 'Fast (50-150ms)',
    tips: [
      'Use active=true to activate, active=false to deactivate',
      'Activating a workflow enables its trigger nodes (webhook, schedule, etc.)',
      'Deactivating stops all triggers but preserves the workflow',
      'Check workflow first with n8n_get_workflow({mode: "minimal"}) to see current status'
    ]
  },
  full: {
    description: 'Activates or deactivates a workflow on the n8n instance. When activated, trigger nodes (webhooks, schedules, polling triggers) begin listening for events. When deactivated, all triggers stop but the workflow definition is preserved. This is a safe, reversible operation.',
    parameters: {
      id: { type: 'string', required: true, description: 'Workflow ID to activate or deactivate' },
      active: { type: 'boolean', required: true, description: 'true to activate the workflow, false to deactivate it' }
    },
    returns: 'Object with id, name, and active status confirming the change.',
    examples: [
      'n8n_activate_workflow({id: "abc123", active: true}) - Activate a workflow',
      'n8n_activate_workflow({id: "abc123", active: false}) - Deactivate a workflow'
    ],
    useCases: [
      'Enable a workflow after creation or configuration',
      'Temporarily disable a workflow for maintenance',
      'Toggle workflows on/off as part of deployment',
      'Deactivate a misbehaving workflow',
      'Re-enable a workflow after fixing issues'
    ],
    performance: 'Fast operation - typically 50-150ms. The n8n instance registers or unregisters trigger nodes as part of this call.',
    bestPractices: [
      'Validate workflow before activating with n8n_validate_workflow',
      'Check current status with n8n_get_workflow({mode: "minimal"}) first',
      'Deactivate instead of deleting when you may need the workflow later',
      'After creating a workflow with n8n_create_workflow, activate it with this tool'
    ],
    pitfalls: [
      'Requires N8N_API_URL and N8N_API_KEY configured',
      'Activating a workflow with invalid trigger configuration may fail',
      'Activating a workflow with missing credentials will fail',
      'Idempotent: activating an already-active workflow succeeds without error'
    ],
    relatedTools: ['n8n_create_workflow', 'n8n_get_workflow', 'n8n_list_workflows', 'n8n_validate_workflow', 'n8n_delete_workflow']
  }
};
