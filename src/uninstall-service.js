(function() {
    'use strict';

    const path = require('path');
    const Service = require('node-windows').Service;
    const {
        info,
        verbose } = require('./print.js');

    // Create a new service object.
    const svc = new Service({
        name: 'Update Dynamic DNS',
        script: `${path.join(__dirname, 'app.js')}`,
    });

    // Listen for the "uninstall" event so we know when it's done.
    svc.on('uninstall', () => {
        verbose('Service uninstalled.');
    });

    info('Uninstalling service, please accept UAC prompts if any...');
    svc.uninstall();
})();
