(function() {
    'use strict';

    const path = require('path');
    const Service = require('node-windows').Service;
    const {
        warning,
        info,
        verbose } = require('./print.js');

    // Create a new service object.
    const svc = new Service({
        name: 'Update Dynamic DNS',
        description: 'Auto update a dynamic DNS registration based on a given network interface.',
        script: `${path.join(__dirname, 'app.js')}`,
        nodeOptions: [
            '--harmony',
            '--max_old_space_size=4096'
        ]
    });

    // Listen for the "install" event, which indicates the process is available as a service.
    svc.on('install', () => {
        verbose('Service installed.');
        info('Starting service, please accept UAC prompts if any...');
        svc.start();
    });

    svc.on('start', () => {
        verbose('Service started.');
    });

    svc.on('alreadyinstalled', () => {
        warning('Service is already installed!');
        info('Starting the service in case it is not running, please accept UAC prompts if any...');
        svc.start();
    });

    info('Installing service, please accept UAC prompts if any...');
    svc.install();
})();
