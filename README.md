# WiFi@SDCF Typescript Client

This repo contain TypeScript implementation of client for WiFi@SDCF. Now it is in early stages of development. Currently it supports discovering SD Cards on network, parsing basic informations, listing and downloading of files from FAT32.

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

# Examples

## Discover cards on Network
```typescript
import {NetworkDiscovery} from "./NetworkDiscovery.ts";
const instance = new NetworkDiscovery("192.168.0.255"); // Need to specify broadcast address of your network

instance.onCardDiscovered = async (card) => {
	// Do whatever with Card instance
};

instance.startDiscovering();
```

## List files on card
```typescript
const card = new Card("192.168.0.123"); // Or get it from NetworkDiscovery
const firstPartition: IFileSystemAdapter = await card.getFileSystemAdapter(0);
const rootFolder: Directory = await firstPartition.getDirectory("/");
const filesAndFolders: Array<File|Directory> = rootFolder.list();
```

And to download specific file:
```typescript
const subfolder: Directory = await rootFolder.getDirectory("subfolder");
const file: File = await subfolder.getFile("file.txt");
const downloadedSize: number = await file.download("./localName.txt");
console.log(`Downloaded ${downloadedSize} bytes`);
```



# TODO List

- [x] Discover cards on Network
- [x] Parse card information
- [ ] Robust reconnection handling
- [x] List files on card
- [x] Download files from card
- [ ] Upload files to card
- [ ] Delete files from card
- [x] FAT 32 Support
  - [x] FAT32 Long filenames
- [ ] NTFS Support
- [ ] ExFAT Support
