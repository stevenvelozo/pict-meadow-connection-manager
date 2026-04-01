/**
 * PictView-ConnectionList
 *
 * Renders a list of all configured meadow connections.
 * Uses template-based rendering with {~TS:...~} for list iteration.
 *
 * @module PictView-ConnectionList
 */

'use strict';

const libPictView = require('pict-view');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionList',
	DefaultRenderable: 'MCM-ConnectionList-Container',
	DefaultDestinationAddress: '#MCM-ConnectionList-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: true,
	AutoSolveWithApp: false,
	CSS: false,
	CSSPriority: 500,

	Templates:
	[
		{
			Hash: 'MCM-ConnectionList-Container',
			Template: [
				'<section class="mcm-connection-list">',
				'<header class="mcm-list-header">',
				'<h3>Connections</h3>',
				"<button class=\"mcm-btn mcm-btn-add\" onclick=\"{~P~}.providers.MeadowConnectionManager.addConnection()\">Add Connection</button>",
				'</header>',
				'<section class="mcm-list-body" id="MCM-ConnectionList-Rows-{~D:Context[0].Hash~}">',
				'{~TS:MCM-ConnectionList-Row:Record.Connections~}',
				'</section>',
				'</section>',
			].join('\n'),
		},
		{
			Hash: 'MCM-ConnectionList-Row',
			Template: [
				'<article class="mcm-connection-row" data-index="{~D:Record.Index~}">',
				'<span class="mcm-conn-name">{~D:Record.Name~}</span>',
				'<span class="mcm-conn-type">{~D:Record.Type~}</span>',
				'<span class="mcm-conn-status">{~D:Record.Status~}</span>',
				'<span class="mcm-conn-actions">',
				"<button class=\"mcm-btn\" onclick=\"{~P~}.providers.MeadowConnectionManager.selectConnection({~D:Record.Index~})\">Edit</button>",
				"<button class=\"mcm-btn mcm-btn-danger\" onclick=\"{~P~}.providers.MeadowConnectionManager.removeConnection({~D:Record.Index~})\">Remove</button>",
				'</span>',
				'</article>',
			].join('\n'),
		},
	],

	Renderables:
	[
		{
			RenderableHash: 'MCM-ConnectionList-Container',
			TemplateHash: 'MCM-ConnectionList-Container',
			ContentDestinationAddress: '#MCM-ConnectionList-Container',
			RenderMethod: 'replace',
		},
	],

	Manifests: {},
};

class PictViewConnectionList extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}

	/**
	 * Enrich connection records with their array index before rendering.
	 */
	onBeforeRender()
	{
		let tmpProvider = this.pict.providers.MeadowConnectionManager;
		if (!tmpProvider)
		{
			return true;
		}

		let tmpConnections = tmpProvider.getConnections();
		for (let i = 0; i < tmpConnections.length; i++)
		{
			tmpConnections[i].Index = i;
		}

		return true;
	}
}

module.exports = PictViewConnectionList;
module.exports.default_configuration = _DefaultConfiguration;
