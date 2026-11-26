import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Every n8n management tool must route by its `workspace` argument. The
// upstream sync of 2026-11-21 left n8n_manage_credentials (and 39 other
// handler calls) on this.instanceContext, which is empty in stdio
// multi-workspace mode, so they answered "n8n API not configured".
const handlerMocks = vi.hoisted(() => ({
  handleListCredentials: vi.fn().mockResolvedValue({ success: true, data: [] }),
  handleListFolders: vi.fn().mockResolvedValue({ success: true, data: [] }),
  handleManageAgents: vi.fn().mockResolvedValue({ success: true, data: [] }),
  handleListCatalog: vi.fn().mockResolvedValue({ success: true, data: [] }),
  handleExploreNodeResources: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('../../../src/mcp/handlers-n8n-manager', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    handleListCredentials: handlerMocks.handleListCredentials,
    handleListFolders: handlerMocks.handleListFolders,
  };
});
vi.mock('../../../src/mcp/handlers-agents', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, handleManageAgents: handlerMocks.handleManageAgents };
});
vi.mock('../../../src/mcp/handlers-official-tools', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    handleListCatalog: handlerMocks.handleListCatalog,
    handleExploreNodeResources: handlerMocks.handleExploreNodeResources,
  };
});
vi.mock('../../../src/database/database-adapter');
vi.mock('../../../src/database/node-repository');
vi.mock('../../../src/templates/template-service');
vi.mock('../../../src/utils/logger');

// Every env var these tests read or that .env.test may set. Each test starts
// from all of them unset and vi.unstubAllEnvs() restores the originals.
const ROUTING_ENV = [
  'N8N_API_URL', 'N8N_API_KEY', 'N8N_MCP_ACCESS_TOKEN', 'N8N_DEFAULT_WORKSPACE', 'ENABLE_MULTI_TENANT',
  'N8N_URL_ALPHA', 'N8N_TOKEN_ALPHA', 'N8N_MCP_TOKEN_ALPHA',
  'N8N_URL_BETA', 'N8N_TOKEN_BETA', 'N8N_MCP_TOKEN_BETA',
];

async function makeServer(env: Record<string, string>, instanceContext?: any) {
  for (const k of ROUTING_ENV) vi.stubEnv(k, undefined as unknown as string);
  vi.stubEnv('NODE_DB_PATH', ':memory:');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  const { N8NDocumentationMCPServer } = await import('../../../src/mcp/server');
  const server: any = new N8NDocumentationMCPServer(instanceContext);
  vi.clearAllMocks();
  return server;
}

const TWO_WORKSPACES = {
  N8N_URL_ALPHA: 'https://alpha.example.invalid',
  N8N_TOKEN_ALPHA: 'alpha-key',
  N8N_URL_BETA: 'https://beta.example.invalid',
  N8N_TOKEN_BETA: 'beta-key',
  N8N_MCP_TOKEN_BETA: 'beta-mcp-token',
  N8N_DEFAULT_WORKSPACE: 'alpha',
};

describe('workspace argument routing for management tools', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('stdio, two workspaces', () => {
    let server: any;
    beforeEach(async () => {
      server = await makeServer(TWO_WORKSPACES);
    });

    it('passes the named workspace to the credentials handler', async () => {
      await server.executeTool('n8n_manage_credentials', { action: 'list', workspace: 'beta' });
      const [, ctx] = handlerMocks.handleListCredentials.mock.calls[0];
      expect(ctx).toMatchObject({ n8nApiUrl: 'https://beta.example.invalid', n8nApiKey: 'beta-key' });
    });

    it('passes the named workspace to the folders handler', async () => {
      await server.executeTool('n8n_manage_folders', { action: 'list', workspace: 'alpha' });
      const [, ctx] = handlerMocks.handleListFolders.mock.calls[0];
      expect(ctx).toMatchObject({ n8nApiUrl: 'https://alpha.example.invalid', n8nApiKey: 'alpha-key' });
    });

    it('uses the default workspace when none is named', async () => {
      await server.executeTool('n8n_manage_credentials', { action: 'list' });
      const [, ctx] = handlerMocks.handleListCredentials.mock.calls[0];
      expect(ctx).toMatchObject({ n8nApiUrl: 'https://alpha.example.invalid' });
    });

    it('carries the workspace MCP token for official-MCP tools', async () => {
      await server.executeTool('n8n_manage_agents', { action: 'list', workspace: 'beta' });
      const [, ctx] = handlerMocks.handleManageAgents.mock.calls[0];
      expect(ctx).toMatchObject({ n8nApiUrl: 'https://beta.example.invalid', n8nMcpAccessToken: 'beta-mcp-token' });
    });

    it('drops the workspace key before strict-schema handlers', async () => {
      await server.executeTool('n8n_manage_agents', { action: 'list', workspace: 'beta' });
      await server.executeTool('n8n_list_catalog', { kind: 'projects', workspace: 'beta' });
      await server.executeTool('n8n_explore_node_resources', { workspace: 'beta' });
      expect(handlerMocks.handleManageAgents.mock.calls[0][0]).toEqual({ action: 'list' });
      expect(handlerMocks.handleListCatalog.mock.calls[0][0]).toEqual({ kind: 'projects' });
      expect(handlerMocks.handleExploreNodeResources.mock.calls[0][0]).toEqual({});
    });

    it('rejects an unknown workspace', async () => {
      await expect(
        server.executeTool('n8n_manage_credentials', { action: 'list', workspace: 'nope' })
      ).rejects.toThrow(/nope/);
      expect(handlerMocks.handleListCredentials).not.toHaveBeenCalled();
    });
  });

  it('single-instance mode passes N8N_MCP_ACCESS_TOKEN to official-MCP tools', async () => {
    const server = await makeServer({
      N8N_API_URL: 'https://single.example.invalid',
      N8N_API_KEY: 'single-key',
      N8N_MCP_ACCESS_TOKEN: 'single-mcp-token',
    });
    await server.executeTool('n8n_manage_agents', { action: 'list' });
    const [, ctx] = handlerMocks.handleManageAgents.mock.calls[0];
    expect(ctx).toMatchObject({ n8nApiUrl: 'https://single.example.invalid', n8nMcpAccessToken: 'single-mcp-token' });
  });

  it('an injected context with url and MCP token wins over env workspaces', async () => {
    const injected = { n8nApiUrl: 'https://tenant.example.invalid', n8nMcpAccessToken: 'tenant-mcp-token' };
    const server = await makeServer(TWO_WORKSPACES, injected);
    await server.executeTool('n8n_list_catalog', { kind: 'projects' });
    const [, ctx] = handlerMocks.handleListCatalog.mock.calls[0];
    expect(ctx).toMatchObject(injected);
  });

  it('multi-tenant mode never routes a tenant to an env workspace', async () => {
    const tenant = { n8nApiUrl: 'https://tenant.example.invalid', n8nApiKey: 'tenant-key' };
    const server = await makeServer({ ...TWO_WORKSPACES, ENABLE_MULTI_TENANT: 'true' }, tenant);

    await server.executeTool('n8n_manage_credentials', { action: 'list', workspace: 'alpha' });
    expect(handlerMocks.handleListCredentials.mock.calls[0][1]).toMatchObject(tenant);

    const bare = await makeServer({ ...TWO_WORKSPACES, ENABLE_MULTI_TENANT: 'true' });
    await bare.executeTool('n8n_manage_credentials', { action: 'list' });
    expect(handlerMocks.handleListCredentials.mock.calls[0][1]).toBeUndefined();
  });
});
