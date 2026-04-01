/**
 * PictView-ConnectionConfiguration
 *
 * Abstract base class for per-type connection configuration views.
 * Reads the ConnectionType from options, looks up its field definitions
 * in the ConnectionTypeRegistry, and programmatically builds Templates
 * and Renderables before calling super().
 *
 * Each subclass only needs to set ConnectionType in its default config.
 *
 * @module PictView-ConnectionConfiguration
 */

'use strict';

const libPictView = require('pict-view');
const libRegistry = require('../ConnectionTypeRegistry.js');

/**
 * Build a template string for the configuration fields of a connection type.
 *
 * @param {string} pPrefix — template hash prefix (e.g. 'MCM-ConnectionConfig-MySQL')
 * @param {object} pTypeDef — type definition from registry
 * @returns {string} — HTML template with {~D:...~} data bindings
 */
function buildContainerTemplate(pPrefix, pTypeDef)
{
	let tmpTemplate = '<section class="mcm-config-fields">\n';

	for (let i = 0; i < pTypeDef.Fields.length; i++)
	{
		let tmpField = pTypeDef.Fields[i];
		let tmpInputType = 'text';
		if (tmpField.Type === 'password')
		{
			tmpInputType = 'password';
		}
		else if (tmpField.Type === 'number')
		{
			tmpInputType = 'number';
		}

		let tmpRequired = tmpField.Required ? ' *' : '';
		let tmpInputId = 'MCM-Config-' + tmpField.Name;

		tmpTemplate += '\t<label class="mcm-field">\n';
		tmpTemplate += '\t\t<span class="mcm-field-label">' + tmpField.Label + tmpRequired + '</span>\n';
		tmpTemplate += '\t\t<input type="' + tmpInputType + '"';
		tmpTemplate += ' id="' + tmpInputId + '"';
		tmpTemplate += ' data-field="' + tmpField.Name + '"';
		tmpTemplate += ' value="{~D:Record.Config.' + tmpField.Name + '~}"';
		if (tmpField.Placeholder)
		{
			tmpTemplate += ' placeholder="' + tmpField.Placeholder + '"';
		}
		tmpTemplate += " onchange=\"{~P~}.views['" + pPrefix + "'].onFieldChange('" + tmpField.Name + "', this.value)\"";
		tmpTemplate += ' />\n';
		if (tmpField.HelpText)
		{
			tmpTemplate += '\t\t<span class="mcm-field-help">' + tmpField.HelpText + '</span>\n';
		}
		tmpTemplate += '\t</label>\n';
	}

	tmpTemplate += '</section>\n';
	return tmpTemplate;
}

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig',
	DefaultRenderable: 'MCM-ConnectionConfig-Container',
	DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	ConnectionType: 'MySQL',
	CSS: false,
	CSSPriority: 500,
	Templates: [],
	Renderables: [],
	Manifests: {},
};

class PictViewConnectionConfiguration extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);

		let tmpConnectionType = tmpOptions.ConnectionType || 'MySQL';
		let tmpTypeDef = libRegistry.getConnectionType(tmpConnectionType);
		let tmpPrefix = tmpOptions.ViewIdentifier || ('MCM-ConnectionConfig-' + tmpConnectionType);

		// Auto-generate templates from the registry if not provided
		if (!tmpOptions.Templates || tmpOptions.Templates.length === 0)
		{
			tmpOptions.Templates = [];
			if (tmpTypeDef)
			{
				tmpOptions.Templates.push(
				{
					Hash: tmpPrefix + '-Container',
					Template: buildContainerTemplate(tmpPrefix, tmpTypeDef),
				});
			}
		}

		// Auto-generate renderables if not provided
		if (!tmpOptions.Renderables || tmpOptions.Renderables.length === 0)
		{
			tmpOptions.DefaultRenderable = tmpPrefix + '-Container';
			tmpOptions.Renderables =
			[
				{
					RenderableHash: tmpPrefix + '-Container',
					TemplateHash: tmpPrefix + '-Container',
					ContentDestinationAddress: '#MCM-ConnectionConfig-Container',
					RenderMethod: 'replace',
				},
			];
		}

		super(pFable, tmpOptions, pServiceHash);

		this.connectionType = tmpConnectionType;
	}

	/**
	 * Handle a field value change — write to AppData.
	 *
	 * @param {string} pFieldName — config field name
	 * @param {*} pValue — new value
	 */
	onFieldChange(pFieldName, pValue)
	{
		let tmpAddress = (this.pict.providers.MeadowConnectionManager)
			? this.pict.providers.MeadowConnectionManager.appDataAddress
			: 'MCM';
		let tmpState = this.fable.AppData[tmpAddress];
		if (!tmpState || !tmpState.CurrentConnection)
		{
			return;
		}

		if (!tmpState.CurrentConnection.Config)
		{
			tmpState.CurrentConnection.Config = {};
		}

		// Parse number fields
		let tmpTypeDef = libRegistry.getConnectionType(this.connectionType);
		if (tmpTypeDef)
		{
			for (let i = 0; i < tmpTypeDef.Fields.length; i++)
			{
				if (tmpTypeDef.Fields[i].Name === pFieldName && tmpTypeDef.Fields[i].Type === 'number')
				{
					pValue = parseInt(pValue, 10);
					if (isNaN(pValue))
					{
						pValue = tmpTypeDef.Fields[i].Default;
					}
					break;
				}
			}
		}

		tmpState.CurrentConnection.Config[pFieldName] = pValue;
	}

	/**
	 * Read the current configuration from AppData.
	 * @returns {object}
	 */
	readConfig()
	{
		let tmpAddress = (this.pict.providers.MeadowConnectionManager)
			? this.pict.providers.MeadowConnectionManager.appDataAddress
			: 'MCM';
		let tmpState = this.fable.AppData[tmpAddress];
		if (!tmpState || !tmpState.CurrentConnection)
		{
			return {};
		}
		return tmpState.CurrentConnection.Config || {};
	}

	/**
	 * Populate the form by writing config into AppData and re-rendering.
	 * @param {object} pConfig
	 */
	populateConfig(pConfig)
	{
		let tmpAddress = (this.pict.providers.MeadowConnectionManager)
			? this.pict.providers.MeadowConnectionManager.appDataAddress
			: 'MCM';
		let tmpState = this.fable.AppData[tmpAddress];
		if (!tmpState || !tmpState.CurrentConnection)
		{
			return;
		}

		tmpState.CurrentConnection.Config = Object.assign({}, pConfig);
		this.render();
	}

	/**
	 * Validate the current configuration.
	 * @returns {{ valid: boolean, errors: string[] }}
	 */
	validateConfig()
	{
		return libRegistry.validateConfig(this.connectionType, this.readConfig());
	}
}

module.exports = PictViewConnectionConfiguration;
module.exports.default_configuration = _DefaultConfiguration;
