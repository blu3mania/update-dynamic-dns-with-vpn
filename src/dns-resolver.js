import dns from 'dns';

// Use Google, Cloudflare, and Quad9 DNS servers
dns.setServers([
    '8.8.8.8',
    '8.8.4.4',
    '1.1.1.1',
    '1.0.0.1',
    '9.9.9.9',
]);

export default class DnsResolver {
    constructor(host) {
        this.host = host;
    }

    resolve(addressFamily = 'IPv4', numRetries = 5, retryInterval = 10) {
        return new Promise((resolve, reject) => {
            let retries = 0;
            const queryDns = (async () => {
                let hasError = false;
                let errorMessage = '';
                const records = await dns.promises.resolve(this.host, addressFamily === 'IPv6' ? 'AAAA' : 'A')
                    .catch((error) => {
                        // dns.resolve errors with ENODATA if the AAAA (for IPv6) or A (for IPv4) record does not exist.
                        // If dns.lookup is used, it errors with ENOTFOUND when the OS does not have the domain's info.
                        if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
                            // Domain name not registered
                            resolve(null);
                        } else {
                            hasError = true;
                            errorMessage = error.message;
                        }
                        return [];
                    });

                if (hasError) {
                    if (retries++ < numRetries) {
                        setTimeout(() => queryDns(), retryInterval * 1000);
                    } else {
                        reject(`Cannot resolve DNS for ${this.host}: ${errorMessage}`);
                    }
                } else if (records.length == 0) {
                    resolve(null);
                } else {
                    resolve(records[0]);
                }
            });

            queryDns();
        });
    }
}
