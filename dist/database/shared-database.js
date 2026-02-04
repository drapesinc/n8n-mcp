"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedDatabase = getSharedDatabase;
exports.releaseSharedDatabase = releaseSharedDatabase;
exports.closeSharedDatabase = closeSharedDatabase;
exports.isSharedDatabaseInitialized = isSharedDatabaseInitialized;
exports.getSharedDatabaseRefCount = getSharedDatabaseRefCount;
const database_adapter_1 = require("./database-adapter");
const node_repository_1 = require("./node-repository");
const template_service_1 = require("../templates/template-service");
const enhanced_config_validator_1 = require("../services/enhanced-config-validator");
const logger_1 = require("../utils/logger");
let sharedState = null;
let initializationPromise = null;
async function getSharedDatabase(dbPath) {
    if (sharedState && sharedState.initialized && sharedState.dbPath === dbPath) {
        sharedState.refCount++;
        logger_1.logger.debug('Reusing shared database connection', {
            refCount: sharedState.refCount,
            dbPath
        });
        return sharedState;
    }
    if (sharedState && sharedState.initialized && sharedState.dbPath !== dbPath) {
        logger_1.logger.error('Attempted to initialize shared database with different path', {
            existingPath: sharedState.dbPath,
            requestedPath: dbPath
        });
        throw new Error(`Shared database already initialized with different path: ${sharedState.dbPath}`);
    }
    if (initializationPromise) {
        try {
            const state = await initializationPromise;
            state.refCount++;
            logger_1.logger.debug('Reusing shared database (waited for init)', {
                refCount: state.refCount,
                dbPath
            });
            return state;
        }
        catch (error) {
            initializationPromise = null;
            throw error;
        }
    }
    initializationPromise = initializeSharedDatabase(dbPath);
    try {
        const state = await initializationPromise;
        initializationPromise = null;
        return state;
    }
    catch (error) {
        initializationPromise = null;
        throw error;
    }
}
async function initializeSharedDatabase(dbPath) {
    logger_1.logger.info('Initializing shared database connection', { dbPath });
    const db = await (0, database_adapter_1.createDatabaseAdapter)(dbPath);
    const repository = new node_repository_1.NodeRepository(db);
    const templateService = new template_service_1.TemplateService(db);
    enhanced_config_validator_1.EnhancedConfigValidator.initializeSimilarityServices(repository);
    sharedState = {
        db,
        repository,
        templateService,
        dbPath,
        refCount: 1,
        initialized: true
    };
    logger_1.logger.info('Shared database initialized successfully', {
        dbPath,
        refCount: sharedState.refCount
    });
    return sharedState;
}
function releaseSharedDatabase(state) {
    if (!state || !sharedState) {
        return;
    }
    if (sharedState.refCount <= 0) {
        logger_1.logger.warn('Attempted to release shared database with refCount already at or below 0', {
            refCount: sharedState.refCount
        });
        return;
    }
    sharedState.refCount--;
    logger_1.logger.debug('Released shared database reference', {
        refCount: sharedState.refCount
    });
}
async function closeSharedDatabase() {
    if (!sharedState) {
        return;
    }
    logger_1.logger.info('Closing shared database connection', {
        refCount: sharedState.refCount
    });
    try {
        sharedState.db.close();
    }
    catch (error) {
        logger_1.logger.warn('Error closing shared database', {
            error: error instanceof Error ? error.message : String(error)
        });
    }
    sharedState = null;
    initializationPromise = null;
}
function isSharedDatabaseInitialized() {
    return sharedState !== null && sharedState.initialized;
}
function getSharedDatabaseRefCount() {
    return sharedState?.refCount ?? 0;
}
//# sourceMappingURL=shared-database.js.map