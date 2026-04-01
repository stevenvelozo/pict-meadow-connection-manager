#!/usr/bin/env node
/**
 * Bookstore Connections Example — Server
 *
 * Orator-based server that:
 *   1. Serves the Pict web UI (html/ directory + pict.min.js)
 *   2. Provides POST /test-connection using meadow-connection-manager
 *
 * Usage:
 *   docker compose up -d      # start MySQL + PostgreSQL
 *   npm start                 # start this server on port 8891
 *   open http://localhost:8891
 */

'use strict';

const libPath = require('path');
const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');
const libMeadowConnectionManager = require('meadow-connection-manager');
const libRestify = require('restify');

const _Port = 8891;

let _Settings =
{
	Product: 'MCM-Example',
	ProductVersion: '0.0.1',
	APIServerPort: _Port,
	LogStreams:
	[
		{
			streamtype: 'console',
		},
	],
};

let _Fable = new libFable(_Settings);

// ── Orator (HTTP server) ──────────────────────────────────────────

_Fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
_Fable.serviceManager.instantiateServiceProvider('OratorServiceServer');
_Fable.serviceManager.addServiceType('Orator', libOrator);
let _Orator = _Fable.serviceManager.instantiateServiceProvider('Orator');

// ── Meadow Connection Manager ─────────────────────────────────────

_Fable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
_Fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

// ── Initialize and add routes ─────────────────────────────────────

_Orator.initialize(
	(pError) =>
	{
		if (pError)
		{
			_Fable.log.error('Orator initialization error: ' + pError.message);
			process.exit(1);
		}

		let tmpServer = _Fable.OratorServiceServer;

		// Enable JSON body parsing
		tmpServer.server.use(libRestify.plugins.bodyParser());

		// ── POST /test-connection ─────────────────────────────────
		// Accepts { Type: 'MySQL', Config: { server, port, ... } }
		// Returns { Success: true/false, Error: '...' }
		tmpServer.doPost('/test-connection',
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				let tmpType = tmpBody.Type;
				let tmpConfig = tmpBody.Config || {};

				if (!tmpType)
				{
					pResponse.send({ Success: false, Error: 'Type is required' });
					return fNext();
				}

				let tmpConnConfig = Object.assign({}, tmpConfig, { Type: tmpType });

				_Fable.MeadowConnectionManager.testConnection(tmpConnConfig,
					(pTestError, pResult) =>
					{
						if (pTestError)
						{
							pResponse.send({ Success: false, Error: pTestError.message });
							return fNext();
						}
						pResponse.send(pResult);
						return fNext();
					});
			});

		// ── Serve JS assets ───────────────────────────────────────
		let tmpPictMinJsPath = require.resolve('pict/dist/pict.min.js');
		let tmpBundlePath = libPath.join(__dirname, 'dist', 'pict-mcm-example-bookstore-connections.js');

		tmpServer.doGet('/js/pict.min.js',
			(pRequest, pResponse, fNext) =>
			{
				let tmpStream = require('fs').createReadStream(tmpPictMinJsPath);
				pResponse.setHeader('Content-Type', 'application/javascript');
				tmpStream.pipe(pResponse);
				tmpStream.on('end', fNext);
			});

		tmpServer.doGet('/js/app.js',
			(pRequest, pResponse, fNext) =>
			{
				let tmpStream = require('fs').createReadStream(tmpBundlePath);
				pResponse.setHeader('Content-Type', 'application/javascript');
				tmpStream.pipe(pResponse);
				tmpStream.on('end', fNext);
			});

		// ── Serve the bundled app ─────────────────────────────────
		// In dev mode, serve from html/ directly; after build, from dist/
		let tmpStaticPath = require('fs').existsSync(libPath.join(__dirname, 'dist'))
			? libPath.join(__dirname, 'dist')
			: libPath.join(__dirname, 'html');

		_Orator.addStaticRoute(tmpStaticPath, 'index.html', '/*', '/');

		// ── Start ─────────────────────────────────────────────────
		_Orator.startService(
			(pStartError) =>
			{
				if (pStartError)
				{
					_Fable.log.error('Failed to start: ' + pStartError.message);
					process.exit(1);
				}
				_Fable.log.info('MCM Example running at http://localhost:' + _Port);
			});
	});
