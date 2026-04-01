/**
 * PictView-ConnectionConfiguration-Solr
 *
 * Per-type connection configuration view for Solr.
 * Templates are auto-generated from the ConnectionTypeRegistry by the base class.
 *
 * @module PictView-ConnectionConfiguration-Solr
 */

'use strict';

const libPictViewConnectionConfiguration = require('./PictView-ConnectionConfiguration.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig-Solr',
	DefaultRenderable: 'MCM-ConnectionConfig-Solr-Container',
	DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	ConnectionType: 'Solr',
	CSS: false,
	CSSPriority: 500,
	Templates: [],
	Renderables: [],
	Manifests: {},
};

class PictViewConnectionConfigurationSolr extends libPictViewConnectionConfiguration
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = PictViewConnectionConfigurationSolr;
module.exports.default_configuration = _DefaultConfiguration;
