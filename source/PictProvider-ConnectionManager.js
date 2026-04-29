/**
 * PictProvider-ConnectionManager
 *
 * Central data/state manager for named meadow connection records.
 * Owns:
 *   - the list of saved connections (CRUD operations)
 *   - the currently-selected connection (for the detail editor)
 *   - the schema list that drives the per-provider form (injected
 *     via setSchemas() — typically loaded from a server endpoint
 *     backed by `meadow-connection-manager.getAllProviderFormSchemas()`)
 *   - test-connection dispatch (POST to a configurable endpoint)
 *
 * Schema source is the host's responsibility — this module is
 * browser-only and intentionally has no knowledge of the
 * `meadow-connection-*` modules.  Hosts call setSchemas() once they
 * have the schema list (typically from
 * `GET /<app>/connection/schemas`).  The provider then propagates
 * schemas into the shared form view (`PictSection-ConnectionForm`)
 * whenever the detail editor opens.
 *
 * @module PictProvider-ConnectionManager
 */
'use strict';

const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'MeadowConnectionManager',
	AutoInitialize:     true,
	AutoInitializeOrdinal: 0,

	// Configurable AppData address prefix.  Default uses 'MCM' so
	// existing hosts continue to read AppData.MCM.* as before.
	AppDataAddress: 'MCM',

	// Optional API endpoint for testing connections.  When configured,
	// testConnection() POSTs `{ Type, Config }` to this URL.
	TestConnectionEndpoint: false
};

class PictProviderConnectionManager extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultProviderConfiguration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'PictProviderConnectionManager';

		// Schemas are injected by setSchemas().  Until that happens
		// the detail editor will render the form view's
		// "no providers detected" empty state.
		this._Schemas = [];
	}

	get appDataAddress()
	{
		return this.options.AppDataAddress || 'MCM';
	}

	// ─────────────────────────────────────────────
	//  AppData scaffolding
	// ─────────────────────────────────────────────

	_getState()
	{
		let tmpAddress = this.appDataAddress;
		if (!this.fable.AppData[tmpAddress])
		{
			this.fable.AppData[tmpAddress] =
				{
					Connections:       [],
					SelectedIndex:     -1,
					CurrentConnection: { Name: '', Type: '', Config: {}, Status: 'new' },
					ConnectionTypes:   [],   // populated by setSchemas()
					Schemas:           []    // populated by setSchemas()
				};
		}
		return this.fable.AppData[tmpAddress];
	}

	onInitialize()
	{
		let tmpState = this._getState();
		let tmpSettingsConnections = this.fable.settings.MeadowConnections;
		if (Array.isArray(tmpSettingsConnections))
		{
			tmpState.Connections = JSON.parse(JSON.stringify(tmpSettingsConnections));
		}
		return true;
	}

	// ─────────────────────────────────────────────
	//  Schemas — host injects these from the server
	// ─────────────────────────────────────────────

	/**
	 * Inject the full schema list (typically the response from a
	 * server's `GET /<app>/connection/schemas` endpoint, which is
	 * itself backed by `meadow-connection-manager.getAllProviderFormSchemas()`).
	 *
	 * Side effects:
	 *   - mirrors the schemas into AppData.<addr>.Schemas
	 *   - rebuilds AppData.<addr>.ConnectionTypes (used by the
	 *     detail view's <select>)
	 *   - hands the schemas to the shared form view if it's mounted
	 *
	 * @param {object[]} pSchemas
	 */
	setSchemas(pSchemas)
	{
		let tmpSchemas = Array.isArray(pSchemas) ? pSchemas : [];
		this._Schemas = tmpSchemas;

		let tmpState = this._getState();
		tmpState.Schemas = tmpSchemas;
		tmpState.ConnectionTypes = tmpSchemas.map((pS) => ({ TypeName: pS.Provider, DisplayName: pS.DisplayName || pS.Provider }));

		// If no provider has been picked yet for an in-progress new
		// connection, default to the first available schema.
		if (!tmpState.CurrentConnection.Type && tmpSchemas.length > 0)
		{
			tmpState.CurrentConnection.Type = tmpSchemas[0].Provider;
			tmpState.CurrentConnection.Config = this.buildDefaultConfig(tmpSchemas[0].Provider);
		}

		// Propagate to the shared form view if it's already mounted.
		// (Detail view also calls setSchemas() in its onAfterRender, so
		// the order doesn't matter.)
		let tmpFormView = this.pict && this.pict.views && this.pict.views['PictSection-ConnectionForm'];
		if (tmpFormView && typeof(tmpFormView.setSchemas) === 'function')
		{
			tmpFormView.setSchemas(tmpSchemas);
		}

		this.refreshViews();
	}

	/**
	 * Get the full schema list.
	 * @returns {object[]}
	 */
	getSchemas()
	{
		return this._Schemas;
	}

	/**
	 * Look up a single schema by provider type.
	 * @param {string} pTypeName
	 * @returns {object|null}
	 */
	getSchema(pTypeName)
	{
		return this._Schemas.find((pS) => pS.Provider === pTypeName) || null;
	}

	/**
	 * Get all available provider type names.
	 * @returns {string[]}
	 */
	getAvailableTypes()
	{
		return this._Schemas.map((pS) => pS.Provider);
	}

	// ─────────────────────────────────────────────
	//  Schema-driven helpers (replace the legacy
	//  ConnectionTypeRegistry helpers)
	// ─────────────────────────────────────────────

	/**
	 * Build a default-valued config blob for a given provider type.
	 * Walks the schema's Fields and pulls each field's Default.
	 *
	 * @param {string} pTypeName
	 * @returns {object}
	 */
	buildDefaultConfig(pTypeName)
	{
		let tmpSchema = this.getSchema(pTypeName);
		if (!tmpSchema) { return {}; }

		let tmpConfig = {};
		(tmpSchema.Fields || []).forEach((pField) =>
		{
			if (pField.Default !== undefined && pField.Default !== null)
			{
				let tmpValue = pField.Default;
				if (pField.Multiplier && typeof(tmpValue) === 'number')
				{
					tmpValue = tmpValue * pField.Multiplier;
				}
				let tmpTargets = (pField.MapTo && pField.MapTo.length) ? pField.MapTo : [ pField.Name ];
				tmpTargets.forEach((pPath) => this._setNested(tmpConfig, pPath, tmpValue));
			}
		});
		return tmpConfig;
	}

	/**
	 * Validate a config blob against the schema for a given type.
	 * Currently only checks `Required: true` fields.
	 *
	 * @param {string} pTypeName
	 * @param {object} pConfig
	 * @returns {{ valid: boolean, errors: string[] }}
	 */
	validateConfig(pTypeName, pConfig)
	{
		let tmpSchema = this.getSchema(pTypeName);
		if (!tmpSchema)
		{
			return { valid: false, errors: [ 'Unknown connection type: ' + pTypeName ] };
		}

		let tmpErrors = [];
		(tmpSchema.Fields || []).forEach((pField) =>
		{
			if (!pField.Required) { return; }
			let tmpTarget = (pField.MapTo && pField.MapTo[0]) ? pField.MapTo[0] : pField.Name;
			let tmpValue = this._readNested(pConfig || {}, tmpTarget);
			if (tmpValue === undefined || tmpValue === null || tmpValue === '')
			{
				tmpErrors.push((pField.Label || pField.Name) + ' is required');
			}
		});
		return { valid: tmpErrors.length === 0, errors: tmpErrors };
	}

	/**
	 * Mask Password-typed fields for safe display (logs, list rows).
	 * Returns a shallow copy with `***` substituted for any value
	 * whose schema field declares Type='Password'.
	 *
	 * @param {string} pTypeName
	 * @param {object} pConfig
	 * @returns {object}
	 */
	maskConfig(pTypeName, pConfig)
	{
		let tmpSchema = this.getSchema(pTypeName);
		if (!tmpSchema || !pConfig) { return pConfig; }

		let tmpMasked = JSON.parse(JSON.stringify(pConfig));
		(tmpSchema.Fields || []).forEach((pField) =>
		{
			if (pField.Type !== 'Password') { return; }
			let tmpTargets = (pField.MapTo && pField.MapTo.length) ? pField.MapTo : [ pField.Name ];
			tmpTargets.forEach((pPath) =>
			{
				let tmpExisting = this._readNested(tmpMasked, pPath);
				if (tmpExisting) { this._setNested(tmpMasked, pPath, '***'); }
			});
		});
		return tmpMasked;
	}

	// ─────────────────────────────────────────────
	//  CRUD operations
	// ─────────────────────────────────────────────

	getConnections()
	{
		return this._getState().Connections;
	}

	getConnection(pIndex)
	{
		let tmpConnections = this._getState().Connections;
		if (pIndex < 0 || pIndex >= tmpConnections.length) { return null; }
		return tmpConnections[pIndex];
	}

	addConnection(pConnection)
	{
		let tmpState = this._getState();
		let tmpDefaultType = (this._Schemas[0] && this._Schemas[0].Provider) || '';
		let tmpConnection = pConnection ||
			{
				Name:   'New Connection',
				Type:   tmpDefaultType,
				Config: tmpDefaultType ? this.buildDefaultConfig(tmpDefaultType) : {},
				Status: 'new'
			};

		tmpState.Connections.push(tmpConnection);
		let tmpIndex = tmpState.Connections.length - 1;

		this.selectConnection(tmpIndex);
		this.refreshViews();

		return tmpIndex;
	}

	updateConnection(pIndex, pConnection)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length) { return; }
		tmpState.Connections[pIndex] = pConnection;
		this.refreshViews();
	}

	removeConnection(pIndex)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length) { return; }

		tmpState.Connections.splice(pIndex, 1);

		if (tmpState.SelectedIndex === pIndex)
		{
			tmpState.SelectedIndex = -1;
			tmpState.CurrentConnection = { Name: '', Type: '', Config: {}, Status: 'new' };
		}
		else if (tmpState.SelectedIndex > pIndex)
		{
			tmpState.SelectedIndex--;
		}

		this.refreshViews();
	}

	// ─────────────────────────────────────────────
	//  Selection
	// ─────────────────────────────────────────────

	selectConnection(pIndex)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length) { return; }

		tmpState.SelectedIndex = pIndex;
		// Deep copy so editing doesn't mutate the list until Save.
		tmpState.CurrentConnection = JSON.parse(JSON.stringify(tmpState.Connections[pIndex]));

		this.refreshDetailView();
	}

	deselectConnection()
	{
		let tmpState = this._getState();
		tmpState.SelectedIndex = -1;
		tmpState.CurrentConnection = { Name: '', Type: '', Config: {}, Status: 'new' };
		this.refreshViews();
	}

	saveCurrentConnection()
	{
		let tmpState = this._getState();
		let tmpCurrent = tmpState.CurrentConnection;

		if (tmpState.SelectedIndex >= 0 && tmpState.SelectedIndex < tmpState.Connections.length)
		{
			tmpState.Connections[tmpState.SelectedIndex] = JSON.parse(JSON.stringify(tmpCurrent));
		}
		else
		{
			tmpState.Connections.push(JSON.parse(JSON.stringify(tmpCurrent)));
			tmpState.SelectedIndex = tmpState.Connections.length - 1;
		}

		this.refreshViews();
	}

	// ─────────────────────────────────────────────
	//  External data injection
	// ─────────────────────────────────────────────

	setConnections(pConnectionArray)
	{
		let tmpState = this._getState();
		tmpState.Connections = Array.isArray(pConnectionArray) ? pConnectionArray : [];
		tmpState.SelectedIndex = -1;
		tmpState.CurrentConnection = { Name: '', Type: '', Config: {}, Status: 'new' };

		this.refreshViews();
	}

	// ─────────────────────────────────────────────
	//  Connection testing
	// ─────────────────────────────────────────────

	testConnection(pConfig, fCallback)
	{
		let tmpEndpoint = this.options.TestConnectionEndpoint;

		if (!tmpEndpoint)
		{
			return fCallback(null, { Success: false, Error: 'No test endpoint configured' });
		}

		let tmpBody = JSON.stringify({ Type: pConfig.Type, Config: pConfig.Config });

		if (typeof(fetch) === 'function')
		{
			fetch(tmpEndpoint,
				{
					method:  'POST',
					headers: { 'Content-Type': 'application/json' },
					body:    tmpBody
				})
				.then((pResponse) => pResponse.json())
				.then((pResult)   => fCallback(null, pResult))
				.catch((pError)   => fCallback(pError));
		}
		else if (this.fable.RestClient)
		{
			this.fable.RestClient.postJSON(tmpEndpoint,
				{ Type: pConfig.Type, Config: pConfig.Config },
				(pError, pResponse, pBody) =>
				{
					if (pError) { return fCallback(pError); }
					return fCallback(null, pBody);
				});
		}
		else
		{
			return fCallback(null, { Success: false, Error: 'No HTTP client available' });
		}
	}

	// ─────────────────────────────────────────────
	//  View refresh
	// ─────────────────────────────────────────────

	refreshViews()
	{
		if (this.pict && this.pict.views)
		{
			if (this.pict.views['MCM-ConnectionList'])
			{
				this.pict.views['MCM-ConnectionList'].render();
			}
		}
		this.refreshDetailView();
	}

	refreshDetailView()
	{
		if (!this.pict || !this.pict.views) { return; }

		let tmpState = this._getState();
		if (tmpState.SelectedIndex >= 0 && this.pict.views['MCM-ConnectionDetail'])
		{
			this.pict.views['MCM-ConnectionDetail'].render();
		}
		else if (this.pict.ContentAssignment)
		{
			this.pict.ContentAssignment.assignContent('#MCM-ConnectionDetail-Container', '');
		}
	}

	// ─────────────────────────────────────────────
	//  Internal helpers — dotted-path nesting
	// ─────────────────────────────────────────────

	_setNested(pTarget, pPath, pValue)
	{
		let tmpParts = String(pPath).split('.');
		let tmpCursor = pTarget;
		for (let i = 0; i < tmpParts.length - 1; i++)
		{
			let tmpKey = tmpParts[i];
			if (typeof(tmpCursor[tmpKey]) !== 'object' || tmpCursor[tmpKey] === null)
			{
				tmpCursor[tmpKey] = {};
			}
			tmpCursor = tmpCursor[tmpKey];
		}
		tmpCursor[tmpParts[tmpParts.length - 1]] = pValue;
	}

	_readNested(pSource, pPath)
	{
		let tmpParts = String(pPath).split('.');
		let tmpCursor = pSource;
		for (let i = 0; i < tmpParts.length; i++)
		{
			if (tmpCursor === undefined || tmpCursor === null) { return undefined; }
			tmpCursor = tmpCursor[tmpParts[i]];
		}
		return tmpCursor;
	}
}

module.exports = PictProviderConnectionManager;
module.exports.default_configuration = _DefaultProviderConfiguration;
