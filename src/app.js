import * as url from 'url';
import path from 'path';
import notifier from 'node-notifier';

import {
    error,
    warning,
    info,
    verbose } from './print.js';
import DnsResolver from './dns-resolver.js';
import NetworkInterfaceMonitor from './network-interface-monitor.js';
import {
    DnsProvider,
    Dynu,
    FreeDNS,
    DuckDNS,
    YDNS,
    NoIP } from './dns-provider.js';
import settings from './settings.json' assert {type: 'json'};

const NotificationType = {
    DnsRegistration: 'dns registration',
    ScheduledDnsRegistration: 'scheduled dns registration',
    IpChanged: 'ip changed',
    IpAssigned: 'ip assigned',
    IpRemoved: 'ip removed',
};

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

let dnsProvider = null;
let currentRegisteredIP = null;
let ipToRegister = null;

const monitor = new NetworkInterfaceMonitor(settings.networkInterface, settings.addressFamily, (address, eventType) => {
    switch (eventType) {
        case NetworkInterfaceMonitor.EventType.Initial:
            // Initial callback
            if (address !== null) {
                info(`Current ${settings.addressFamily} address: ${address[settings.addressFamily]}`);
            } else {
                warning(`Network interface '${settings.networkInterface}' is inactive!`);
            }
            break;

        case NetworkInterfaceMonitor.EventType.IPChanged:
            info(`${settings.addressFamily} address changed: ${address[settings.addressFamily]}`);
            if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.IpChanged)) {
                sendDesktopNotification('IP Changed', `Network interface '${settings.networkInterface}' ${settings.addressFamily} address changed: ${address[settings.addressFamily]}`, 'ip-changed.png');
            }
            break;

        case NetworkInterfaceMonitor.EventType.IPAssigned:
            info(`Network interface '${settings.networkInterface}' is now active.`);
            info(`${settings.addressFamily} address assigned: ${address[settings.addressFamily]}`);
            if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.IpAssigned)) {
                sendDesktopNotification('IP Assigned', `Network interface '${settings.networkInterface}' ${settings.addressFamily} address assigned: ${address[settings.addressFamily]}`, 'ip-changed.png');
            }
            break;

        case NetworkInterfaceMonitor.EventType.IPRemoved:
            warning(`Network interface '${settings.networkInterface}' is now inactive!`);
            if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.IpRemoved)) {
                sendDesktopNotification('IP Removed', `Network interface '${settings.networkInterface}' is now inactive!`, 'ip-changed.png');
            }
            break;
    }

    if (dnsProvider !== null
        && address !== null && address[settings.addressFamily]
        && (
            (ipToRegister === null && currentRegisteredIP !== address[settings.addressFamily])
            || (ipToRegister !== null && ipToRegister !== address[settings.addressFamily])
        )) {
        ipToRegister = address[settings.addressFamily];
        info(`Registering domain ${settings.domainName} with IP ${ipToRegister}...`);
        dnsProvider.register(ipToRegister, settings.addressFamily, (data, eventType) => {
            switch (eventType) {
                case DnsProvider.EventType.Registered:
                    ipToRegister = null;
                    currentRegisteredIP = data;
                    info(`Registered ${settings.addressFamily} address ${currentRegisteredIP}`);
                    if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.DnsRegistration)) {
                        sendDesktopNotification('DNS Registration Updated', `Updated domain ${settings.domainName} with IP ${currentRegisteredIP}`, 'dns-updated.png');
                    }
                    break;

                case DnsProvider.EventType.RegistrationScheduled:
                    const waitTime = Math.round(data / 1000);
                    warning(`Last IP registration just happened so next one is deferred. Waiting for ${waitTime < 1 ? 'less than 1' : waitTime} second${waitTime > 1 ? 's' : ''} before calling provider...`);
                    if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.ScheduledDnsRegistration)) {
                        sendDesktopNotification('DNS Registration Scheduled', `Will update domain ${settings.domainName} with IP ${ipToRegister} in ${waitTime} seconds.`, 'dns-update-scheduled.png');
                    }
                    break;

                case DnsProvider.EventType.Failed:
                    ipToRegister = null;
                    error(`Registration failed due to error: ${data}`);
                    if (settings.showNotification && settings.notificationTypes.find(type => type.toLowerCase() === NotificationType.DnsRegistration)) {
                        sendDesktopNotification('DNS Registration Failure', `Failed to update domain ${settings.domainName}!`, 'dns-update-failure.png');
                    }
                    break;
            }
        });
    }
});

main();

function main() {
    verbose('Starting...');

    switch (settings.dnsProvider.toLowerCase()) {
        case DnsProvider.Vendor.Dynu:
            dnsProvider = new Dynu(settings.domainName, settings.domainID, settings.accessKey);
            break;

        case DnsProvider.Vendor.FreeDNS:
            dnsProvider = new FreeDNS(settings.domainName, settings.domainID, settings.accessKey);
            break;

        case DnsProvider.Vendor.DuckDNS:
            dnsProvider = new DuckDNS(settings.domainName, settings.domainID, settings.accessKey);
            break;

        case DnsProvider.Vendor.YDNS:
            dnsProvider = new YDNS(settings.domainName, settings.domainID, settings.accessKey);
            break;

        case DnsProvider.Vendor.NoIP:
            dnsProvider = new NoIP(settings.domainName, settings.domainID, settings.accessKey);
            break;
    }

    if (dnsProvider !== null) {
        verbose(`DNS provider specified: ${settings.dnsProvider}.`);
    } else if (settings.dnsProvider.length > 0) {
        warning(`Invalid DNS provider specified: ${settings.dnsProvider}. Running in monitor-only mode...`);
    } else {
        info('DNS provider not specified. Running in monitor-only mode...');
    }

    if (dnsProvider !== null && settings.domainName.length > 0) {
        verbose(`Checking current registered IP for ${settings.domainName}...`);
        new DnsResolver(settings.domainName).resolve(settings.addressFamily)
            .then((ip) => {
                currentRegisteredIP = ip;
                if (ip !== null) {
                    info(`Current registered ${settings.addressFamily} address for ${settings.domainName} is ${ip}`);
                } else {
                    warning(`${settings.domainName} is not registered to any IP!`);
                }
                startMonitoring();
            })
            .catch((err) => {
                error(err);
                startMonitoring();
            });
    } else {
        startMonitoring();
    }

    process.on('SIGINT', () => {
        warning('SIGINT received, exiting...');
        stopMonitoring();
        process.exit();
    });

    // Use a no-op timer to keep the process running.
    setInterval(() => {}, 60 * 60 * 1000);
}

function startMonitoring() {
    verbose(`Monitoring for changes in interface "${settings.networkInterface}" for IP address family ${settings.addressFamily}...`);
    if (!monitor.start()) {
        error('Failed to start network interface monitor. Exiting...');
        process.exit(-1);
    }
}

function stopMonitoring() {
    verbose(`Stop monitoring for changes in interface "${settings.networkInterface}" for IP address family ${settings.addressFamily}.`);
    if (!monitor.stop()) {
        error('Failed to stop network interface monitor.');
    }
}

function sendDesktopNotification(title, message, icon) {
    notifier.notify({
        title: title,
        message: message,
        appID: 'Update Dynamic DNS',
        icon: getImagePath(icon),
    });
}

function getImagePath(imageFile) {
    return path.join(__dirname, 'images', imageFile);
}
