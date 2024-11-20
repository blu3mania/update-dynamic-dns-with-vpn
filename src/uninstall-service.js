import path from 'path';
import url from 'url';

import { Service } from 'node-windows';

import {
    info,
    verbose } from './print.js';
import settings from './settings.json' with {type: 'json'};

main();

function main() {
    // Create a new service object.
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    const svc = new Service({
        name: settings.service?.name ?? 'Update Dynamic DNS',
        script: `${path.join(__dirname, 'app.js')}`,
    });

    // Listen for the "uninstall" event so we know when it's done.
    svc.on('uninstall', () => {
        verbose('Service uninstalled.');
    });

    info('Uninstalling service, please accept UAC prompts if any...');
    svc.uninstall();
}
