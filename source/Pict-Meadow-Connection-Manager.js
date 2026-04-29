/**
 * pict-meadow-connection-manager
 *
 * Browser-safe Pict module for managing **named** meadow database
 * connections.  This module owns the *manager-shell* concerns —
 * a list of saved connections, a detail editor, name + status fields,
 * Save/Test/Cancel buttons, plus a Pict provider for state + CRUD.
 *
 * The per-provider field rendering is **not** in this module — that's
 * delegated to `pict-section-connection-form`, which consumes the same
 * connection-form schemas exported by every `meadow-connection-*`
 * module (`Meadow-Connection-<Type>-FormSchema.js`) and aggregated
 * server-side via `meadow-connection-manager#getAllProviderFormSchemas()`.
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  pict-meadow-connection-manager                            │
 *   │   ├─ PictProviderConnectionManager  state + CRUD + tests   │
 *   │   ├─ PictViewConnectionList         list of saved conns    │
 *   │   └─ PictViewConnectionDetail       editor (name + slot)   │
 *   │                                              │             │
 *   │                                              ▼ slot        │
 *   │                              pict-section-connection-form  │
 *   │                                schema-driven form          │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Hosts wire it like this:
 *
 *   const libMCM = require('pict-meadow-connection-manager');
 *   const libConnForm = require('pict-section-connection-form');
 *
 *   pict.addProviderSingleton('MeadowConnectionManager',
 *       libMCM.PictProviderConnectionManager.default_configuration,
 *       libMCM.PictProviderConnectionManager);
 *   pict.addView('MCM-ConnectionList',
 *       libMCM.PictViewConnectionList.default_configuration,
 *       libMCM.PictViewConnectionList);
 *   pict.addView('MCM-ConnectionDetail',
 *       libMCM.PictViewConnectionDetail.default_configuration,
 *       libMCM.PictViewConnectionDetail);
 *   pict.addView('PictSection-ConnectionForm',
 *       Object.assign({}, libConnForm.default_configuration,
 *           {
 *               ContainerSelector: '#MCM-ConnectionConfig-Container',
 *               FieldIDPrefix:     'mcm-conn'
 *           }),
 *       libConnForm);
 *
 *   // Then once schemas arrive (typically from your server's
 *   //  /<app>/connection/schemas endpoint):
 *   pict.providers.MeadowConnectionManager.setSchemas(schemas);
 *
 * The module also re-exports `PictSectionConnectionForm` for hosts that
 * want to grab everything from one require().
 *
 * @module pict-meadow-connection-manager
 */
'use strict';

const libPictProviderConnectionManager = require('./PictProvider-ConnectionManager.js');
const libPictViewConnectionList        = require('./views/PictView-ConnectionList.js');
const libPictViewConnectionDetail      = require('./views/PictView-ConnectionDetail.js');
const libPictSectionConnectionForm     = require('pict-section-connection-form');

module.exports =
{
	// State + CRUD provider
	PictProviderConnectionManager: libPictProviderConnectionManager,

	// Manager-shell views
	PictViewConnectionList:   libPictViewConnectionList,
	PictViewConnectionDetail: libPictViewConnectionDetail,

	// Convenience re-export — hosts that want to register the form
	// view in one require() instead of two.
	PictSectionConnectionForm: libPictSectionConnectionForm,
};
