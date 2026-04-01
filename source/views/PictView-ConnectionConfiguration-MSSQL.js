/**
 * PictView-ConnectionConfiguration-MSSQL
 *
 * Per-type connection configuration view for MSSQL.
 * Templates are auto-generated from the ConnectionTypeRegistry by the base class.
 *
 * @module PictView-ConnectionConfiguration-MSSQL
 */

'use strict';

const libPictViewConnectionConfiguration = require('./PictView-ConnectionConfiguration.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig-MSSQL',
	DefaultRenderable: 'MCM-ConnectionConfig-MSSQL-Container',
	DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	ConnectionType: 'MSSQL',
	CSS: false,
	CSSPriority: 500,
	Templates: [],
	Renderables: [],
	Manifests: {},
};

class PictViewConnectionConfigurationMSSQL extends libPictViewConnectionConfiguration
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = PictViewConnectionConfigurationMSSQL;
module.exports.default_configuration = _DefaultConfiguration;
