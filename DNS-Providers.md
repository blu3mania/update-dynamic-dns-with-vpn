# DNS Provider Instructions

## [Dynu](https://www.dynu.com/)

To obtain your access key and domain ID:
1. Go to https://www.dynu.com/en-US/ControlPanel/APICredentials.
2. In "API Credentials" section, click "View" icon in Action column for API Key.
3. The key is now displayed. Use it as accessKey in settings.json.
4. In a command window, run 'curl https://api.dynu.com/v2/dns -H "API-Key:ACCESSKEY"'. If not already
   installed, curl can be downloaded from https://curl.se/windows/.
5. The returned string is in JSON format. Under "domains", each domain entry comes with id, name, along with
   other properties. Find the id value for the domain name you want to update.
6. Use this id as domainID in settings.json.

API to update IP address:

POST https://api.dynu.com/v2/dns/{DOMAINID}

Header: "API-Key: {ACCESSKEY}"

Body: { "name": "{DOMAINNAME}"[, "ipv4Address": "ddd.ddd.ddd.ddd"][, "ipv6Address": "xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx"] }

## [FreeDNS](https://freedns.afraid.org/)

To enable programmically updating DNS entry and obtain your access key:
1. Go to https://freedns.afraid.org/dynamic/v2/.
2. Select the domain(s) you want to enable.
3. Make sure you select "Enable Dynamic DNS..." in Action dropdown list.
4. Click "Apply" button.
5. These domains should now appear under "Active dynamic entries" section.
6. For the domain you want to update, grab the API key in the URL shown in the last column. It is the last
   segment in the URL displayed, i.e. http://sync.afraid.org/u/{ACCESSKEY}/.
7. Use this key as accessKey in settings.json.
8. domainID in settings.json is not needed. FreeDNS assigns unique API key per domain.

API to update IP address:

GET http://[v6.]sync.afraid.org/u/{ACCESSKEY}/?ip=[ddd.ddd.ddd.ddd][xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]

## [DuckDNS](https://www.duckdns.org/)

To obtain your access key and domain ID:
1. Go to https://www.duckdns.org/
2. "token" displayed on this page (near the top) is the API token. Use it as accessKey in settings.json.
3. Domains are listed below. The first column is domain ID. It is essentially the subdomain name in
   DOMAINID.duckdns.org.
4. Use this id as domainID in settings.json.

API to update IP address:

GET https://www.duckdns.org/update?domains={DOMAINID}&token={ACCESSKEY}[&ip=ddd.ddd.ddd.ddd][&ipv6=xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]

## [YDNS](https://ydns.io/)

To obtain your access key:
1. Your access key is either your account username:password, or API username:password which can be found here:
   https://ydns.io/user/api.

   For example, if your email is "someone@mail.com" and password is "MySuperSecretPwd" then use
   "someone@mail.com:MySuperSecretPwd" as accessKey in settings.json.
2. domainID in settings.json is not needed. YDNS uses domain name to update.

API to update IP address:

GET https://ydns.io/api/v1/update/?host={DOMAINNAME}&ip=[ddd.ddd.ddd.ddd][xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]

Header: "Authorization: Basic {base64-encoded ACCESSKEY}"

## [No-IP](https://www.noip.com/)

To obtain your access key:
1. Your access key is username:password. See [YDNS](#ydns-httpsydnsio) section for example.
2. domainID in settings.json is not needed. NoIP uses domain name to update.

API to update IP address:

GET https://dynupdate.no-ip.com/nic/update?hostname={DOMAINNAME}[&myip==ddd.ddd.ddd.ddd][&myipv6=xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]

Header: "Authorization: Basic {base64-encoded ACCESSKEY}"
