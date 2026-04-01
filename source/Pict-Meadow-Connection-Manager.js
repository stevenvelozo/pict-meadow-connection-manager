/**
 * Pict Meadow Connection Manager
 *
 * Browser-safe module for meadow database connection configuration.
 * Provides type definitions, form schemas, validation, and reusable
 * Pict views for connection management UIs.
 *
 * Works in both web (DOM) and console (blessed TUI) environments.
 *
 * No server-side database driver dependencies.
 *
 * @module pict-meadow-connection-manager
 */

'use strict';

const libConnectionTypeRegistry = require('./ConnectionTypeRegistry.js');
const libPictProviderConnectionManager = require('./PictProvider-ConnectionManager.js');

// Views
const libPictViewConnectionList = require('./views/PictView-ConnectionList.js');
const libPictViewConnectionDetail = require('./views/PictView-ConnectionDetail.js');
const libPictViewConnectionConfiguration = require('./views/PictView-ConnectionConfiguration.js');
const libPictViewConnectionConfigurationMySQL = require('./views/PictView-ConnectionConfiguration-MySQL.js');
const libPictViewConnectionConfigurationPostgreSQL = require('./views/PictView-ConnectionConfiguration-PostgreSQL.js');
const libPictViewConnectionConfigurationMSSQL = require('./views/PictView-ConnectionConfiguration-MSSQL.js');
const libPictViewConnectionConfigurationSQLite = require('./views/PictView-ConnectionConfiguration-SQLite.js');
const libPictViewConnectionConfigurationSolr = require('./views/PictView-ConnectionConfiguration-Solr.js');
const libPictViewConnectionConfigurationRocksDB = require('./views/PictView-ConnectionConfiguration-RocksDB.js');
const libPictViewConnectionConfigurationMongoDB = require('./views/PictView-ConnectionConfiguration-MongoDB.js');

module.exports =
{
	// Type registry (static data, no service instantiation needed)
	ConnectionTypeRegistry: libConnectionTypeRegistry,

	// Pict provider for managing connection state
	PictProviderConnectionManager: libPictProviderConnectionManager,

	// Views
	PictViewConnectionList: libPictViewConnectionList,
	PictViewConnectionDetail: libPictViewConnectionDetail,

	// Base configuration view (for extension)
	PictViewConnectionConfiguration: libPictViewConnectionConfiguration,

	// Per-type configuration views
	PictViewConnectionConfigurationMySQL: libPictViewConnectionConfigurationMySQL,
	PictViewConnectionConfigurationPostgreSQL: libPictViewConnectionConfigurationPostgreSQL,
	PictViewConnectionConfigurationMSSQL: libPictViewConnectionConfigurationMSSQL,
	PictViewConnectionConfigurationSQLite: libPictViewConnectionConfigurationSQLite,
	PictViewConnectionConfigurationSolr: libPictViewConnectionConfigurationSolr,
	PictViewConnectionConfigurationRocksDB: libPictViewConnectionConfigurationRocksDB,
	PictViewConnectionConfigurationMongoDB: libPictViewConnectionConfigurationMongoDB,
};
