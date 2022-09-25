import http from 'http';
import https from 'https';
import os from 'os';

//import { print } from './print.js';
import packageJson from '../package.json' assert {type: 'json'};

const Vendor = {
    Dynu: 'dynu',
    FreeDNS: 'freedns',
    DuckDNS: 'duckdns',
    YDNS: 'ydns',
    NoIP: 'noip',
};

const EventType = {
    Registered: 0,
    RegistrationScheduled: 1,
    Failed: 2,
};

class DnsProvider {
    constructor(domainName, domainID, accessKey) {
        this.domainName = domainName;
        this.domainID = domainID;
        this.accessKey = accessKey;
        this.lastRegistrationTime = null;
        this.registrationTimer = null;
    }

    static get Vendor() {
        return Vendor;
    }

    static get EventType() {
        return EventType;
    }

    get registrationInterval() {
        // By default, do not attempt another registration within 2 minutes.
        return 2 * 60 * 1000;
    }

    get useHttps() {
        // By default, use HTTPS.
        return true;
    }

    get method() {
        return 'GET';
    }

    get headers() {
        return {};
    }

    getData(ip, addressFamily) {
        return null;
    }

    register(ip, addressFamily, callback) {
        // Check last registration time to make sure we are not registering too often.
        if (this.lastRegistrationTime === null || new Date(this.lastRegistrationTime.valueOf() + this.registrationInterval) < new Date()) {
            this.performRegistration(ip, addressFamily)
                .then((resp) => callback(ip, EventType.Registered))
                .catch((error) => callback(error, EventType.Failed));
        } else {
            if (this.registrationTimer !== null) {
                clearTimeout(this.registrationTimer);
                this.registrationTimer = null;
            }

            let waitTime = this.lastRegistrationTime.valueOf() + this.registrationInterval - new Date().valueOf();
            if (waitTime < 0) {
                waitTime = 0;
            }
            callback(waitTime, EventType.RegistrationScheduled);
            this.registrationTimer = setTimeout(() => {
                this.performRegistration(ip, addressFamily)
                    .then((resp) => callback(ip, EventType.Registered))
                    .catch((error) => callback(error, EventType.Failed));
            }, waitTime);
        }
    }

    performRegistration(ip, addressFamily) {
        this.registrationTimer = null;

        // Set the registration time now to prevent registration again while waiting for response.
        // It will be updated again when response is received.
        this.lastRegistrationTime = new Date();
        const request = {
            https: this.useHttps,
            options: {
                host: this.getHost(addressFamily),
                path: this.getPath(ip, addressFamily),
                method: this.method,
                headers: this.headers,
                agent: false,
            },
            data: this.getData(ip, addressFamily),
        };
        return this.sendRequest(request)
            .then((resp) => {
                this.lastRegistrationTime = new Date();
                return Promise.resolve(resp);
            })
            .catch((error) => {
                this.lastRegistrationTime = new Date();
                return Promise.reject(error);
            });
    }

    sendRequest(request) {
        return new Promise((resolve, reject) => {
            // Provide User Agent if not already specified.
            if (!request.options.headers['User-Agent']) {
                request.options.headers['User-Agent'] = `${packageJson.name}/${packageJson.version} (${os.platform()} ${os.release()}) ${packageJson.author}`;
            }

            // Make sure Content-Length is provided when sending data.
            if (request.data) {
                if (!request.options.headers['Content-Length']) {
                    request.options.headers['Content-Length'] = Buffer.byteLength(request.data);
                }
            }
            //print(request);

            const req = (request.https ? https : http).request(request.options)
                .on('timeout', () => {
                    req.abort();
                    reject('Http request timed out');
                })
                .on('abort', () => reject('Http request aborted'))
                .on('error', (error) => reject(`Http request errored - ${error.message}`))
                .on('close', () => reject('Http request closed'))
                .on('response', (response) => {
                    const code = response.statusCode || 0;
                    if (code >= 200 && code < 300) {
                        const dataSequence = [];
                        response
                            .on('aborted', () => reject('Http request aborted'))
                            .on('error', (error) => reject(`Http request errored - ${error.message}`))
                            .on('data', (data) => dataSequence.push(data))
                            .on('end', () => resolve(Buffer.concat(dataSequence)));
                    }
                    else if (code >= 400 && code < 500) {
                        reject(`Http status ${code}, check if your access key and domain name/ID in settings.json are correct.`);
                    }
                    else {
                        reject(`Http status ${code}`);
                    }
                });
            if (request.data) {
                req.write(request.data);
            }
            req.end();
        });
    }
}

class Dynu extends DnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    get method() {
        return 'POST';
    }

    get headers() {
        return {
            'Content-Type': 'application/json',
            'API-Key': this.accessKey,
        };
    }

    getHost(addressFamily) {
        return 'api.dynu.com';
    }

    getPath(ip, addressFamily) {
        return `/v2/dns/${this.domainID}`;
    }

    getData(ip, addressFamily) {
        return `{ "name": "${this.domainName}", "${addressFamily === 'IPv6' ? 'ipv6' : 'ipv4'}Address": "${ip}" }`;
    }
}

class FreeDNS extends DnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    get useHttps() {
        return false;
    }

    getHost(addressFamily) {
        return addressFamily === 'IPv6' ? 'v6.sync.afraid.org' : 'sync.afraid.org';
    }

    getPath(ip, addressFamily) {
        return `/u/${this.accessKey}/?address=${ip}`;
    }
}

class DuckDNS extends DnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    getHost(addressFamily) {
        return 'www.duckdns.org';
    }

    getPath(ip, addressFamily) {
        return `/update?domains=${this.domainID}&token=${this.accessKey}&${addressFamily === 'IPv6' ? 'ipv6' : 'ip'}=${ip}`;
    }
}

class BasicAuthorizationDnsProvider extends DnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    get headers() {
        return {
            'Authorization': `Basic ${Buffer.from(this.accessKey).toString('base64')}`,
        };
    }
}

class YDNS extends BasicAuthorizationDnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    getHost(addressFamily) {
        return 'ydns.io';
    }

    getPath(ip, addressFamily) {
        return `/api/v1/update/?host=${this.domainName}&ip=${ip}`;
    }
}

class NoIP extends BasicAuthorizationDnsProvider {
    constructor(domainName, domainID, accessKey) {
        super(domainName, domainID, accessKey);
    }

    getHost(addressFamily) {
        return 'dynupdate.no-ip.com';
    }

    getPath(ip, addressFamily) {
        return `/nic/update?hostname=${this.domainName}&${addressFamily === 'IPv6' ? 'myipv6' : 'myip'}=${ip}`;
    }
}

export {
    DnsProvider,
    Dynu,
    FreeDNS,
    DuckDNS,
    YDNS,
    NoIP,
};
