# WiFi@SDCF Typescript Client

This repo contain TypeScript implementation of client for WiFi@SDCF. Now it is in early stages of development. Currently it supports discovering SD Cards on network, parsing basic informations, listing and downloading of files from FAT32.

# Running

## Install dependencies
```bash
npm install
```

Do not forget to allow port 24388 for UDP in firewall.


## Run development "test"
```bash
node --loader ts-node/esm src/dev-test.ts
```

# Examples

## Discover cards on Network
```typescript
const discovery = new NetworkDiscovery("192.168.0.255"); // Need to specify broadcast address of your network

discovery.onCardDiscovered = (card: Card): void => {
	// Do whatever with Card instance
};

discovery.startDiscovering();

// call discovery.destroy(); to release resources
```

## List files on card
```typescript
const card = new Card("192.168.0.123"); // Or get it from NetworkDiscovery
const firstPartition: IFileSystemAdapter = await card.getFileSystemAdapter(0);
const rootFolder: Directory = await firstPartition.getDirectory("/");
const filesAndFolders: Array<File|Directory> = rootFolder.list();

// call card.destroy(); to release resources
```

And to download specific file:
```typescript
const subfolder: Directory = await rootFolder.getDirectory("subfolder");
const file: File = await subfolder.getFile("file.txt");
const downloadedSize: number = await file.download("./localName.txt");
console.log(`Downloaded ${downloadedSize} bytes`);
```

## Watch changes in directory
Detect changes in directory, like new files, modified files or deleted files. Has heuristics to detect if is new file written, so it will not trigger on every byte written as new + changed, but only when file size is stable for some time.
```typescript
const card = new Card("192.168.0.123");
const fs: IFileSystemAdapter = await card.getFileSystemAdapter(0);
const folder: Directory = await fs.getDirectory("/DCIM/100MEDIA");
const watch: WatchDirectory = folder.watchDirectory();

watch.onNewFile = (file: File) => {
    console.log(`New file: ${file.name}`);
    file.download(`./mirror/${file.name}`);
};
watch.onFileModified = (file: File) => {
    console.log(`File changed: ${file.name}`);
};
watch.onFileRemoved = (file: File) => {
  console.log(`File deleted: ${file.name}`);  
};

watch.start();

// call watch.destroy(); to stop watching
```


# TODO List

- [x] Discover cards on Network
- [x] Parse card information
- [ ] Configure Card's WiFi
- [ ] Robust reconnection and lost packets handling
- [x] List files on card
- [x] Download files from card
- [ ] Upload files to card
- [ ] Delete files from card
- [x] Watch changes in directory
- [x] FAT 32 Support
  - [x] FAT32 Long filenames
- [ ] NTFS Support
- [ ] ExFAT Support
