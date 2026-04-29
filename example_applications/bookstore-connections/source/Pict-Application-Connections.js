/**
 * Pict Application — Bookstore Connections
 *
 * Reference application demonstrating pict-meadow-connection-manager
 * with the merged architecture: this module owns the list/detail
 * shell, and `pict-section-connection-form` (re-exported via
 * `libMCM.PictSectionConnectionForm`) renders the per-provider field
 * block.
 *
 * In a real deployment, the schemas would arrive from a server
 * endpoint backed by `meadow-connection-manager.getAllProviderFormSchemas()`
 * (see retold-databeacon, retold-facto, retold-data-service).  Here
 * we hardcode a small fixture so the example runs without a backing
 * server.
 *
 * @module Pict-Application-Connections
 */

'use strict';

const libPictApplication = require('pict-application');
const libMCM = require('pict-meadow-connection-manager');

// ─────────────────────────────────────────────────────────────────
//  Hardcoded schemas — same shape that
//  meadow-connection-manager.getAllProviderFormSchemas() emits at
//  runtime, so the demo exercises the production contract.
// ─────────────────────────────────────────────────────────────────
const DEMO_SCHEMAS =
[
	{
		Provider:    'SQLite',
		DisplayName: 'SQLite',
		Fields:
		[
			{ Name: 'SQLiteFilePath', Label: 'Database File Path', Type: 'Path', Default: './data/database.db', Required: true, Placeholder: '/path/to/database.db' }
		]
	},
	{
		Provider:    'MySQL',
		DisplayName: 'MySQL',
		Fields:
		[
			{ Name: 'host',            Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true },
			{ Name: 'port',            Label: 'Port',             Type: 'Number',   Default: 3306,        Required: true },
			{ Name: 'user',            Label: 'User',             Type: 'String',   Default: 'root',      Required: true },
			{ Name: 'password',        Label: 'Password',         Type: 'Password' },
			{ Name: 'database',        Label: 'Database',         Type: 'String',   Default: 'meadow',    Required: true },
			{ Name: 'connectionLimit', Label: 'Connection Limit', Type: 'Number',   Default: 20,          Group: 'Advanced' }
		]
	},
	{
		Provider:    'PostgreSQL',
		DisplayName: 'PostgreSQL',
		Fields:
		[
			{ Name: 'host',     Label: 'Server',   Type: 'String',   Default: '127.0.0.1', Required: true },
			{ Name: 'port',     Label: 'Port',     Type: 'Number',   Default: 5432,        Required: true },
			{ Name: 'user',     Label: 'User',     Type: 'String',   Default: 'postgres',  Required: true },
			{ Name: 'password', Label: 'Password', Type: 'Password' },
			{ Name: 'database', Label: 'Database', Type: 'String',   Default: 'meadow',    Required: true }
		]
	}
];

class ConnectionsApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// ── Provider ──────────────────────────────────────────────
		let tmpProviderConfig = Object.assign({},
			libMCM.PictProviderConnectionManager.default_configuration,
			{
				TestConnectionEndpoint: '/test-connection'
			});
		this.pict.addProviderSingleton('MeadowConnectionManager',
			tmpProviderConfig,
			libMCM.PictProviderConnectionManager);

		// ── Manager-shell views ───────────────────────────────────
		this.pict.addView('MCM-ConnectionList',
			libMCM.PictViewConnectionList.default_configuration,
			libMCM.PictViewConnectionList);
		this.pict.addView('MCM-ConnectionDetail',
			libMCM.PictViewConnectionDetail.default_configuration,
			libMCM.PictViewConnectionDetail);

		// ── Shared schema-driven form view ────────────────────────
		// One config view replaces the previous 7 per-type subclasses.
		// It renders into the `<section id="MCM-ConnectionConfig-Container">`
		// slot owned by PictView-ConnectionDetail.
		this.pict.addView('PictSection-ConnectionForm',
			Object.assign({}, libMCM.PictSectionConnectionForm.default_configuration,
				{
					ContainerSelector:         '#MCM-ConnectionConfig-Container',
					DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
					SchemasAddress:            'AppData.MCM.Schemas',
					ActiveAddress:             'AppData.MCM.CurrentConnection.Type',
					FieldIDPrefix:             'mcm-conn',
					ShowProviderSelect:        false       // detail view owns the type <select>
				}), libMCM.PictSectionConnectionForm);
	}

	onAfterInitializeAsync(fCallback)
	{
		// Inject the schemas.  In production this would come from a
		// `GET /<app>/connection/schemas` endpoint backed by MCM.
		this.pict.providers.MeadowConnectionManager.setSchemas(DEMO_SCHEMAS);

		// Render the connection list.
		this.pict.views['MCM-ConnectionList'].render();

		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = ConnectionsApplication;
module.exports.default_configuration = require('./Pict-Application-Connections-Configuration.json');
