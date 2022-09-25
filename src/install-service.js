import * as url from 'url';
import path from 'path';
import { Service } from 'node-windows';

import {
    warning,
    info,
    verbose } from './print.js';
import settings from './settings.json' assert {type: 'json'};

main();

function main() {
    // Create a new service object.
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    const svc = new Service({
        name: settings.service?.name ?? 'Update Dynamic DNS',
        description: 'Automatically update a dynamic DNS registration based on a given network interface, such as VPN.',
        script: `${path.join(__dirname, 'app.js')}`,
        nodeOptions: [
            '--harmony',
            '--max_old_space_size=4096'
        ]
    });

    if (settings.service?.account?.name && settings.service?.account?.password) {
        svc.logOnAs.account = settings.service.account.name;
        svc.logOnAs.password = settings.service.account.password;
        if (settings.service?.account?.domain) {
            svc.logOnAs.domain = settings.service.account.domain;
        }
    }

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
}
