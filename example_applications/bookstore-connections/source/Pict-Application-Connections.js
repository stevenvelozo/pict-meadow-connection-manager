/**
 * Pict Application — Bookstore Connections
 *
 * Reference application demonstrating pict-meadow-connection-manager.
 * Registers the MCM provider and all views, then renders the connection
 * list on initialization.
 *
 * @module Pict-Application-Connections
 */

'use strict';

const libPictApplication = require('pict-application');
const libMCM = require('pict-meadow-connection-manager');

class ConnectionsApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// ── Provider ──────────────────────────────────────────────
		let tmpProviderConfig = Object.assign(
			{},
			libMCM.PictProviderConnectionManager.default_configuration,
			{
				TestConnectionEndpoint: '/test-connection',
			});

		this.pict.addProviderSingleton(
			'MeadowConnectionManager',
			tmpProviderConfig,
			libMCM.PictProviderConnectionManager);

		// ── List + Detail views ───────────────────────────────────
		this.pict.addView(
			'MCM-ConnectionList',
			libMCM.PictViewConnectionList.default_configuration,
			libMCM.PictViewConnectionList);

		this.pict.addView(
			'MCM-ConnectionDetail',
			libMCM.PictViewConnectionDetail.default_configuration,
			libMCM.PictViewConnectionDetail);

		// ── Per-type configuration views ──────────────────────────
		this.pict.addView(
			'MCM-ConnectionConfig-MySQL',
			libMCM.PictViewConnectionConfigurationMySQL.default_configuration,
			libMCM.PictViewConnectionConfigurationMySQL);

		this.pict.addView(
			'MCM-ConnectionConfig-PostgreSQL',
			libMCM.PictViewConnectionConfigurationPostgreSQL.default_configuration,
			libMCM.PictViewConnectionConfigurationPostgreSQL);

		this.pict.addView(
			'MCM-ConnectionConfig-MSSQL',
			libMCM.PictViewConnectionConfigurationMSSQL.default_configuration,
			libMCM.PictViewConnectionConfigurationMSSQL);

		this.pict.addView(
			'MCM-ConnectionConfig-SQLite',
			libMCM.PictViewConnectionConfigurationSQLite.default_configuration,
			libMCM.PictViewConnectionConfigurationSQLite);

		this.pict.addView(
			'MCM-ConnectionConfig-Solr',
			libMCM.PictViewConnectionConfigurationSolr.default_configuration,
			libMCM.PictViewConnectionConfigurationSolr);

		this.pict.addView(
			'MCM-ConnectionConfig-RocksDB',
			libMCM.PictViewConnectionConfigurationRocksDB.default_configuration,
			libMCM.PictViewConnectionConfigurationRocksDB);

		this.pict.addView(
			'MCM-ConnectionConfig-MongoDB',
			libMCM.PictViewConnectionConfigurationMongoDB.default_configuration,
			libMCM.PictViewConnectionConfigurationMongoDB);
	}

	onAfterInitializeAsync(fCallback)
	{
		// Render the connection list
		this.pict.views['MCM-ConnectionList'].render();

		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = ConnectionsApplication;
module.exports.default_configuration = require('./Pict-Application-Connections-Configuration.json');
