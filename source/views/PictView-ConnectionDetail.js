/**
 * PictView-ConnectionDetail
 *
 * Orchestrator view for editing a single connection.
 * Renders name, type selector, status, save/test/cancel buttons.
 * Embeds the appropriate per-type configuration view into
 * #MCM-ConnectionConfig-Container based on the selected type.
 *
 * @module PictView-ConnectionDetail
 */

'use strict';

const libPictView = require('pict-view');
const libRegistry = require('../ConnectionTypeRegistry.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionDetail',
	DefaultRenderable: 'MCM-ConnectionDetail-Container',
	DefaultDestinationAddress: '#MCM-ConnectionDetail-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	CSS: false,
	CSSPriority: 500,

	Templates:
	[
		{
			Hash: 'MCM-ConnectionDetail-Container',
			Template: [
				'<section class="mcm-connection-detail">',
				'<header class="mcm-detail-header">',
				'<h3>Connection Configuration</h3>',
				'</header>',
				'<article class="mcm-detail-form">',
				'<label class="mcm-field">',
				'<span class="mcm-field-label">Connection Name</span>',
				"<input type=\"text\" id=\"MCM-ConnectionDetail-Name\" value=\"{~D:Record.Name~}\" onchange=\"{~P~}.views['MCM-ConnectionDetail'].onNameChange(this.value)\" />",
				'</label>',
				'<label class="mcm-field">',
				'<span class="mcm-field-label">Connection Type</span>',
				"<select id=\"MCM-ConnectionDetail-Type\" onchange=\"{~P~}.views['MCM-ConnectionDetail'].onTypeChange(this.value)\">",
				'{~TS:MCM-ConnectionDetail-TypeOption:AppData.MCM.ConnectionTypes~}',
				'</select>',
				'</label>',
				'<span class="mcm-conn-status">Status: {~D:Record.Status~}</span>',
				'<section id="MCM-ConnectionConfig-Container"></section>',
				'<footer class="mcm-detail-actions">',
				"<button class=\"mcm-btn mcm-btn-primary\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onSave()\">Save</button>",
				"<button class=\"mcm-btn\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onTest()\">Test Connection</button>",
				"<button class=\"mcm-btn\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onCancel()\">Cancel</button>",
				'</footer>',
				'</article>',
				'</section>',
			].join('\n'),
		},
		{
			Hash: 'MCM-ConnectionDetail-TypeOption',
			Template: '<option value="{~D:Record.TypeName~}">{~D:Record.TypeName~}</option>',
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'MCM-ConnectionDetail-Container',
			TemplateHash: 'MCM-ConnectionDetail-Container',
			ContentDestinationAddress: '#MCM-ConnectionDetail-Container',
			RenderMethod: 'replace',
		},
	],

	Manifests: {},
};

class PictViewConnectionDetail extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}

	/**
	 * After the detail container renders, set the type selector value
	 * and render the appropriate per-type configuration view.
	 */
	onAfterRender()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return true;
		}

		let tmpState = tmpProvider._getState();
		let tmpCurrentType = tmpState.CurrentConnection.Type || 'MySQL';

		// Set the type selector to the current type
		this.pict.ContentAssignment.customReadFunction = null;
		let tmpTypeSelect = (typeof document !== 'undefined') ? document.getElementById('MCM-ConnectionDetail-Type') : null;
		if (tmpTypeSelect)
		{
			tmpTypeSelect.value = tmpCurrentType;
		}

		// Render the per-type configuration view
		this.renderConfigurationView(tmpCurrentType);

		return true;
	}

	/**
	 * Render the per-type configuration view for the given type.
	 *
	 * @param {string} pTypeName
	 */
	renderConfigurationView(pTypeName)
	{
		let tmpViewHash = 'MCM-ConnectionConfig-' + pTypeName;
		let tmpConfigView = this.pict.views[tmpViewHash];

		if (tmpConfigView)
		{
			tmpConfigView.render();
		}
		else
		{
			this.log.warn('MCM-ConnectionDetail: no config view found for type ' + pTypeName);
		}
	}

	/**
	 * Handle connection name change.
	 * @param {string} pNewName
	 */
	onNameChange(pNewName)
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return;
		}

		let tmpState = tmpProvider._getState();
		tmpState.CurrentConnection.Name = pNewName;
	}

	/**
	 * Handle type selector change.
	 * Rebuilds default config for the new type and re-renders config view.
	 *
	 * @param {string} pNewType
	 */
	onTypeChange(pNewType)
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return;
		}

		let tmpState = tmpProvider._getState();
		tmpState.CurrentConnection.Type = pNewType;
		tmpState.CurrentConnection.Config = libRegistry.buildDefaultConfig(pNewType);

		this.renderConfigurationView(pNewType);
	}

	/**
	 * Save the current connection.
	 */
	onSave()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return;
		}

		// Validate first
		let tmpState = tmpProvider._getState();
		let tmpCurrentType = tmpState.CurrentConnection.Type;
		let tmpConfigViewHash = 'MCM-ConnectionConfig-' + tmpCurrentType;
		let tmpConfigView = this.pict.views[tmpConfigViewHash];

		if (tmpConfigView)
		{
			let tmpValidation = tmpConfigView.validateConfig();
			if (!tmpValidation.valid)
			{
				this.log.warn('MCM-ConnectionDetail: validation failed: ' + tmpValidation.errors.join(', '));
				return;
			}
		}

		tmpProvider.saveCurrentConnection();
	}

	/**
	 * Test the current connection configuration.
	 */
	onTest()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return;
		}

		let tmpState = tmpProvider._getState();
		let tmpCurrent = tmpState.CurrentConnection;

		tmpProvider.testConnection(tmpCurrent,
			(pError, pResult) =>
			{
				if (pError)
				{
					this.log.error('MCM-ConnectionDetail: test error: ' + pError.message);
					tmpState.CurrentConnection.Status = 'Error';
				}
				else if (pResult && pResult.Success)
				{
					tmpState.CurrentConnection.Status = 'OK';
				}
				else
				{
					tmpState.CurrentConnection.Status = 'Failed';
				}

				this.render();
			});
	}

	/**
	 * Cancel editing and deselect.
	 */
	onCancel()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (tmpProvider)
		{
			tmpProvider.deselectConnection();
		}
	}
}

module.exports = PictViewConnectionDetail;
module.exports.default_configuration = _DefaultConfiguration;
