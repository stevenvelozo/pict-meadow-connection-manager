/**
 * PictView-ConnectionDetail
 *
 * Editor for a single named connection.  Owns the persistent shell
 * fields (Name + Type select + Status badge) and the Save / Test /
 * Cancel buttons; the per-provider field block is rendered by the
 * shared `pict-section-connection-form` view into the slot at
 * `#MCM-ConnectionConfig-Container`.
 *
 * Earlier versions of this view dispatched to per-type subclassed
 * config views (`MCM-ConnectionConfig-MySQL`, …); those are gone.
 * The shared form view handles every provider type by reading the
 * schema list the provider injected via `setSchemas()`.
 *
 * @module PictView-ConnectionDetail
 */
'use strict';

const libPictView = require('pict-view');

const _DefaultConfiguration =
{
	ViewIdentifier:               'MCM-ConnectionDetail',
	DefaultRenderable:            'MCM-ConnectionDetail-Container',
	DefaultDestinationAddress:    '#MCM-ConnectionDetail-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize:               true,
	AutoInitializeOrdinal:        0,
	AutoRender:                   false,
	AutoSolveWithApp:             false,
	CSS:                          false,
	CSSPriority:                  500,

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
						// pict-section-connection-form renders here
						'<section id="MCM-ConnectionConfig-Container"></section>',
						'<footer class="mcm-detail-actions">',
							"<button class=\"mcm-btn mcm-btn-primary\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onSave()\">Save</button>",
							"<button class=\"mcm-btn\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onTest()\">Test Connection</button>",
							"<button class=\"mcm-btn\" onclick=\"{~P~}.views['MCM-ConnectionDetail'].onCancel()\">Cancel</button>",
						'</footer>',
					'</article>',
				'</section>'
			].join('\n')
		},
		{
			Hash: 'MCM-ConnectionDetail-TypeOption',
			Template: '<option value="{~D:Record.TypeName~}">{~D:Record.DisplayName~}</option>'
		}
	],

	Renderables:
	[
		{
			RenderableHash:            'MCM-ConnectionDetail-Container',
			TemplateHash:              'MCM-ConnectionDetail-Container',
			ContentDestinationAddress: '#MCM-ConnectionDetail-Container',
			RenderMethod:              'replace'
		}
	],

	Manifests: {}
};

class PictViewConnectionDetail extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}

	/**
	 * After the detail container renders, sync the type selector and
	 * hand the schemas + active provider + saved values to the shared
	 * form view.
	 */
	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		let tmpFormView = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpProvider || !tmpFormView)
		{
			return super.onAfterRender(pRenderable, pAddress, pRecord, pContent);
		}

		let tmpState = tmpProvider._getState();
		let tmpCurrentType = tmpState.CurrentConnection.Type || (tmpProvider.getAvailableTypes()[0] || '');

		// Sync the type select's value to the active provider.
		if (typeof(document) !== 'undefined')
		{
			let tmpTypeSelect = document.getElementById('MCM-ConnectionDetail-Type');
			if (tmpTypeSelect && tmpCurrentType) { tmpTypeSelect.value = tmpCurrentType; }
		}

		// Make sure the form has the current schemas, then populate it
		// with the saved config so the user sees their previous values.
		tmpFormView.setSchemas(tmpProvider.getSchemas());
		if (tmpCurrentType)
		{
			tmpFormView.setValues(tmpCurrentType, tmpState.CurrentConnection.Config || {});
		}

		return super.onAfterRender(pRenderable, pAddress, pRecord, pContent);
	}

	// ────────────────────────────────────────────────────────────
	//  Action handlers
	// ────────────────────────────────────────────────────────────

	onNameChange(pNewName)
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider) { return; }

		let tmpState = tmpProvider._getState();
		tmpState.CurrentConnection.Name = pNewName;
	}

	/**
	 * Type-selector change.  Switch the active provider on the shared
	 * form view and reset CurrentConnection.Config to the new type's
	 * defaults so old values from the previous type don't leak.
	 */
	onTypeChange(pNewType)
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		let tmpFormView = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpProvider) { return; }

		let tmpState = tmpProvider._getState();
		tmpState.CurrentConnection.Type   = pNewType;
		tmpState.CurrentConnection.Config = tmpProvider.buildDefaultConfig(pNewType);

		if (tmpFormView)
		{
			tmpFormView.setActiveProvider(pNewType);
			// setActiveProvider re-renders inputs; reseed defaults so
			// the form reflects the freshly-chosen type's values.
			tmpFormView.setValues(pNewType, tmpState.CurrentConnection.Config);
		}
	}

	/**
	 * Save: pull the live form values into CurrentConnection.Config,
	 * validate, then commit to the provider.
	 */
	onSave()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		let tmpFormView = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpProvider) { return; }

		let tmpState = tmpProvider._getState();

		if (tmpFormView && typeof(tmpFormView.getProviderConfig) === 'function')
		{
			let tmpConnInfo = tmpFormView.getProviderConfig();
			tmpState.CurrentConnection.Type   = tmpConnInfo.Provider || tmpState.CurrentConnection.Type;
			tmpState.CurrentConnection.Config = tmpConnInfo.Config   || {};
		}

		let tmpValidation = tmpProvider.validateConfig(tmpState.CurrentConnection.Type, tmpState.CurrentConnection.Config);
		if (!tmpValidation.valid)
		{
			this.log.warn('MCM-ConnectionDetail: validation failed: ' + tmpValidation.errors.join(', '));
			return;
		}

		tmpProvider.saveCurrentConnection();
	}

	/**
	 * Test: same field-collection step as Save, then dispatch to the
	 * provider's testConnection helper.
	 */
	onTest()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		let tmpFormView = this.pict.views['PictSection-ConnectionForm'];
		if (!tmpProvider) { return; }

		let tmpState = tmpProvider._getState();

		if (tmpFormView && typeof(tmpFormView.getProviderConfig) === 'function')
		{
			let tmpConnInfo = tmpFormView.getProviderConfig();
			tmpState.CurrentConnection.Type   = tmpConnInfo.Provider || tmpState.CurrentConnection.Type;
			tmpState.CurrentConnection.Config = tmpConnInfo.Config   || {};
		}

		tmpProvider.testConnection(tmpState.CurrentConnection,
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

	onCancel()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (tmpProvider) { tmpProvider.deselectConnection(); }
	}
}

module.exports = PictViewConnectionDetail;
module.exports.default_configuration = _DefaultConfiguration;
