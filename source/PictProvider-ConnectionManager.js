/**
 * PictProvider-ConnectionManager
 *
 * Central data/state manager for meadow database connection configurations.
 * Loads connections from fable.settings.MeadowConnections on initialize,
 * stores them in AppData, and provides CRUD operations with view refresh.
 *
 * External callers can inject data via setConnections() for REST API
 * or other data sources.
 *
 * @module PictProvider-ConnectionManager
 */

'use strict';

const libPictProvider = require('pict-provider');
const libRegistry = require('./ConnectionTypeRegistry.js');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'MeadowConnectionManager',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,

	// Configurable AppData address prefix
	AppDataAddress: 'MCM',

	// API endpoint for testing connections (optional; if set, POST config here)
	TestConnectionEndpoint: false,
};

class PictProviderConnectionManager extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultProviderConfiguration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'PictProviderConnectionManager';
	}

	/**
	 * Get the AppData address prefix.
	 */
	get appDataAddress()
	{
		return this.options.AppDataAddress || 'MCM';
	}

	/**
	 * Get the MCM state object from AppData.
	 */
	_getState()
	{
		let tmpAddress = this.appDataAddress;
		if (!this.fable.AppData[tmpAddress])
		{
			let tmpTypeNames = libRegistry.getConnectionTypeNames();
			let tmpTypeObjects = [];
			for (let i = 0; i < tmpTypeNames.length; i++)
			{
				tmpTypeObjects.push({ TypeName: tmpTypeNames[i] });
			}

			this.fable.AppData[tmpAddress] =
			{
				Connections: [],
				SelectedIndex: -1,
				CurrentConnection: { Name: '', Type: 'MySQL', Config: {}, Status: 'new' },
				ConnectionTypes: tmpTypeObjects,
			};
		}
		return this.fable.AppData[tmpAddress];
	}

	/**
	 * Initialize: load connections from fable.settings.MeadowConnections.
	 */
	onInitialize()
	{
		let tmpState = this._getState();
		let tmpSettingsConnections = this.fable.settings.MeadowConnections;

		if (Array.isArray(tmpSettingsConnections))
		{
			tmpState.Connections = JSON.parse(JSON.stringify(tmpSettingsConnections));
		}

		// Store as objects so {~TS:...~} template iteration works with {~D:Record.TypeName~}
		let tmpTypeNames = libRegistry.getConnectionTypeNames();
		tmpState.ConnectionTypes = [];
		for (let i = 0; i < tmpTypeNames.length; i++)
		{
			tmpState.ConnectionTypes.push({ TypeName: tmpTypeNames[i] });
		}

		return true;
	}

	// ─────────────────────────────────────────────
	//  Registry delegation (kept from original)
	// ─────────────────────────────────────────────

	getAvailableTypes()
	{
		return libRegistry.getConnectionTypeNames();
	}

	getTypeDefinition(pTypeName)
	{
		return libRegistry.getConnectionType(pTypeName);
	}

	getAllTypeDefinitions()
	{
		return libRegistry.getConnectionTypes();
	}

	buildDefaultConfig(pTypeName)
	{
		return libRegistry.buildDefaultConfig(pTypeName);
	}

	validateConfig(pTypeName, pConfig)
	{
		return libRegistry.validateConfig(pTypeName, pConfig);
	}

	maskConfig(pTypeName, pConfig)
	{
		return libRegistry.maskSensitiveFields(pTypeName, pConfig);
	}

	// ─────────────────────────────────────────────
	//  CRUD operations
	// ─────────────────────────────────────────────

	/**
	 * Get all connections.
	 * @returns {Array}
	 */
	getConnections()
	{
		return this._getState().Connections;
	}

	/**
	 * Get a single connection by index.
	 * @param {number} pIndex
	 * @returns {object|null}
	 */
	getConnection(pIndex)
	{
		let tmpConnections = this._getState().Connections;
		if (pIndex < 0 || pIndex >= tmpConnections.length)
		{
			return null;
		}
		return tmpConnections[pIndex];
	}

	/**
	 * Add a new connection. Returns the new index.
	 * @param {object} [pConnection] — { Name, Type, Config, Status }
	 * @returns {number} — index of the new connection
	 */
	addConnection(pConnection)
	{
		let tmpState = this._getState();
		let tmpConnection = pConnection ||
		{
			Name: 'New Connection',
			Type: 'MySQL',
			Config: libRegistry.buildDefaultConfig('MySQL'),
			Status: 'new',
		};

		tmpState.Connections.push(tmpConnection);
		let tmpIndex = tmpState.Connections.length - 1;

		this.selectConnection(tmpIndex);
		this.refreshViews();

		return tmpIndex;
	}

	/**
	 * Update a connection at a given index.
	 * @param {number} pIndex
	 * @param {object} pConnection
	 */
	updateConnection(pIndex, pConnection)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length)
		{
			return;
		}

		tmpState.Connections[pIndex] = pConnection;
		this.refreshViews();
	}

	/**
	 * Remove a connection by index.
	 * @param {number} pIndex
	 */
	removeConnection(pIndex)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length)
		{
			return;
		}

		tmpState.Connections.splice(pIndex, 1);

		// Adjust selection
		if (tmpState.SelectedIndex === pIndex)
		{
			tmpState.SelectedIndex = -1;
			tmpState.CurrentConnection = { Name: '', Type: 'MySQL', Config: {}, Status: 'new' };
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

	/**
	 * Select a connection for editing.
	 * @param {number} pIndex
	 */
	selectConnection(pIndex)
	{
		let tmpState = this._getState();
		if (pIndex < 0 || pIndex >= tmpState.Connections.length)
		{
			return;
		}

		tmpState.SelectedIndex = pIndex;
		// Deep copy so editing doesn't mutate the list
		tmpState.CurrentConnection = JSON.parse(JSON.stringify(tmpState.Connections[pIndex]));

		this.refreshDetailView();
	}

	/**
	 * Deselect the current connection.
	 */
	deselectConnection()
	{
		let tmpState = this._getState();
		tmpState.SelectedIndex = -1;
		tmpState.CurrentConnection = { Name: '', Type: 'MySQL', Config: {}, Status: 'new' };

		this.refreshViews();
	}

	/**
	 * Save the CurrentConnection back to the Connections array.
	 */
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

	/**
	 * Bulk-set connections from an external source (REST API, etc.).
	 * @param {Array} pConnectionArray
	 */
	setConnections(pConnectionArray)
	{
		let tmpState = this._getState();
		tmpState.Connections = Array.isArray(pConnectionArray) ? pConnectionArray : [];
		tmpState.SelectedIndex = -1;
		tmpState.CurrentConnection = { Name: '', Type: 'MySQL', Config: {}, Status: 'new' };

		this.refreshViews();
	}

	// ─────────────────────────────────────────────
	//  Connection testing
	// ─────────────────────────────────────────────

	/**
	 * Test a connection configuration.
	 * If TestConnectionEndpoint is configured, POST to it.
	 * Otherwise, call fCallback with a placeholder result.
	 *
	 * @param {object} pConfig — { Type, Config }
	 * @param {function} fCallback — function(pError, pResult)
	 */
	testConnection(pConfig, fCallback)
	{
		let tmpEndpoint = this.options.TestConnectionEndpoint;

		if (!tmpEndpoint)
		{
			return fCallback(null, { Success: false, Error: 'No test endpoint configured' });
		}

		let tmpBody = JSON.stringify(
		{
			Type: pConfig.Type,
			Config: pConfig.Config,
		});

		// Use fetch (works in both browser and modern Node.js)
		if (typeof fetch === 'function')
		{
			fetch(tmpEndpoint,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: tmpBody,
			})
			.then((pResponse) => pResponse.json())
			.then((pResult) => fCallback(null, pResult))
			.catch((pError) => fCallback(pError));
		}
		else if (this.fable.RestClient)
		{
			this.fable.RestClient.postJSON(tmpEndpoint,
				{ Type: pConfig.Type, Config: pConfig.Config },
				(pError, pResponse, pBody) =>
				{
					if (pError) return fCallback(pError);
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

	/**
	 * Refresh all connection manager views.
	 */
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

	/**
	 * Refresh the detail view if a connection is selected.
	 * If no connection is selected, clear the detail container.
	 */
	refreshDetailView()
	{
		if (!this.pict || !this.pict.views)
		{
			return;
		}

		let tmpState = this._getState();

		if (tmpState.SelectedIndex >= 0 && this.pict.views['MCM-ConnectionDetail'])
		{
			this.pict.views['MCM-ConnectionDetail'].render();
		}
		else
		{
			// Clear the detail container when nothing is selected
			this.pict.ContentAssignment.assignContent('#MCM-ConnectionDetail-Container', '');
		}
	}
}

module.exports = PictProviderConnectionManager;
module.exports.default_configuration = _DefaultProviderConfiguration;
