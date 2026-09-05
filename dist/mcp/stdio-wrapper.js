#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
{
    const { handleTelemetryCliIfPresent } = require('../telemetry/telemetry-cli');
    handleTelemetryCliIfPresent(process.argv.slice(2));
}
process.env.MCP_MODE = 'stdio';
process.env.DISABLE_CONSOLE_OUTPUT = 'true';
process.env.LOG_LEVEL = 'error';
const { installStdioGuard } = require('../utils/stdio-guard');
const originalConsoleError = installStdioGuard({ silenceConsole: true }).error;
const { N8NDocumentationMCPServer } = require('./server');
let server = null;
async function main() {
    try {
        server = new N8NDocumentationMCPServer();
        await server.run();
    }
    catch (error) {
        originalConsoleError('Fatal error:', error);
        process.exit(1);
    }
}
process.on('uncaughtException', (error) => {
    originalConsoleError('Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    originalConsoleError('Unhandled rejection:', reason);
    process.exit(1);
});
let isShuttingDown = false;
async function shutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    originalConsoleError(`Received ${signal}, shutting down gracefully...`);
    try {
        if (server) {
            await server.shutdown();
        }
    }
    catch (error) {
        originalConsoleError('Error during shutdown:', error);
    }
    const { tearDownStdin } = require('../utils/stdin-teardown');
    tearDownStdin();
    setTimeout(() => {
        process.exit(0);
    }, 500).unref();
    process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGHUP', () => void shutdown('SIGHUP'));
process.stdin.on('end', () => {
    originalConsoleError('stdin closed, shutting down...');
    void shutdown('STDIN_CLOSE');
});
main();
//# sourceMappingURL=stdio-wrapper.js.map