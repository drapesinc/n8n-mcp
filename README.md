# n8n-MCP (Drapes Fork)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/czlonkowski/n8n-mcp?style=social)](https://github.com/czlonkowski/n8n-mcp)
[![npm version](https://img.shields.io/npm/v/n8n-mcp.svg)](https://www.npmjs.com/package/n8n-mcp)
[![n8n version](https://img.shields.io/badge/n8n-2.11.4-orange.svg)](https://github.com/n8n-io/n8n)

A Model Context Protocol (MCP) server that provides AI assistants with comprehensive access to n8n workflow automation: node documentation, properties, operations, templates, and full workflow management across multiple n8n instances.

**Upstream:** [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)
**This fork:** [drapesinc/n8n-mcp](https://github.com/drapesinc/n8n-mcp)

## What This Fork Adds

This fork extends the upstream n8n-MCP with:

- **Multi-workspace support** -- Manage multiple n8n instances from a single MCP server (e.g., personal, drapes, fourall, mini)
- **Workspace API client** -- Lazy-initialized API clients per workspace with singleton management
- **Reduced dependency footprint** -- Removed unused n8n, n8n-core, and @n8n/n8n-nodes-langchain packages (~500MB reduction), keeping only n8n-workflow for types
- **Community node support** -- Fetcher and documentation generator for community nodes
- **JSON parsing fixes** -- Handle double-encoded JSON from various MCP clients in workflow diff operations

## Features

### Documentation Tools (no API key required)
- **1,084 n8n nodes** indexed -- 537 core + 547 community (301 verified)
- **Node properties** with 99% coverage and detailed schemas
- **Node operations** with 63.6% coverage of available actions
- **Documentation** at 87% coverage from official n8n docs (including AI nodes)
- **265 AI-capable tool variants** detected with full documentation
- **2,646 pre-extracted configurations** from popular templates
- **2,709 workflow templates** with 100% metadata coverage
- **Community nodes** -- search verified community integrations with `source` filter

### Workflow Management Tools (requires API configuration)
- Create, read, update, delete, and list workflows
- Diff-based partial updates (saves 80-90% tokens vs full replacement)
- Workflow validation and auto-fix
- Version history and rollback
- Template deployment directly to n8n instances
- Execution management (trigger, list, get, delete)
- Health check and diagnostics with multi-workspace reporting

## Available MCP Tools

### Core Tools (7 tools)

| Tool | Description |
|------|-------------|
| `tools_documentation` | Get documentation for any MCP tool (start here) |
| `search_nodes` | Full-text search across all nodes. Supports `source: 'community'\|'verified'` and `includeExamples: true` |
| `get_node` | Unified node info: `detail: 'minimal'\|'standard'\|'full'`, `mode: 'docs'\|'search_properties'\|'versions'` |
| `validate_node` | Validate node config: `mode: 'minimal'` (quick) or `mode: 'full'` with profiles (minimal, runtime, ai-friendly, strict) |
| `validate_workflow` | Complete workflow validation including AI Agent workflows |
| `search_templates` | Search templates by keyword, nodes, task, or metadata filters |
| `get_template` | Get complete workflow JSON (modes: nodes_only, structure, full) |

### n8n Management Tools (13 tools -- requires API)

| Tool | Description |
|------|-------------|
| `n8n_create_workflow` | Create new workflows with nodes and connections |
| `n8n_get_workflow` | Retrieve workflows (modes: full, details, structure, minimal) |
| `n8n_update_full_workflow` | Replace entire workflow |
| `n8n_update_partial_workflow` | Diff-based updates (addNode, updateNode, removeNode, addConnection, etc.) |
| `n8n_delete_workflow` | Delete workflows permanently |
| `n8n_list_workflows` | List workflows with filtering and pagination |
| `n8n_validate_workflow` | Validate workflows by ID |
| `n8n_autofix_workflow` | Auto-fix common workflow errors |
| `n8n_workflow_versions` | Version history and rollback |
| `n8n_deploy_template` | Deploy templates from n8n.io with auto-fix |
| `n8n_test_workflow` | Test/trigger execution (auto-detects trigger type) |
| `n8n_executions` | List, get, or delete execution records |
| `n8n_health_check` | Check API connectivity and features |

All management tools accept an optional `workspace` parameter when multi-workspace mode is active.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- Access to one or more n8n instances (for management tools)

### Installation

```bash
git clone git@github.com:drapesinc/n8n-mcp.git
cd n8n-mcp
npm install
npm run build
```

The fork includes a pre-built database (`data/nodes.db`) with all node information. If you need to rebuild it:

```bash
npm run rebuild
```

### Running the Server

```bash
# stdio mode (for Claude Desktop / Claude Code)
npm start

# HTTP mode (for remote deployment / supergateway)
npm run start:http
```

## Configuration

### Multi-Workspace Mode (This Fork)

Configure multiple n8n instances using environment variables with the `N8N_URL_*` and `N8N_TOKEN_*` pattern:

```bash
# Workspace: personal
N8N_URL_PERSONAL=https://n8n.jyoansah.me
N8N_TOKEN_PERSONAL=<api-key>

# Workspace: drapes
N8N_URL_DRAPES=https://n8n.drapesinc.com
N8N_TOKEN_DRAPES=<api-key>

# Workspace: fourall
N8N_URL_FOURALL=https://n8n.fourall.ca
N8N_TOKEN_FOURALL=<api-key>

# Optional: set which workspace is used when none is specified
N8N_DEFAULT_WORKSPACE=personal
```

The server auto-discovers workspaces by scanning environment variables at startup. Workspace names are derived from the suffix (e.g., `N8N_URL_PERSONAL` becomes workspace `personal`).

### Single-Instance Mode (Backward Compatible)

If you only have one n8n instance, use the standard upstream configuration:

```bash
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
```

This creates a single `default` workspace.

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "node",
      "args": ["/path/to/n8n-mcp/dist/mcp/index.js"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true",
        "N8N_URL_PERSONAL": "https://n8n.example.com",
        "N8N_TOKEN_PERSONAL": "your-api-key",
        "N8N_DEFAULT_WORKSPACE": "personal"
      }
    }
  }
}
```

The `MCP_MODE: "stdio"` environment variable is required for Claude Desktop to prevent debug logs from interfering with the JSON-RPC protocol.

### Claude Code Configuration

For Claude Code CLI, add the MCP server config:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/path/to/n8n-mcp/dist/mcp/index.js"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true"
      }
    }
  }
}
```

### Supergateway / SSE Deployment

For remote deployment behind a gateway (e.g., via [supergateway](https://github.com/nicepkg/supergateway)):

```bash
supergateway --port 8007 --stdio "node /path/to/n8n-mcp/dist/mcp/index.js" --logLevel info
```

Environment variables can be set in the Docker compose or shell environment. The server supports HTTP mode with SSE streaming for clients like OpenAI Codex and other MCP-compatible tools.

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_MODE` | Yes (for stdio) | Set to `stdio` for Claude Desktop/Code, `http` for remote |
| `N8N_URL_<NAME>` | For management | n8n instance URL per workspace |
| `N8N_TOKEN_<NAME>` | For management | API key per workspace |
| `N8N_DEFAULT_WORKSPACE` | No | Default workspace when none specified |
| `N8N_API_URL` | Fallback | Single-instance URL (used if no `N8N_URL_*` found) |
| `N8N_API_KEY` | Fallback | Single-instance API key |
| `LOG_LEVEL` | No | Logging level: debug, info, warn, error (default: info) |
| `DISABLE_CONSOLE_OUTPUT` | No | Set `true` to suppress non-JSON output in stdio mode |
| `MCP_PORT` | No | HTTP server port (default: 3000) |
| `MCP_AUTH_TOKEN` | No | Auth token for HTTP mode |
| `SESSION_TIMEOUT_MINUTES` | No | Session timeout (default: 5) |
| `N8N_MCP_MAX_SESSIONS` | No | Max concurrent sessions (default: 100) |
| `WEBHOOK_SECURITY_MODE` | No | Set `moderate` to allow local webhooks |
| `N8N_MCP_TELEMETRY_DISABLED` | No | Set `true` to disable telemetry |
| `SQLJS_SAVE_INTERVAL_MS` | No | sql.js save interval (default: 5000) |

## Architecture

```
src/
├── config/
│   └── workspace-config.ts         # Multi-workspace env var discovery
├── services/
│   ├── workspace-api-client.ts     # Per-workspace API client manager
│   ├── n8n-api-client.ts           # HTTP client for n8n REST API
│   ├── property-filter.ts          # Filters properties to AI-friendly essentials
│   ├── config-validator.ts         # Multi-profile validation system
│   ├── workflow-validator.ts       # Complete workflow structure validation
│   └── expression-validator.ts     # n8n expression syntax validation
├── database/
│   ├── shared-database.ts          # Singleton database manager
│   ├── node-repository.ts          # Data access layer
│   └── database-adapter.ts         # Universal adapter (better-sqlite3 / sql.js)
├── mcp/
│   ├── server.ts                   # MCP server with tool handlers
│   ├── tools.ts                    # Tool definitions
│   ├── tools-documentation.ts      # Tool documentation system
│   └── index.ts                    # Entry point with mode selection
├── templates/
│   ├── template-fetcher.ts         # Fetches from n8n.io API
│   ├── template-repository.ts      # Template database operations
│   └── template-service.ts         # Template business logic
├── parsers/
│   ├── node-parser.ts              # Node metadata extraction
│   └── property-extractor.ts       # Property/operation extraction
├── http-server-single-session.ts   # HTTP/SSE server for remote deployments
└── mcp-engine.ts                   # Clean API for service integration
```

### Key Design Patterns

- **Multi-workspace singleton**: `WorkspaceApiClientManager` lazily creates one API client per workspace
- **Shared database**: All MCP sessions share a single SQLite connection via `SharedDatabase` (fixes memory leak from per-session connections)
- **Repository pattern**: All database operations go through repository classes
- **Validation profiles**: Different strictness levels (minimal, runtime, ai-friendly, strict)
- **Diff-based updates**: Efficient workflow updates using operation diffs instead of full replacement

### Database

The server uses SQLite for node documentation storage:

- **better-sqlite3** (default in Docker) -- native C++ bindings, ~100-120 MB stable
- **sql.js** (fallback) -- pure JavaScript, ~150-200 MB stable, used when better-sqlite3 compilation fails

## Development

```bash
# Build TypeScript
npm run build

# Rebuild node database
npm run rebuild

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Development with auto-reload (HTTP mode)
npm run dev:http

# Update n8n packages
npm run update:n8n:check   # dry run
npm run update:n8n         # apply update

# Fetch latest templates
npm run fetch:templates

# Fetch community nodes
npm run fetch:community
```

## Syncing with Upstream

This fork tracks [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) as `upstream`:

```bash
git fetch upstream
git merge upstream/main
# Resolve any conflicts, then:
npm install && npm run build
```

## License

MIT License -- see [LICENSE](LICENSE) for details.

Original project by [Romuald Czlonkowski](https://www.aiadvisors.pl/en). Fork maintained by [Drapes Digital](https://drapesinc.com).
