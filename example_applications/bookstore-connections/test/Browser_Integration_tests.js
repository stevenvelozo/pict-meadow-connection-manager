/**
 * Headless browser integration tests for the bookstore-connections example.
 *
 * Exercises the full pict-meadow-connection-manager UI:
 *   - Connection list rendering
 *   - Edit / type switching / cancel
 *   - Add / remove connections
 *   - Positive connection tests (good credentials → OK)
 *   - Negative connection tests (bad credentials → Failed)
 *   - Save flow
 *
 * Requires:
 *   npm run build                  (quackage bundles the client app)
 *   docker compose up -d           (for MySQL/PostgreSQL tests; SQLite always works)
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */

'use strict';

const Chai = require('chai');
const Expect = Chai.expect;

const libHTTP = require('http');
const libFS = require('fs');
const libPath = require('path');
const libNet = require('net');

const _PackageRoot = libPath.resolve(__dirname, '..');
const _DistDir = libPath.join(_PackageRoot, 'dist');
const _HtmlDir = libPath.join(_PackageRoot, 'html');
const _PictDistDir = libPath.join(_PackageRoot, 'node_modules', 'pict', 'dist');

// ══════════════════════════════════════════════════════════════
//  Test server: serves static assets + POST /test-connection
// ══════════════════════════════════════════════════════════════

const libMeadowConnectionManager = require('meadow-connection-manager');
const libFable = require('fable');

function startTestServer(fCallback)
{
	let tmpMimeTypes =
	{
		'.html': 'text/html',
		'.js': 'application/javascript',
		'.css': 'text/css',
		'.map': 'application/json',
	};

	// A minimal Fable for the connection manager (server-side)
	let tmpFable = new libFable(
	{
		Product: 'MCM-Test-Server',
		LogStreams: [{ streamtype: 'console', level: 'warn' }],
	});
	tmpFable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
	tmpFable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

	let tmpServer = libHTTP.createServer(
		(pRequest, pResponse) =>
		{
			let tmpUrl = pRequest.url;

			// ── POST /test-connection ─────────────────────────
			if (pRequest.method === 'POST' && tmpUrl === '/test-connection')
			{
				let tmpBody = '';
				pRequest.on('data', (pChunk) => { tmpBody += pChunk; });
				pRequest.on('end', () =>
				{
					let tmpParsed = {};
					try { tmpParsed = JSON.parse(tmpBody); }
					catch (e) { /* ignore */ }

					let tmpType = tmpParsed.Type;
					let tmpConfig = tmpParsed.Config || {};

					if (!tmpType)
					{
						pResponse.writeHead(200, { 'Content-Type': 'application/json' });
						pResponse.end(JSON.stringify({ Success: false, Error: 'Type is required' }));
						return;
					}

					let tmpConnConfig = Object.assign({}, tmpConfig, { Type: tmpType });

					tmpFable.MeadowConnectionManager.testConnection(tmpConnConfig,
						(pTestError, pResult) =>
						{
							pResponse.writeHead(200, { 'Content-Type': 'application/json' });
							if (pTestError)
							{
								pResponse.end(JSON.stringify({ Success: false, Error: pTestError.message }));
							}
							else
							{
								pResponse.end(JSON.stringify(pResult));
							}
						});
				});
				return;
			}

			// ── GET / or /index.html ──────────────────────────
			if (tmpUrl === '/' || tmpUrl === '/index.html')
			{
				serveFile(libPath.join(_HtmlDir, 'index.html'), pResponse, tmpMimeTypes);
				return;
			}

			// ── GET /js/pict.min.js ───────────────────────────
			if (tmpUrl === '/js/pict.min.js')
			{
				serveFile(libPath.join(_PictDistDir, 'pict.min.js'), pResponse, tmpMimeTypes);
				return;
			}

			// ── GET /js/app.js ────────────────────────────────
			if (tmpUrl === '/js/app.js')
			{
				let tmpBundleName = 'pict-mcm-example-bookstore-connections.js';
				serveFile(libPath.join(_DistDir, tmpBundleName), pResponse, tmpMimeTypes);
				return;
			}

			pResponse.writeHead(404);
			pResponse.end('Not Found');
		});

	tmpServer.listen(0, '127.0.0.1',
		() =>
		{
			let tmpPort = tmpServer.address().port;
			return fCallback(null, tmpServer, tmpPort);
		});
}

function serveFile(pFilePath, pResponse, pMimeTypes)
{
	if (!libFS.existsSync(pFilePath))
	{
		pResponse.writeHead(404);
		pResponse.end('File not found: ' + pFilePath);
		return;
	}

	let tmpExt = libPath.extname(pFilePath);
	let tmpContentType = pMimeTypes[tmpExt] || 'application/octet-stream';

	let tmpContent = libFS.readFileSync(pFilePath);
	pResponse.writeHead(200, { 'Content-Type': tmpContentType });
	pResponse.end(tmpContent);
}

// ══════════════════════════════════════════════════════════════
//  Docker availability check
// ══════════════════════════════════════════════════════════════

function checkPort(pHost, pPort, fCallback)
{
	let tmpSocket = new libNet.Socket();
	let tmpTimedOut = false;

	tmpSocket.setTimeout(2000);
	tmpSocket.on('connect',
		() =>
		{
			tmpSocket.destroy();
			fCallback(true);
		});
	tmpSocket.on('timeout',
		() =>
		{
			tmpTimedOut = true;
			tmpSocket.destroy();
			fCallback(false);
		});
	tmpSocket.on('error',
		() =>
		{
			if (!tmpTimedOut)
			{
				fCallback(false);
			}
		});
	tmpSocket.connect(pPort, pHost);
}

// ══════════════════════════════════════════════════════════════
//  Helper: click a button inside a row matching connection name
// ══════════════════════════════════════════════════════════════

async function clickRowButton(pPage, pConnectionName, pButtonText)
{
	await pPage.evaluate(
		(pName, pBtnText) =>
		{
			let tmpRows = document.querySelectorAll('.mcm-connection-row');
			for (let i = 0; i < tmpRows.length; i++)
			{
				let tmpNameEl = tmpRows[i].querySelector('.mcm-conn-name');
				if (tmpNameEl && tmpNameEl.textContent.trim() === pName)
				{
					let tmpButtons = tmpRows[i].querySelectorAll('button');
					for (let j = 0; j < tmpButtons.length; j++)
					{
						if (tmpButtons[j].textContent.trim() === pBtnText)
						{
							tmpButtons[j].click();
							return;
						}
					}
				}
			}
			throw new Error('Button "' + pBtnText + '" not found in row "' + pName + '"');
		}, pConnectionName, pButtonText);
}

/**
 * Click the Test Connection button in the detail view and wait for status to update.
 * Returns the new status text.
 */
async function clickTestAndWaitForStatus(pPage)
{
	// Clear current status to detect the change
	await pPage.evaluate(() =>
	{
		let tmpStatusEl = document.querySelector('.mcm-connection-detail .mcm-conn-status');
		if (tmpStatusEl)
		{
			tmpStatusEl.setAttribute('data-prev', tmpStatusEl.textContent);
		}
	});

	// Click "Test Connection"
	await pPage.evaluate(() =>
	{
		let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
		for (let i = 0; i < tmpButtons.length; i++)
		{
			if (tmpButtons[i].textContent.trim() === 'Test Connection')
			{
				tmpButtons[i].click();
				return;
			}
		}
		throw new Error('Test Connection button not found');
	});

	// Wait for the detail view to re-render with a new status (up to 15 seconds)
	await pPage.waitForFunction(
		() =>
		{
			let tmpStatusEl = document.querySelector('.mcm-connection-detail .mcm-conn-status');
			if (!tmpStatusEl) return false;
			let tmpText = tmpStatusEl.textContent;
			return tmpText.includes('OK') || tmpText.includes('Failed') || tmpText.includes('Error');
		},
		{ timeout: 15000 });

	return await pPage.$eval('.mcm-connection-detail .mcm-conn-status',
		(pEl) => pEl.textContent.trim());
}

/**
 * Set a config input field value and update AppData directly.
 * Uses both DOM manipulation and direct AppData write to ensure
 * the value is propagated regardless of event handling.
 */
async function setConfigField(pPage, pFieldName, pValue)
{
	await pPage.evaluate(
		(pField, pVal) =>
		{
			// Update DOM input
			let tmpInput = document.getElementById('MCM-Config-' + pField);
			if (tmpInput)
			{
				tmpInput.value = pVal;
			}

			// Directly update AppData (the source of truth)
			let tmpPict = window._Pict || window.pict;
			if (tmpPict && tmpPict.AppData && tmpPict.AppData.MCM && tmpPict.AppData.MCM.CurrentConnection)
			{
				if (!tmpPict.AppData.MCM.CurrentConnection.Config)
				{
					tmpPict.AppData.MCM.CurrentConnection.Config = {};
				}
				// Parse numbers
				let tmpParsed = pVal;
				if (tmpInput && tmpInput.type === 'number')
				{
					tmpParsed = parseInt(pVal, 10);
				}
				tmpPict.AppData.MCM.CurrentConnection.Config[pField] = tmpParsed;
			}
		}, pFieldName, String(pValue));
}

// ══════════════════════════════════════════════════════════════
//  Test suite
// ══════════════════════════════════════════════════════════════

suite
(
	'Browser-Integration',
	function ()
	{
		this.timeout(120000);

		let _Server;
		let _Port;
		let _Browser;
		let _Page;
		let _Puppeteer;
		let _MySQLAvailable = false;
		let _PostgreSQLAvailable = false;

		suiteSetup
		(
			function (fDone)
			{
				// Verify dist/ exists
				let tmpBundlePath = libPath.join(_DistDir, 'pict-mcm-example-bookstore-connections.js');
				if (!libFS.existsSync(tmpBundlePath))
				{
					return fDone(new Error(
						'dist/pict-mcm-example-bookstore-connections.js not found. Run "npm run build" first.'));
				}

				if (!libFS.existsSync(libPath.join(_PictDistDir, 'pict.min.js')))
				{
					return fDone(new Error(
						'node_modules/pict/dist/pict.min.js not found. Run "npm install" first.'));
				}

				// Start the test server
				startTestServer(
					(pError, pServer, pPort) =>
					{
						if (pError) return fDone(pError);

						_Server = pServer;
						_Port = pPort;

						// Load puppeteer
						try
						{
							_Puppeteer = require('puppeteer');
						}
						catch (pRequireError)
						{
							_Server.close();
							return fDone(new Error('puppeteer is not installed.'));
						}

						// Check Docker availability for MySQL (23306) and PostgreSQL (25432)
						checkPort('127.0.0.1', 23306,
							(pMySQLUp) =>
							{
								_MySQLAvailable = pMySQLUp;
								checkPort('127.0.0.1', 25432,
									(pPgUp) =>
									{
										_PostgreSQLAvailable = pPgUp;

										if (!_MySQLAvailable)
										{
											console.log('    [info] MySQL not available on port 23306 — MySQL tests will be skipped');
										}
										if (!_PostgreSQLAvailable)
										{
											console.log('    [info] PostgreSQL not available on port 25432 — PostgreSQL tests will be skipped');
										}

										// Launch browser
										_Puppeteer.launch(
										{
											headless: true,
											args: ['--no-sandbox', '--disable-setuid-sandbox'],
										})
										.then(
											(pBrowser) =>
											{
												_Browser = pBrowser;
												return _Browser.newPage();
											})
										.then(
											(pPage) =>
											{
												_Page = pPage;

												pPage.on('console',
													(pMsg) =>
													{
														if (pMsg.type() === 'error')
														{
															console.log('  [browser error]', pMsg.text());
														}
													});

												pPage.on('pageerror',
													(pErr) =>
													{
														console.log('  [browser page error]', pErr.message);
													});

												// Navigate to the app
												return pPage.goto(
													`http://127.0.0.1:${_Port}/`,
													{ waitUntil: 'networkidle0', timeout: 30000 });
											})
										.then(() => fDone())
										.catch(fDone);
									});
							});
					});
			}
		);

		suiteTeardown
		(
			function (fDone)
			{
				let tmpSteps = [];

				if (_Browser)
				{
					tmpSteps.push(_Browser.close().catch(() => {}));
				}

				Promise.all(tmpSteps).then(
					() =>
					{
						if (_Server)
						{
							_Server.close(fDone);
						}
						else
						{
							fDone();
						}
					});
			}
		);

		// ─────────────────────────────────────────────────
		//  UI Flow tests
		// ─────────────────────────────────────────────────

		test
		(
			'App initializes with 3 connections in the list',
			async function ()
			{
				let tmpRowCount = await _Page.$$eval('.mcm-connection-row', (pRows) => pRows.length);
				Expect(tmpRowCount).to.equal(3);
			}
		);

		test
		(
			'Connection list shows correct names',
			async function ()
			{
				let tmpNames = await _Page.$$eval('.mcm-conn-name',
					(pEls) => pEls.map((pEl) => pEl.textContent.trim()));
				Expect(tmpNames).to.include('Bookstore MySQL');
				Expect(tmpNames).to.include('Bookstore PostgreSQL');
				Expect(tmpNames).to.include('In-Memory SQLite');
			}
		);

		test
		(
			'Edit SQLite connection shows SQLiteFilePath field',
			async function ()
			{
				await clickRowButton(_Page, 'In-Memory SQLite', 'Edit');

				// Wait for detail view to appear
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				// The SQLite config should have the SQLiteFilePath input
				let tmpFieldExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-SQLiteFilePath'));
				Expect(tmpFieldExists).to.be.true;

				// The server/port/user fields should NOT be present
				let tmpServerExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-server'));
				Expect(tmpServerExists).to.be.false;
			}
		);

		test
		(
			'Type switching changes config fields',
			async function ()
			{
				// Change type to MySQL
				await _Page.select('#MCM-ConnectionDetail-Type', 'MySQL');
				// Trigger the onchange
				await _Page.evaluate(() =>
				{
					let tmpSelect = document.getElementById('MCM-ConnectionDetail-Type');
					tmpSelect.dispatchEvent(new Event('change', { bubbles: true }));
				});

				// Wait for the MySQL fields to appear
				await _Page.waitForSelector('#MCM-Config-server', { timeout: 5000 });

				let tmpServerExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-server'));
				Expect(tmpServerExists).to.be.true;

				let tmpPortExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-port'));
				Expect(tmpPortExists).to.be.true;

				let tmpPasswordExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-password'));
				Expect(tmpPasswordExists).to.be.true;

				// SQLite field should be gone
				let tmpFilePathExists = await _Page.evaluate(
					() => !!document.getElementById('MCM-Config-SQLiteFilePath'));
				Expect(tmpFilePathExists).to.be.false;
			}
		);

		test
		(
			'Cancel hides the detail view',
			async function ()
			{
				// Click Cancel
				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel')
						{
							tmpButtons[i].click();
							return;
						}
					}
				});

				// Small delay for re-render
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));

				// Detail container should be empty or not present
				let tmpDetailContent = await _Page.$eval('#MCM-ConnectionDetail-Container',
					(pEl) => pEl.innerHTML.trim());
				Expect(tmpDetailContent).to.equal('');
			}
		);

		test
		(
			'Add connection creates a new entry in the list',
			async function ()
			{
				// Click "Add Connection"
				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-btn-add');
					if (tmpButtons.length > 0) tmpButtons[0].click();
				});

				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

				let tmpRowCount = await _Page.$$eval('.mcm-connection-row', (pRows) => pRows.length);
				Expect(tmpRowCount).to.equal(4);

				// The new connection should have default name "New Connection"
				let tmpNames = await _Page.$$eval('.mcm-conn-name',
					(pEls) => pEls.map((pEl) => pEl.textContent.trim()));
				Expect(tmpNames).to.include('New Connection');
			}
		);

		test
		(
			'Remove connection removes it from the list',
			async function ()
			{
				await clickRowButton(_Page, 'New Connection', 'Remove');

				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

				let tmpRowCount = await _Page.$$eval('.mcm-connection-row', (pRows) => pRows.length);
				Expect(tmpRowCount).to.equal(3);

				let tmpNames = await _Page.$$eval('.mcm-conn-name',
					(pEls) => pEls.map((pEl) => pEl.textContent.trim()));
				Expect(tmpNames).to.not.include('New Connection');
			}
		);

		// ─────────────────────────────────────────────────
		//  Positive connection tests (good credentials)
		// ─────────────────────────────────────────────────

		test
		(
			'SQLite :memory: test connection succeeds',
			async function ()
			{
				await clickRowButton(_Page, 'In-Memory SQLite', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('OK');

				// Cancel out
				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		test
		(
			'MySQL bookstore test connection succeeds (requires Docker)',
			async function ()
			{
				if (!_MySQLAvailable)
				{
					this.skip();
					return;
				}

				await clickRowButton(_Page, 'Bookstore MySQL', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('OK');

				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		test
		(
			'PostgreSQL testdb test connection succeeds (requires Docker)',
			async function ()
			{
				if (!_PostgreSQLAvailable)
				{
					this.skip();
					return;
				}

				await clickRowButton(_Page, 'Bookstore PostgreSQL', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('OK');

				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		// ─────────────────────────────────────────────────
		//  Negative connection tests (bad credentials)
		// ─────────────────────────────────────────────────

		test
		(
			'MySQL bad password fails',
			async function ()
			{
				if (!_MySQLAvailable)
				{
					this.skip();
					return;
				}

				await clickRowButton(_Page, 'Bookstore MySQL', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				// Change password to "wrong"
				await setConfigField(_Page, 'password', 'wrong');

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('Failed');

				// Restore and cancel
				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		test
		(
			'PostgreSQL bad password fails',
			async function ()
			{
				if (!_PostgreSQLAvailable)
				{
					this.skip();
					return;
				}

				await clickRowButton(_Page, 'Bookstore PostgreSQL', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				await setConfigField(_Page, 'password', 'wrong');

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('Failed');

				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		test
		(
			'MySQL wrong port fails',
			async function ()
			{
				if (!_MySQLAvailable)
				{
					this.skip();
					return;
				}

				await clickRowButton(_Page, 'Bookstore MySQL', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				await setConfigField(_Page, 'port', '19999');

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('Failed');

				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		test
		(
			'SQLite bad path fails',
			async function ()
			{
				await clickRowButton(_Page, 'In-Memory SQLite', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				await setConfigField(_Page, 'SQLiteFilePath', '/nonexistent/path/to/db.sqlite');

				let tmpStatus = await clickTestAndWaitForStatus(_Page);
				Expect(tmpStatus).to.include('Failed');

				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Cancel') { tmpButtons[i].click(); return; }
					}
				});
				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
			}
		);

		// ─────────────────────────────────────────────────
		//  Save flow
		// ─────────────────────────────────────────────────

		test
		(
			'Save updates the connection name in the list',
			async function ()
			{
				await clickRowButton(_Page, 'In-Memory SQLite', 'Edit');
				await _Page.waitForSelector('.mcm-connection-detail', { timeout: 5000 });

				// Change the name
				await _Page.evaluate(() =>
				{
					let tmpInput = document.getElementById('MCM-ConnectionDetail-Name');
					tmpInput.value = 'Renamed SQLite';
					tmpInput.dispatchEvent(new Event('change', { bubbles: true }));
				});

				// Click Save
				await _Page.evaluate(() =>
				{
					let tmpButtons = document.querySelectorAll('.mcm-detail-actions button');
					for (let i = 0; i < tmpButtons.length; i++)
					{
						if (tmpButtons[i].textContent.trim() === 'Save')
						{
							tmpButtons[i].click();
							return;
						}
					}
				});

				await _Page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

				// Verify the list now shows the updated name
				let tmpNames = await _Page.$$eval('.mcm-conn-name',
					(pEls) => pEls.map((pEl) => pEl.textContent.trim()));
				Expect(tmpNames).to.include('Renamed SQLite');
				Expect(tmpNames).to.not.include('In-Memory SQLite');
			}
		);
	}
);
