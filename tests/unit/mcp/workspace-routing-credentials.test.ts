import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Every n8n management tool must route by its `workspace` argument. The
// upstream sync of 2026-11-21 left n8n_manage_credentials (and 39 other
// handler calls) on this.instanceContext, which is empty in stdio
// multi-workspace mode, so they answered "n8n API not configured".
const handlerMocks = vi.hoisted(() => ({
  handleListCredentials: vi.fn().mockResolvedValue({ success: true, data: [] }),
  handleListFolders: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('../../../src/mcp/handlers-n8n-manager', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, ...handlerMocks };
});
vi.mock('../../../src/database/database-adapter');
vi.mock('../../../src/database/node-repository');
vi.mock('../../../src/templates/template-service');
vi.mock('../../../src/utils/logger');

describe('workspace argument routing for management tools', () => {
  const env = {
    N8N_URL_ALPHA: 'https://alpha.example.invalid',
    N8N_TOKEN_ALPHA: 'alpha-key',
    N8N_URL_BETA: 'https://beta.example.invalid',
    N8N_TOKEN_BETA: 'beta-key',
  };
  let server: any;

  beforeEach(async () => {
    vi.resetModules();
    Object.assign(process.env, env, { NODE_DB_PATH: ':memory:' });
    delete process.env.N8N_API_URL;
    delete process.env.N8N_API_KEY;
    const { N8NDocumentationMCPServer } = await import('../../../src/mcp/server');
    server = new N8NDocumentationMCPServer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const k of [...Object.keys(env), 'NODE_DB_PATH']) delete process.env[k];
  });

  it('passes the named workspace to the credentials handler', async () => {
    await server.executeTool('n8n_manage_credentials', { action: 'list', workspace: 'beta' });
    expect(handlerMocks.handleListCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'beta' }),
      expect.objectContaining({ n8nApiUrl: 'https://beta.example.invalid' })
    );
  });

  it('passes the named workspace to the folders handler', async () => {
    await server.executeTool('n8n_manage_folders', { action: 'list', workspace: 'alpha' });
    expect(handlerMocks.handleListFolders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ n8nApiUrl: 'https://alpha.example.invalid' })
    );
  });
});
