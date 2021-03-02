(function() {
    'use strict';

    const os = require('os');
    const ref = require('ref-napi');
    const ffi = require('ffi-napi');
    //const print = require('./print.js');

    const EventType = {
        Initial: 0,
        IPChanged: 1,
        IPAssigned: 2,
        IPRemoved: 3,
    };

    const AddressFamilyApiValue = {
        Any: 0,
        IPv4: 2,
        IPv6: 23,
    };

    //const NotificationTypesApiValue = ['Parameter changed', 'Interface added', 'Interface removed', 'Initial notification'];

    class NetworkInterfaceMonitor {
        constructor(networkInterface, addressFamily, callback) {
            this.networkInterface = networkInterface;
            this.addressFamily = addressFamily;
            this.currentAddress = null;
            this.clientCallback = callback ?? null;

            // Define NotifyIpInterfaceChange and CancelMibChangeNotify2 Windows API.
            const voidType = ref.types.void;
            const voidPtr = ref.refType(voidType);
            const handlePtr = ref.refType('pointer');
            this.iphlpapi = ffi.Library('iphlpapi', {
                'NotifyIpInterfaceChange': [ 'int', [ 'int', 'pointer', voidPtr, 'int8', handlePtr ] ],
                'CancelMibChangeNotify2': [ 'int', [ 'pointer' ] ]
            });

            // Define callback to NotifyIpInterfaceChange Windows API.
            const onNotifyIpInterfaceChange = this.onNotifyIpInterfaceChange.bind(this);
            this.callback = ffi.Callback('void', [voidPtr, 'pointer', 'int'],
                (callerContext, row, notificationType) => {
                    onNotifyIpInterfaceChange(callerContext, row, notificationType);
                }
            );

            // callerContext is not used by this class.
            this.callerContext = ref.alloc('pointer');

            // Handle returned by NotifyIpInterfaceChange, which can be used to cancel the registration.
            this.notificationHandle = ref.alloc('pointer');
        }

        static get EventType() {
            return EventType;
        }

        start() {
            this.currentAddress = this.getIP(true);
            if (this.clientCallback) {
                // Send intial callback for current IP address
                this.clientCallback(this.currentAddress, EventType.Initial);
            }

            return (this.iphlpapi.NotifyIpInterfaceChange(AddressFamilyApiValue[this.addressFamily], this.callback, this.callerContext, 0, this.notificationHandle) === 0);
        }

        stop() {
            this.clientCallback = null;
            return (this.iphlpapi.CancelMibChangeNotify2(this.notificationHandle.deref()) === 0);
        }
        
        onNotifyIpInterfaceChange(callerContext, row, notificationType) {
            //print(`Callback type: ${NotificationTypesApiValue[notificationType]}`);
            const newAddress = this.getIP();
            let eventType = EventType.Initial;
            if (newAddress !== null) {
                if (this.currentAddress === null) {
                    eventType = EventType.IPAssigned;
                } else {
                    for (const family in newAddress) {
                        if (this.currentAddress[family] !== newAddress[family]) {
                            eventType = EventType.IPChanged;
                        }
                    }
                }
            } else {
                if (this.currentAddress !== null) {
                    eventType = EventType.IPRemoved;
                }
            }

            this.currentAddress = newAddress;
            if (eventType !== EventType.Initial && this.clientCallback) {
                this.clientCallback(this.currentAddress, eventType);
            }
        }

        getIP(allowLinkLocalAddress = false) {
            const networkInterfaces = os.networkInterfaces();
            if (networkInterfaces && networkInterfaces[this.networkInterface]) {
                const result = {};
                for (const ip of networkInterfaces[this.networkInterface]) {
                    if ((this.addressFamily === ip.family || this.addressFamily === 'Any')
                        && (allowLinkLocalAddress || !this.isLinkLocalAddress(ip.address, this.addressFamily))) {
                        result[ip.family] = ip.address;
                    }
                }

                return Object.keys(result).length > 0 ? result : null;
            }

            return null;
        }

        isLinkLocalAddress(address, addressFamily) {
            if (addressFamily === 'IPv4') {
                return address && address.startsWith('169.254'); // IPv4 link-local address block is 169.254.0.0/16
            } else if (addressFamily === 'IPv6') {
                return address && (address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')); // IPv6 link-local address block is fe80::/10
            }
            return false;
        }
    }

    module.exports = NetworkInterfaceMonitor;
})();
