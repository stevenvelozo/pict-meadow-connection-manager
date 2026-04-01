/**
 * ConnectionTypeRegistry
 *
 * Static definitions of all supported meadow connection types.
 * Each type defines its form fields, default values, category,
 * and display metadata.
 *
 * Browser-safe — no database driver dependencies.
 *
 * @module ConnectionTypeRegistry
 */

'use strict';

/**
 * Field definition for connection configuration forms.
 *
 * @typedef {object} ConnectionField
 * @property {string} Name — field key in the config object
 * @property {string} Label — human-readable label
 * @property {string} Type — 'text', 'password', 'number', 'filepath'
 * @property {*} Default — default value
 * @property {boolean} Required — whether the field is required
 * @property {string} [Placeholder] — input placeholder text
 * @property {string} [HelpText] — tooltip or description
 */

const CONNECTION_TYPES =
{
	'MySQL':
	{
		Label: 'MySQL',
		Category: 'network',
		Description: 'MySQL or MariaDB relational database',
		ProviderModule: 'meadow-connection-mysql',
		Fields:
		[
			{ Name: 'server',          Label: 'Server',          Type: 'text',     Default: '127.0.0.1', Required: true,  Placeholder: 'hostname or IP' },
			{ Name: 'port',            Label: 'Port',            Type: 'number',   Default: 3306,        Required: true },
			{ Name: 'user',            Label: 'User',            Type: 'text',     Default: 'root',      Required: true },
			{ Name: 'password',        Label: 'Password',        Type: 'password', Default: '',          Required: false },
			{ Name: 'database',        Label: 'Database',        Type: 'text',     Default: 'meadow',    Required: true },
			{ Name: 'connectionLimit', Label: 'Connection Limit', Type: 'number',  Default: 20,          Required: false, HelpText: 'Max simultaneous connections' },
		],
	},

	'PostgreSQL':
	{
		Label: 'PostgreSQL',
		Category: 'network',
		Description: 'PostgreSQL relational database',
		ProviderModule: 'meadow-connection-postgresql',
		Fields:
		[
			{ Name: 'server',   Label: 'Server',   Type: 'text',     Default: '127.0.0.1', Required: true },
			{ Name: 'port',     Label: 'Port',     Type: 'number',   Default: 5432,        Required: true },
			{ Name: 'user',     Label: 'User',     Type: 'text',     Default: 'postgres',  Required: true },
			{ Name: 'password', Label: 'Password', Type: 'password', Default: '',          Required: false },
			{ Name: 'database', Label: 'Database', Type: 'text',     Default: 'meadow',    Required: true },
		],
	},

	'MSSQL':
	{
		Label: 'Microsoft SQL Server',
		Category: 'network',
		Description: 'Microsoft SQL Server or Azure SQL',
		ProviderModule: 'meadow-connection-mssql',
		Fields:
		[
			{ Name: 'server',              Label: 'Server',          Type: 'text',     Default: '127.0.0.1', Required: true },
			{ Name: 'port',                Label: 'Port',            Type: 'number',   Default: 1433,        Required: true },
			{ Name: 'user',                Label: 'User',            Type: 'text',     Default: 'sa',        Required: true },
			{ Name: 'password',            Label: 'Password',        Type: 'password', Default: '',          Required: false },
			{ Name: 'database',            Label: 'Database',        Type: 'text',     Default: 'meadow',    Required: true },
			{ Name: 'ConnectionPoolLimit', Label: 'Pool Limit',      Type: 'number',   Default: 20,          Required: false },
		],
	},

	'SQLite':
	{
		Label: 'SQLite',
		Category: 'file',
		Description: 'SQLite file-based database',
		ProviderModule: 'meadow-connection-sqlite',
		Fields:
		[
			{ Name: 'SQLiteFilePath', Label: 'Database File Path', Type: 'filepath', Default: './data/database.db', Required: true, Placeholder: '/path/to/database.db' },
		],
	},

	'Solr':
	{
		Label: 'Apache Solr',
		Category: 'search',
		Description: 'Apache Solr search engine',
		ProviderModule: 'meadow-connection-solr',
		Fields:
		[
			{ Name: 'host', Label: 'Host', Type: 'text',   Default: 'localhost', Required: true },
			{ Name: 'port', Label: 'Port', Type: 'number', Default: 8983,        Required: true },
			{ Name: 'core', Label: 'Core', Type: 'text',   Default: 'meadow',    Required: false, Placeholder: 'Solr core name' },
		],
	},

	'RocksDB':
	{
		Label: 'RocksDB',
		Category: 'file',
		Description: 'RocksDB embedded key-value store',
		ProviderModule: 'meadow-connection-rocksdb',
		Fields:
		[
			{ Name: 'FilePath', Label: 'Data Directory', Type: 'filepath', Default: './data/rocksdb', Required: true, Placeholder: '/path/to/data' },
		],
	},

	'MongoDB':
	{
		Label: 'MongoDB',
		Category: 'document',
		Description: 'MongoDB document database',
		ProviderModule: 'meadow-connection-mongodb',
		Fields:
		[
			{ Name: 'connectionString', Label: 'Connection String', Type: 'text',   Default: 'mongodb://localhost:27017', Required: true, Placeholder: 'mongodb://...' },
			{ Name: 'database',         Label: 'Database',          Type: 'text',   Default: 'meadow',                   Required: true },
		],
	},
};

/**
 * Get the type registry.
 * @returns {object} — keyed by type name
 */
function getConnectionTypes()
{
	return CONNECTION_TYPES;
}

/**
 * Get a single type definition.
 * @param {string} pTypeName
 * @returns {object|null}
 */
function getConnectionType(pTypeName)
{
	return CONNECTION_TYPES[pTypeName] || null;
}

/**
 * Get all type names.
 * @returns {string[]}
 */
function getConnectionTypeNames()
{
	return Object.keys(CONNECTION_TYPES);
}

/**
 * Get types filtered by category.
 * @param {string} pCategory — 'network', 'file', 'search', 'document'
 * @returns {object} — subset of the registry
 */
function getConnectionTypesByCategory(pCategory)
{
	let tmpResult = {};
	let tmpKeys = Object.keys(CONNECTION_TYPES);
	for (let i = 0; i < tmpKeys.length; i++)
	{
		if (CONNECTION_TYPES[tmpKeys[i]].Category === pCategory)
		{
			tmpResult[tmpKeys[i]] = CONNECTION_TYPES[tmpKeys[i]];
		}
	}
	return tmpResult;
}

/**
 * Build a default configuration object for a given type.
 * @param {string} pTypeName
 * @returns {object} — config with default values populated
 */
function buildDefaultConfig(pTypeName)
{
	let tmpType = CONNECTION_TYPES[pTypeName];
	if (!tmpType)
	{
		return {};
	}

	let tmpConfig = {};
	for (let i = 0; i < tmpType.Fields.length; i++)
	{
		let tmpField = tmpType.Fields[i];
		tmpConfig[tmpField.Name] = tmpField.Default;
	}
	return tmpConfig;
}

/**
 * Validate a configuration object against its type definition.
 * @param {string} pTypeName
 * @param {object} pConfig
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConfig(pTypeName, pConfig)
{
	let tmpType = CONNECTION_TYPES[pTypeName];
	if (!tmpType)
	{
		return { valid: false, errors: ['Unknown connection type: ' + pTypeName] };
	}

	let tmpErrors = [];
	for (let i = 0; i < tmpType.Fields.length; i++)
	{
		let tmpField = tmpType.Fields[i];
		if (tmpField.Required && (pConfig[tmpField.Name] === undefined || pConfig[tmpField.Name] === null || pConfig[tmpField.Name] === ''))
		{
			tmpErrors.push(tmpField.Label + ' is required');
		}
	}

	return { valid: tmpErrors.length === 0, errors: tmpErrors };
}

/**
 * Mask sensitive fields (passwords) for display.
 * @param {string} pTypeName
 * @param {object} pConfig
 * @returns {object} — copy with password fields masked
 */
function maskSensitiveFields(pTypeName, pConfig)
{
	let tmpType = CONNECTION_TYPES[pTypeName];
	if (!tmpType || !pConfig)
	{
		return pConfig;
	}

	let tmpMasked = Object.assign({}, pConfig);
	for (let i = 0; i < tmpType.Fields.length; i++)
	{
		let tmpField = tmpType.Fields[i];
		if (tmpField.Type === 'password' && tmpMasked[tmpField.Name])
		{
			tmpMasked[tmpField.Name] = '***';
		}
	}
	return tmpMasked;
}

module.exports =
{
	ConnectionTypes: CONNECTION_TYPES,
	getConnectionTypes: getConnectionTypes,
	getConnectionType: getConnectionType,
	getConnectionTypeNames: getConnectionTypeNames,
	getConnectionTypesByCategory: getConnectionTypesByCategory,
	buildDefaultConfig: buildDefaultConfig,
	validateConfig: validateConfig,
	maskSensitiveFields: maskSensitiveFields,
};
