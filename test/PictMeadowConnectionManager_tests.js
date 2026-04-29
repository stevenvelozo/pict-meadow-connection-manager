/**
 * Tests for pict-meadow-connection-manager (merged 1.1.0).
 *
 * Three layers exercised:
 *   1. Module exports — provider + list/detail views + the
 *      pict-section-connection-form re-export.
 *   2. Provider state + CRUD without a real Pict instance (uses a
 *      minimal fable shim).  Covers connection list lifecycle,
 *      selection, save, schema injection, and the schema-driven
 *      validateConfig/maskConfig/buildDefaultConfig helpers that
 *      replaced the old inline ConnectionTypeRegistry.
 *   3. Detail + List views inside a real Pict + jsdom — verifies the
 *      detail editor renders, the type selector populates from the
 *      injected schemas, and that the shared form view picks up the
 *      schemas via the provider's setSchemas() handoff.
 *
 * @license MIT
 * @author <steven@velozo.com>
 */
'use strict';

// Inline jsdom shim — replaces `browser-env` which dragged in a
// deprecated `request` chain (and with it tough-cookie / form-data /
// uuid / qs CVE noise from `npm audit`).  Direct jsdom@25 has none
// of those transitives.  We expose only the globals our tests touch
// (window, document) and skip `navigator`/`HTMLElement` because Node 22+
// already defines them as non-writable globals.
const { JSDOM } = require('jsdom');
const _DOM = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
global.window = _DOM.window;
global.document = _DOM.window.document;

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libMCM = require('../source/Pict-Meadow-Connection-Manager.js');

// ─────────────────────────────────────────────────────────────────────
//  Test helpers
// ─────────────────────────────────────────────────────────────────────

const MYSQL_SCHEMA =
{
	Provider:    'MySQL',
	DisplayName: 'MySQL',
	Fields:
	[
		{ Name: 'host',     Label: 'Server',   Type: 'String',   Default: '127.0.0.1', Required: true },
		{ Name: 'port',     Label: 'Port',     Type: 'Number',   Default: 3306,        Required: true },
		{ Name: 'user',     Label: 'User',     Type: 'String',   Default: 'root',      Required: true },
		{ Name: 'password', Label: 'Password', Type: 'Password' },
		{ Name: 'database', Label: 'Database', Type: 'String',   Default: 'meadow',    Required: true }
	]
};

const SQLITE_SCHEMA =
{
	Provider:    'SQLite',
	DisplayName: 'SQLite',
	Fields:
	[
		{ Name: 'SQLiteFilePath', Label: 'Database File Path', Type: 'Path', Default: ':memory:', Required: true }
	]
};

const MSSQL_SCHEMA =
{
	Provider:    'MSSQL',
	DisplayName: 'MSSQL',
	Fields:
	[
		{ Name: 'server',           Label: 'Server',           Type: 'String',   Default: '127.0.0.1', Required: true },
		{ Name: 'port',             Label: 'Port',             Type: 'Number',   Default: 1433 },
		{ Name: 'password',         Label: 'Password',         Type: 'Password' },
		{ Name: 'RequestTimeoutMs', Label: 'Request timeout (sec)', Type: 'Number', Default: 120, Multiplier: 1000 }
	]
};

/** Minimal fable shim — sufficient for provider state tests without Pict. */
function makeShimFable()
{
	return {
		isFable: true,
		AppData: {},
		settings: {},
		services: {},
		servicesMap: {},
		serviceClasses: {},
		log:     { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {} },
		Logging: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {} },
		getUUID: () => 'uuid-' + Math.random().toString(36).substring(2),
		serviceManager:
		{
			addServiceType: () => {},
			instantiateServiceProvider: () => {},
			instantiateServiceProviderWithoutRegistration: () => ({ connectAsync: (cb) => cb(null) })
		},
		addServiceType: () => {}
	};
}

function makeProvider(pOptions)
{
	let tmpFable = makeShimFable();
	let tmpProvider = new libMCM.PictProviderConnectionManager(tmpFable, pOptions || {}, 'mcm-test');
	tmpProvider.onInitialize();
	return { fable: tmpFable, provider: tmpProvider };
}

/** Mount a real Pict + the manager-shell views + the shared form. */
function mountFullStack()
{
	document.body.innerHTML = [
		'<div id="MCM-ConnectionList-Container"></div>',
		'<div id="MCM-ConnectionDetail-Container"></div>'
	].join('');

	let tmpPict = new libPict({ LogStreams: [{ loggertype: 'console', streamtype: 'console', level: 'error' }] });

	tmpPict.addProviderSingleton('MeadowConnectionManager',
		libMCM.PictProviderConnectionManager.default_configuration,
		libMCM.PictProviderConnectionManager);

	tmpPict.addView('MCM-ConnectionList',
		libMCM.PictViewConnectionList.default_configuration,
		libMCM.PictViewConnectionList);
	tmpPict.addView('MCM-ConnectionDetail',
		libMCM.PictViewConnectionDetail.default_configuration,
		libMCM.PictViewConnectionDetail);

	// Shared form view — renders into the slot the detail view exposes.
	let tmpFormCfg = Object.assign({}, libMCM.PictSectionConnectionForm.default_configuration,
		{
			ContainerSelector:         '#MCM-ConnectionConfig-Container',
			DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
			SchemasAddress:            'AppData.MCM.Schemas',
			ActiveAddress:             'AppData.MCM.CurrentConnection.Type',
			FieldIDPrefix:             'mcm-conn',
			ShowProviderSelect:        false
		});
	tmpPict.addView('PictSection-ConnectionForm', tmpFormCfg, libMCM.PictSectionConnectionForm);

	return {
		pict:     tmpPict,
		provider: tmpPict.providers.MeadowConnectionManager,
		listView: tmpPict.views['MCM-ConnectionList'],
		detail:   tmpPict.views['MCM-ConnectionDetail'],
		form:     tmpPict.views['PictSection-ConnectionForm']
	};
}

// ─────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────

suite('pict-meadow-connection-manager (1.1.0 merged)', () =>
{
	suite('Module exports', () =>
	{
		test('exports the manager-shell trio + a re-export of the shared form', () =>
		{
			Expect(typeof(libMCM.PictProviderConnectionManager)).to.equal('function');
			Expect(typeof(libMCM.PictViewConnectionList)).to.equal('function');
			Expect(typeof(libMCM.PictViewConnectionDetail)).to.equal('function');
			Expect(typeof(libMCM.PictSectionConnectionForm)).to.equal('function');
			Expect(libMCM.PictSectionConnectionForm.default_configuration).to.be.an('object');
		});

		test('does NOT expose the deprecated ConnectionTypeRegistry / per-type config views', () =>
		{
			// These were removed in the merge.  Hosts that still try to
			// register them will get undefined — better to fail loudly.
			Expect(libMCM.ConnectionTypeRegistry).to.be.undefined;
			Expect(libMCM.PictViewConnectionConfiguration).to.be.undefined;
			Expect(libMCM.PictViewConnectionConfigurationMySQL).to.be.undefined;
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  Provider — state + schemas + CRUD (no DOM)
	// ─────────────────────────────────────────────────────────────

	suite('Provider: schema injection', () =>
	{
		test('setSchemas mirrors into AppData.<addr>.Schemas + ConnectionTypes', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);

			Expect(fable.AppData.MCM.Schemas).to.have.length(2);
			Expect(fable.AppData.MCM.ConnectionTypes).to.deep.equal(
				[
					{ TypeName: 'SQLite', DisplayName: 'SQLite' },
					{ TypeName: 'MySQL',  DisplayName: 'MySQL' }
				]);
		});

		test('setSchemas defaults CurrentConnection.Type to the first schema', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA ]);
			Expect(fable.AppData.MCM.CurrentConnection.Type).to.equal('SQLite');
			// And seeds the default config for that type.
			Expect(fable.AppData.MCM.CurrentConnection.Config.SQLiteFilePath).to.equal(':memory:');
		});

		test('honors a host-supplied AppDataAddress', () =>
		{
			let { fable, provider } = makeProvider({ AppDataAddress: 'MyApp' });
			provider.setSchemas([ SQLITE_SCHEMA ]);
			Expect(fable.AppData.MyApp).to.exist;
			Expect(fable.AppData.MyApp.Schemas).to.have.length(1);
			Expect(fable.AppData.MCM).to.be.undefined;
		});

		test('getAvailableTypes returns the provider id of every schema', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA, MSSQL_SCHEMA ]);
			Expect(provider.getAvailableTypes()).to.deep.equal([ 'SQLite', 'MySQL', 'MSSQL' ]);
		});

		test('getSchema returns null for an unknown provider', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ SQLITE_SCHEMA ]);
			Expect(provider.getSchema('NotARealProvider')).to.equal(null);
		});
	});

	suite('Provider: schema-driven helpers (replaces ConnectionTypeRegistry)', () =>
	{
		test('buildDefaultConfig walks Fields and returns a fully-defaulted blob', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpDefault = provider.buildDefaultConfig('MySQL');
			Expect(tmpDefault).to.deep.equal(
				{
					host:     '127.0.0.1',
					port:     3306,
					user:     'root',
					database: 'meadow'
				});
			// password has no Default → not in the blob.
			Expect(tmpDefault).to.not.have.property('password');
		});

		test('buildDefaultConfig applies Multiplier to Number fields', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MSSQL_SCHEMA ]);
			let tmpDefault = provider.buildDefaultConfig('MSSQL');
			// 120 sec * 1000 → 120000 ms in the stored blob.
			Expect(tmpDefault.RequestTimeoutMs).to.equal(120000);
		});

		test('validateConfig flags missing Required fields by Label', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpResult = provider.validateConfig('MySQL', { host: '', port: 3306, user: '', database: '' });
			Expect(tmpResult.valid).to.equal(false);
			Expect(tmpResult.errors).to.include('Server is required');
			Expect(tmpResult.errors).to.include('User is required');
			Expect(tmpResult.errors).to.include('Database is required');
		});

		test('validateConfig is happy when all required fields are present', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpResult = provider.validateConfig('MySQL', { host: '10.0.0.5', port: 3306, user: 'admin', database: 'analytics' });
			Expect(tmpResult.valid).to.equal(true);
			Expect(tmpResult.errors).to.have.length(0);
		});

		test('validateConfig returns a clear error for an unknown type', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpResult = provider.validateConfig('NotAReal', { host: 'x' });
			Expect(tmpResult.valid).to.equal(false);
			Expect(tmpResult.errors[0]).to.contain('Unknown connection type');
		});

		test('maskConfig replaces Password fields with *** and leaves others intact', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpMasked = provider.maskConfig('MySQL', { host: '10.0.0.5', user: 'admin', password: 'hunter2' });
			Expect(tmpMasked.host).to.equal('10.0.0.5');
			Expect(tmpMasked.user).to.equal('admin');
			Expect(tmpMasked.password).to.equal('***');
		});

		test('maskConfig leaves empty passwords alone (nothing to mask)', () =>
		{
			let { provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpMasked = provider.maskConfig('MySQL', { host: 'x', password: '' });
			Expect(tmpMasked.password).to.equal('');
		});
	});

	suite('Provider: CRUD lifecycle', () =>
	{
		test('addConnection appends and selects', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			let tmpIndex = provider.addConnection({ Name: 'warehouse', Type: 'MySQL', Config: { host: 'wh.example' }, Status: 'new' });
			Expect(tmpIndex).to.equal(0);
			Expect(fable.AppData.MCM.Connections).to.have.length(1);
			Expect(fable.AppData.MCM.SelectedIndex).to.equal(0);
			Expect(fable.AppData.MCM.CurrentConnection.Name).to.equal('warehouse');
		});

		test('addConnection without args seeds defaults from the first schema', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA, SQLITE_SCHEMA ]);
			provider.addConnection();
			Expect(fable.AppData.MCM.Connections[0].Type).to.equal('MySQL');
			Expect(fable.AppData.MCM.Connections[0].Config.host).to.equal('127.0.0.1');
		});

		test('removeConnection adjusts selection bookkeeping', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'a', Type: 'MySQL', Config: {} });
			provider.addConnection({ Name: 'b', Type: 'MySQL', Config: {} });
			provider.addConnection({ Name: 'c', Type: 'MySQL', Config: {} });
			provider.selectConnection(2);

			provider.removeConnection(0);
			Expect(fable.AppData.MCM.Connections.map((c) => c.Name)).to.deep.equal([ 'b', 'c' ]);
			Expect(fable.AppData.MCM.SelectedIndex).to.equal(1);  // shifted from 2

			provider.removeConnection(1);
			// Removed the selected item — selection clears.
			Expect(fable.AppData.MCM.SelectedIndex).to.equal(-1);
		});

		test('selectConnection deep-copies into CurrentConnection (edit isolation)', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'orig', Type: 'MySQL', Config: { host: 'a' }, Status: 'new' });
			provider.selectConnection(0);

			fable.AppData.MCM.CurrentConnection.Config.host = 'edited';
			Expect(fable.AppData.MCM.Connections[0].Config.host).to.equal('a');  // not mutated yet
		});

		test('saveCurrentConnection writes back to the selected row', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'orig', Type: 'MySQL', Config: { host: 'a' }, Status: 'new' });
			provider.selectConnection(0);

			fable.AppData.MCM.CurrentConnection.Config.host = 'edited';
			provider.saveCurrentConnection();
			Expect(fable.AppData.MCM.Connections[0].Config.host).to.equal('edited');
		});

		test('setConnections replaces the whole list and clears selection', () =>
		{
			let { fable, provider } = makeProvider();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'a', Type: 'MySQL', Config: {} });
			provider.selectConnection(0);

			provider.setConnections([ { Name: 'x', Type: 'MySQL', Config: {} } ]);
			Expect(fable.AppData.MCM.Connections).to.have.length(1);
			Expect(fable.AppData.MCM.Connections[0].Name).to.equal('x');
			Expect(fable.AppData.MCM.SelectedIndex).to.equal(-1);
		});
	});

	suite('Provider: testConnection', () =>
	{
		test('returns a graceful error when no endpoint is configured', (fDone) =>
		{
			let { provider } = makeProvider();
			provider.testConnection({ Type: 'MySQL', Config: {} },
				(pError, pResult) =>
				{
					Expect(pError).to.equal(null);
					Expect(pResult.Success).to.equal(false);
					Expect(pResult.Error).to.contain('No test endpoint');
					fDone();
				});
		});
	});

	// ─────────────────────────────────────────────────────────────
	//  Full-stack — Pict + jsdom + shared form view
	// ─────────────────────────────────────────────────────────────

	suite('Full stack: List + Detail + shared form', () =>
	{
		test('connection list renders an empty state initially', () =>
		{
			let { listView } = mountFullStack();
			listView.render();
			let tmpListBody = document.querySelector('.mcm-list-body');
			Expect(tmpListBody, 'expected the list body').to.exist;
			Expect(tmpListBody.children.length).to.equal(0);
		});

		test('addConnection puts a row in the list', () =>
		{
			let { provider, listView } = mountFullStack();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			listView.render();
			provider.addConnection({ Name: 'warehouse', Type: 'MySQL', Config: {}, Status: 'new' });

			// refreshViews fires a list re-render synchronously.
			let tmpRows = document.querySelectorAll('.mcm-connection-row');
			Expect(tmpRows.length).to.equal(1);
			Expect(tmpRows[0].textContent).to.contain('warehouse');
			Expect(tmpRows[0].textContent).to.contain('MySQL');
		});

		test('selecting a connection paints the detail editor + populates the shared form', () =>
		{
			let { provider } = mountFullStack();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'warehouse', Type: 'MySQL', Config: { host: '10.0.0.5', port: 13306, user: 'admin' }, Status: 'OK' });
			provider.selectConnection(0);

			let tmpNameInput = document.getElementById('MCM-ConnectionDetail-Name');
			Expect(tmpNameInput, 'expected the detail name input').to.exist;
			Expect(tmpNameInput.value).to.equal('warehouse');

			let tmpTypeSelect = document.getElementById('MCM-ConnectionDetail-Type');
			Expect(tmpTypeSelect.value).to.equal('MySQL');

			// And the shared form's host input picked up the saved value.
			let tmpHostInput = document.getElementById('mcm-conn-mysql-host');
			Expect(tmpHostInput, 'expected the shared form host input').to.exist;
			Expect(tmpHostInput.value).to.equal('10.0.0.5');
		});

		test('the detail type-select gets one option per schema', () =>
		{
			let { provider } = mountFullStack();
			provider.setSchemas([ SQLITE_SCHEMA, MYSQL_SCHEMA, MSSQL_SCHEMA ]);
			provider.addConnection({ Name: 'x', Type: 'MySQL', Config: {}, Status: 'new' });
			provider.selectConnection(0);
			let tmpTypeSelect = document.getElementById('MCM-ConnectionDetail-Type');
			Expect(tmpTypeSelect.children.length).to.equal(3);
		});

		test('save round-trips form values back into the saved connection', () =>
		{
			let { provider, detail } = mountFullStack();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'warehouse', Type: 'MySQL', Config: { host: '10.0.0.5' }, Status: 'new' });
			provider.selectConnection(0);

			document.getElementById('mcm-conn-mysql-host').value = '10.0.0.99';
			document.getElementById('mcm-conn-mysql-port').value = '13306';
			detail.onSave();

			Expect(provider.getConnection(0).Config.host).to.equal('10.0.0.99');
			Expect(provider.getConnection(0).Config.port).to.equal(13306);
		});

		test('save blocks when validation fails (missing required field)', () =>
		{
			let { provider, detail } = mountFullStack();
			provider.setSchemas([ MYSQL_SCHEMA ]);
			provider.addConnection({ Name: 'warehouse', Type: 'MySQL', Config: { host: '10.0.0.5', port: 3306, user: 'admin', database: 'a' }, Status: 'new' });
			provider.selectConnection(0);

			// Wipe the required `host` field.
			document.getElementById('mcm-conn-mysql-host').value = '';
			detail.onSave();

			// Saved connection unchanged — the in-memory copy still has the original host.
			Expect(provider.getConnection(0).Config.host).to.equal('10.0.0.5');
		});
	});
});
