# update-dynamic-dns-with-vpn
[![Apache 2.0 License](https://img.shields.io/badge/License-Apache%202.0-yellow)](https://raw.githubusercontent.com/blu3mania/update-dynamic-dns-with-vpn/main/LICENSE)
[![node.js 18+](https://img.shields.io/badge/node.js-18.0.0-blue?logo=node.js)](https://nodejs.org/en/)
[![Latest Release](https://img.shields.io/github/v/release/blu3mania/update-dynamic-dns-with-vpn)](https://github.com/blu3mania/update-dynamic-dns-with-vpn/releases/latest)

Automatically update a dynamic DNS registration based on a given network interface, such as VPN. **Note**,
it does not update dynamic DNS with your public IP. If that's what you are looking for, there are already
many other apps doing just that.

It can be run as a standalone application or as a Windows service. When running in standalone mode, it can
also be used to just monitor a network interface without auto DNS update.

**Note**, this package is written as ES Module starting with 2.0. For CommonJS version, use version 1.x from
CommonJS branch.

## Run these steps first:

1. One of the packages, "ffi-napi", uses native modules and relies on "node-gyp" to build the project if needed,
   depending on whether a prebuilt binary exists or not. As a result, there may be some prerequisites that are
   needed to be installed/configured. The recommendation is to try to install this package first, and if it ends
   up building the native binary on the fly and node-gyp complains about something, then refer to
   [node-gyp's instructions](https://github.com/nodejs/node-gyp#installation) to have those prerequisites installed.

2. Run "npm run show \[addessFamily\]" or "node src/show-interfaces.js \[addessFamily\]".

   addessFamily is optional, which can be "ipv4" or "ipv6" if you only care about one type of IP address.
   Shortened forms of parameter are accepted as well, which are "4", "6", "v4", "v6".

   Find the network interface you want to monitor, and note down the key to that interface, e.g. "Local Area
   Connection", "Wi-Fi".

3. Edit src/settings.json.
   * service defines service parameters when installed as Windows service:
     * name is the service name to be used.
     * account info is optional. If provided, the service will be running as the specified account. These properties
       can be provided:
       * name is account's name
       * password is account's password
       * domain is optional, and should be provided if the account is a domain account
   ```
    "service": {
        "name": "Update Dynamic DNS",
        "account": {
            "name": "{account name}",
            "password": "{account password}",
            "domain": "{account domain}"
        }
    },
   ```
   * networkInterface is the network interface you wrote down in the previous step.
   * addressFamily is the IP address family to monitor and register on dynamic DNS.

     Valid values are "IPv4" and "IPv6".
   * dnsProvider is the provider of your domain.

     Supported values are: "Dynu", "FreeDNS", "DuckDNS", "YDNS", "NoIP".

     **Note**, if only using the script to monitor a network interface, leave this setting empty.
   * domainName is the domain name to be updated on that provider.
   * domainID is the ID assigned to the given domain by that provider.

     Not all providers support this. Some of them map access key to individual domains or simply use domain
     name as id.
   * accessKey is the access key or token assigned by the DNS provider that can be used to update your domain.

     How to obtain this info is provider specific. Please refer to [DNS Provider Instructions](DNS-Providers.md).
   * showNotification allows showing Windows notification when an action is taken, such as domain is updated
     in provider, or domain update is queued (due to update interval).

     **Note**, this only works when running in standalone mode instead of as a Windows service.
   * notificationTypes is an array of string values that defines what types of notification should be shown.

     Supported values are: "DNS Registration", "Scheduled DNS Registration", "IP Changed", "IP Assigned", "IP
     Removed".

4. Run "npm install". Accept UAC prompts if any (there could be up to 4). "npm link" can be used as well,
   which will create a command "showip" that can be used as a shortcut to "src/show-interfaces.js".

   **Note**, this step installs the script as a Windows service. If it's not desired, run "npm run uninstall"
   afterwards.

## To run the script manually:

Run "npm start" or "node src/app.js".

## To install and run the script as a Windows service:

Run "npm run install" or "node src/install-service.js". Accept UAC prompts if any (there could be up to 4).

**Note**, if settings.json is updated when service is running, restart it in Windows Services control panel.

## To uninstall the Windows service:

Run "npm run uninstall" or "node src/uninstall-service.js". Accept UAC prompts if any (there could be up to 4).
