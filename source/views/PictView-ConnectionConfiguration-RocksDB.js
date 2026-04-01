/**
 * PictView-ConnectionConfiguration-RocksDB
 *
 * Per-type connection configuration view for RocksDB.
 * Templates are auto-generated from the ConnectionTypeRegistry by the base class.
 *
 * @module PictView-ConnectionConfiguration-RocksDB
 */

'use strict';

const libPictViewConnectionConfiguration = require('./PictView-ConnectionConfiguration.js');

const _DefaultConfiguration =
{
	ViewIdentifier: 'MCM-ConnectionConfig-RocksDB',
	DefaultRenderable: 'MCM-ConnectionConfig-RocksDB-Container',
	DefaultDestinationAddress: '#MCM-ConnectionConfig-Container',
	DefaultTemplateRecordAddress: 'AppData.MCM.CurrentConnection',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoRender: false,
	AutoSolveWithApp: false,
	ConnectionType: 'RocksDB',
	CSS: false,
	CSSPriority: 500,
	Templates: [],
	Renderables: [],
	Manifests: {},
};

class PictViewConnectionConfigurationRocksDB extends libPictViewConnectionConfiguration
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);
	}
}

module.exports = PictViewConnectionConfigurationRocksDB;
module.exports.default_configuration = _DefaultConfiguration;
