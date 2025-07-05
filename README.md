# WiFi@SDCF Typescript Client

This repo contain TypeScript implementation of client for WiFi@SDCF. Now it is in early stages of development. Currently it supports discovering SD Cards on network and parsing basic informations. 

# Running

## Install dependencies
```bash
npm install
```

Do not forget to allow port 24388 in firewall.


## Run development "test"
```bash
node --loader ts-node/esm src/index.ts
```


# Intended usage

Should provide NetworkDiscovery tool to detect cards on network and get instance of class which should allow to list files on Card, download files etc. Currently is this repo in early development stage. This will be sometime in future npm package which will allow to use it in your projects.
