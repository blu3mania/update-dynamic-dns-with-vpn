'use strict';

const os = require('os');
const ref = require('ref-napi');
const ffi = require('ffi-napi');
//const { verbose } = require('./print.js');

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

const CheckTimerInterval = 500;
const CheckTimerMaxTries = 20;

class NetworkInterfaceMonitor {
    constructor(networkInterface, addressFamily, callback) {
        this.networkInterface = networkInterface;
        this.addressFamily = addressFamily;
        this.currentAddress = null;
        this.checkTimer = null;
        this.checkTimerCounter = 0;
        this.clientCallback = callback ?? null;

        // Define NotifyIpInterfaceChange and CancelMibChangeNotify2 Windows API.
        const voidType = ref.types.void;
        const voidPtr = ref.refType(voidType);
        const handlePtr = ref.refType('pointer');
        this.iphlpapi = ffi.Library('iphlpapi', {
            /*
            IPHLPAPI_DLL_LINKAGE _NETIOAPI_SUCCESS_ NETIOAPI_API NotifyIpInterfaceChange(
              [in]      ADDRESS_FAMILY               Family,
              [in]      PIPINTERFACE_CHANGE_CALLBACK Callback,
              [in]      PVOID                        CallerContext,
              [in]      BOOLEAN                      InitialNotification,
              [in, out] HANDLE                       *NotificationHandle
            );

            Windows Data Type:
              typedef BYTE BOOLEAN;
              typedef unsigned char BYTE;
              typedef PVOID HANDLE;
            */
            'NotifyIpInterfaceChange': [ 'int', [ 'int', 'pointer', voidPtr, 'int8', handlePtr ] ],

            /*
            IPHLPAPI_DLL_LINKAGE NETIOAPI_API CancelMibChangeNotify2(
              [in] HANDLE NotificationHandle
            );
            */
            'CancelMibChangeNotify2': [ 'int', [ 'pointer' ] ]
        });

        // Define callback to NotifyIpInterfaceChange Windows API.
        this.callback = ffi.Callback('void', [voidPtr, 'pointer', 'int'],
            (callerContext, row, notificationType) => {
                this.onNotifyIpInterfaceChange(callerContext, row, notificationType);
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
        const { address, hasLinkLocalAddress } = this.getIP(true);
        this.currentAddress = address;
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
        //verbose(`Callback type: ${NotificationTypesApiValue[notificationType]}`);
        this.detectIPChange();
    }

    onCheckTimer() {
        this.checkTimer = null;
        if (this.checkTimerCounter++ < CheckTimerMaxTries) {
            this.detectIPChange();
        } else {
            // It has been quite a long time without IP assignment. Stop trying
            this.checkTimerCounter = 0;
        }
    }

    detectIPChange() {
        const { address, hasLinkLocalAddress } = this.getIP();
        let eventType = EventType.Initial;
        if (address !== null) {
            if (this.currentAddress === null) {
                eventType = EventType.IPAssigned;
            } else {
                for (const family in address) {
                    if (this.currentAddress[family] !== address[family]) {
                        eventType = EventType.IPChanged;
                    }
                }
            }

            if (this.checkTimer !== null) {
                // Cancel the check timer since new IP assignment event is fired
                //verbose('Real IP assignment event fired. Stopping check timer...');
                clearTimeout(this.checkTimer);
                this.checkTimer = null;
                this.checkTimerCounter = 0;
            }
        } else {
            if (this.currentAddress !== null) {
                eventType = EventType.IPRemoved;
            } else if (hasLinkLocalAddress[this.addressFamily] && this.checkTimer === null) {
                // IP assignment changed from none to link-local address, likely real IP will be assigned. In theory a new notification will come when real IP is assigned,
                // but this doesn't seem to always fire. So, use a timer to help this detection. It will be canceled if the event actually fires.
                //verbose('Link-local address detected. Starting check timer...');
                this.checkTimer = setTimeout(() => {
                    this.onCheckTimer();
                }, CheckTimerInterval);
            }
        }

        this.currentAddress = address;
        if (eventType !== EventType.Initial && this.clientCallback) {
            this.clientCallback(this.currentAddress, eventType);
        }
    }

    getIP(allowLinkLocalAddress = false) {
        const networkInterfaces = os.networkInterfaces();
        const hasLinkLocalAddress = {
            IPv4: false,
            IPv6: false,
        };
        const result = {};

        if (networkInterfaces && networkInterfaces[this.networkInterface]) {
            for (const ip of networkInterfaces[this.networkInterface]) {
                if (this.addressFamily === ip.family || this.addressFamily === 'Any') {
                    if (!this.isLinkLocalAddress(ip.address, ip.family)) {
                        result[ip.family] = ip.address;
                    } else {
                        hasLinkLocalAddress[ip.family] = true;
                        if (allowLinkLocalAddress) {
                            result[ip.family] = ip.address;
                        }
                    }
                }
            }
        }

        return {
            address: (Object.keys(result).length > 0 ? result : null),
            hasLinkLocalAddress : hasLinkLocalAddress,
        }
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
