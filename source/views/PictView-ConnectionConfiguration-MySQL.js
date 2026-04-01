/**
 * PictView-ConnectionConfiguration-MySQL
 *
 * Per-type connection configuration view for MySQL.
 * Templates are auto-generated from the ConnectionTypeRegistry by the base class.
 *
 * @module PictView-ConnectionConfiguration-MySQL
 */

'use strict';

const libPictViewConnectionConfiguration = require('./PictView-ConnectionConfiguration.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig-MySQL',
	DefaultRenderable: 'MCM-ConnectionConfig-MySQL-Container',
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

class PictViewConnectionConfigurationMySQL extends libPictViewConnectionConfiguration
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = PictViewConnectionConfigurationMySQL;
module.exports.default_configuration = _DefaultConfiguration;
