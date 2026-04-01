/**
 * PictView-ConnectionConfiguration-MongoDB
 *
 * Per-type connection configuration view for MongoDB.
 * Templates are auto-generated from the ConnectionTypeRegistry by the base class.
 *
 * @module PictView-ConnectionConfiguration-MongoDB
 */

'use strict';

const libPictViewConnectionConfiguration = require('./PictView-ConnectionConfiguration.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig-MongoDB',
	DefaultRenderable: 'MCM-ConnectionConfig-MongoDB-Container',
	DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	ConnectionType: 'MongoDB',
	CSS: false,
	CSSPriority: 500,
	Templates: [],
	Renderables: [],
	Manifests: {},
};

class PictViewConnectionConfigurationMongoDB extends libPictViewConnectionConfiguration
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = PictViewConnectionConfigurationMongoDB;
module.exports.default_configuration = _DefaultConfiguration;
