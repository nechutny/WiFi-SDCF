import type { IFileInfo } from "./types/IFileInfo.ts";
import type {IFileSystemAdapter} from "./types/IFileSystemAdapter.ts";
import type {Card} from "../Card.ts";
import type {IPartitionInfo} from "./types/IPartitionInfo.ts";
import {ResolvablePromise} from "../utils/ResolvablePromise.ts";
import {Directory} from "../Directory.ts";

/**
 * Used specification: https://www.cs.fsu.edu/~cop4610t/assignments/project3/spec/fatspec.pdf
 */
export class FAT32Adapter implements IFileSystemAdapter {

	/**
	 * BPB_BytsPerSec
	 *
	 * Count of bytes per sector. This value may take on only the
	 * following values: 512, 1024, 2048 or 4096. If maximum
	 * compatibility with old implementations is desired, only the value
	 * 512 should be used. There is a lot of FAT code in the world that is
	 * basically “hard wired” to 512 bytes per sector and doesn’t bother to
	 * check this field to make sure it is 512. Microsoft operating systems
	 * will properly support 1024, 2048, and 4096.
	 */
	protected sectorSize: number;

	/**
	 * BPB_SecPerClus
	 *
	 * Number of sectors per allocation unit. This value must be a power
	 * of 2 that is greater than 0. The legal values are 1, 2, 4, 8, 16, 32, 64,
	 * and 128. Note however, that a value should never be used that
	 * results in a “bytes per cluster” value (BPB_BytsPerSec *
	 * BPB_SecPerClus) greater than 32K (32 * 1024). There is a
	 * misconception that values greater than this are OK. Values that
	 * cause a cluster size greater than 32K bytes do not work properly; do
	 * not try to define one. Some versions of some systems allow 64K
	 * bytes per cluster value. Many application setup programs will not
	 * work correctly on such a FAT volume.
	 */
	protected sectorsPerCluster: number;

	/**
	 * BPB_RsvdSecCnt
	 *
	 * Number of reserved sectors in the Reserved region of the volume
	 * starting at the first sector of the volume. This field must not be 0.
	 * For FAT12 and FAT16 volumes, this value should never be
	 * anything other than 1. For FAT32 volumes, this value is typically
	 * 32. There is a lot of FAT code in the world “hard wired” to 1
	 * reserved sector for FAT12 and FAT16 volumes and that doesn’t
	 * bother to check this field to make sure it is 1. Microsoft operating
	 * systems will properly support any non-zero value in this field.
	 */
	protected reservedSectors: number;

	/**
	 * BPB_NumFATs
	 *
	 * The count of FAT data structures on the volume. This field should
	 * always contain the value 2 for any FAT volume of any type.
	 * Although any value greater than or equal to 1 is perfectly valid,
	 * many software programs and a few operating systems’ FAT file
	 * system drivers may not function properly if the value is something
	 * other than 2. All Microsoft file system drivers will support a value
	 * other than 2, but it is still highly recommended that no value other
	 * than 2 be used in this field.
	 */
	protected numberOfFATs: number;

	/**
	 * BPB_TotSec32
	 *
	 * This field is the new 32-bit total count of sectors on the volume.
	 * This count includes the count of all sectors in all four regions of the
	 * volume. This field can be 0; if it is 0, then BPB_TotSec16 must be
	 * non-zero. For FAT32 volumes, this field must be non-zero. For
	 * FAT12/FAT16 volumes, this field contains the sector count if
	 * BPB_TotSec16 is 0 (count is greater than or equal to 0x10000).
	 */
	protected fatSize: number;

	/**
	 * BPB_RootClus
	 *
	 * This field is only defined for FAT32 media and does not exist on
	 * FAT12 and FAT16 media. This is set to the cluster number of the
	 * first cluster of the root directory, usually 2 but not required to be 2.
	 */
	protected rootCluster: number;

	/**
	 * BPB_RootEntCnt
	 *
	 * For FAT12 and FAT16 volumes, this field contains the count of 32-
	 * byte directory entries in the root directory. For FAT32 volumes,
	 * this field must be set to 0. For FAT12 and FAT16 volumes, this
	 * value should always specify a count that when multiplied by 32
	 * results in an even multiple of BPB_BytsPerSec. For maximum
	 * compatibility, FAT16 volumes should use the value 512.
	 */
	protected rootEntCnt: number;

	/**
	 * BPB_FATSz32
	 *
	 * This field is only defined for FAT32 media and does not exist on
	 * FAT12 and FAT16 media. This field is the FAT32 32-bit count of
	 * sectors occupied by ONE FAT. BPB_FATSz16 must be 0.
	 *
	 */
	protected oneFatSize: number;

	protected firstDataSector: number;

	protected fatStartLBA: number;

	protected initialised: ResolvablePromise<void> = new ResolvablePromise();


	constructor(
		protected card: Card,
		protected partitionInfo: IPartitionInfo,
	) {
		this.readBIOSParameterBlock();
	}


	/**
	 * Get Directory class instance for specified path. This class instance can be used to list files in the directory,
	 */
	public async getDirectory(path: string): Promise<Directory> {
		await this.initialised;

		path = path.toUpperCase();

		// remove / from end
		if(path.endsWith('/')) {
			path = path.slice(0, -1);
		}
		const parent = path.split('/').slice(0, -1).join('/');
		const dirName = path.split('/').pop() || '';

		const parentDir = await this.listFolder(parent);
		if(parent === "" && dirName === "") {
			return new Directory(this, "/", {
				name: "",
				size: 0,
				isDirectory: true,
				clusterNumber: this.rootCluster,
				creationTime: new Date(),
				modificationTime: new Date(),
			});
		}
		const item = parentDir.find(file => file.name === dirName && file.isDirectory);
		if(!item) {
			throw new Error(`Directory ${dirName} not found in ${parent}`);
		}

		return new Directory(this, path, item);
	}


	/**
	 * Read content of whole file from the card.
	 */
	public async getFileContent(file: IFileInfo): Promise<Buffer> {
		await this.initialised;

		const clusterSize = this.sectorSize * this.sectorsPerCluster;
		let remaining = file.size;
		let cluster = file.clusterNumber;
		const buffers: Buffer[] = [];

		while(cluster >= 2 && cluster < 0x0FFFFFF8 && remaining > 0) {
			const firstSector = this.calculateFirstSectorOfCluster(cluster);

			// We can read up to 14 sectors at a time, so we need to read the data in chunks
			const buffersCluster: Buffer[] = [];
			let sectorsLeft = this.sectorsPerCluster;
			let sectorOffset = 0;
			while(sectorsLeft > 0) {
				const batch = Math.min(sectorsLeft, 14);
				const buf = await this.card.readBinaryData(
					this.partitionInfo.startLBA + firstSector + sectorOffset,
					batch
				);
				buffersCluster.push(buf);
				sectorsLeft -= batch;
				sectorOffset += batch;
			}

			const buffer = Buffer.concat(buffersCluster);

			const toCopy = Math.min(remaining, clusterSize);
			buffers.push(buffer.slice(0, toCopy));
			remaining -= toCopy;

			// Read the next cluster number from the FAT
			const fatOffset = cluster * 4;
			const fatSector = Math.floor(fatOffset / this.sectorSize);
			const sectorOffsetFAT = fatOffset % this.sectorSize;

			const fatBuffer = await this.card.readBinaryData(
				this.fatStartLBA + fatSector,
				1
			);
			cluster = fatBuffer.readUInt32LE(sectorOffsetFAT) & 0x0FFFFFFF;
		}

		return Buffer.concat(buffers);
	}


	/**
	 * List files in the specified folder.
	 */
	public async listFolder(path: string | IFileInfo): Promise<IFileInfo[]> {
		await this.initialised;

		if(typeof path === 'object') {
			return this.listCluster(path.clusterNumber);
		}

		path = path.toUpperCase();

		const paths = path.split('/');
		let files = await this.listRoot();
		while(paths.length > 0) {
			const folderName = paths.shift();
			if(!folderName) {
				continue;
			}

			const folder = files.find(file => file.name === folderName && file.isDirectory);
			if(!folder) {
				throw new Error(`Folder ${folderName} not found`);
			}

			files = await this.listCluster(folder.clusterNumber);
		}

		return files;
	}


	/**
	 * Compare two names by rules of FAT32 file system.
	 */
	public compareNames(name1: string, name2: string): boolean {
		return name1.toUpperCase() === name2.toUpperCase();
	}


	protected async readBIOSParameterBlock(): Promise<void> {
		const parameters = await this.card.readBinaryData(this.partitionInfo.startLBA, 1);

		this.sectorSize = parameters.readUInt16LE(11);
		this.sectorsPerCluster = parameters.readUInt8(13);
		this.reservedSectors = parameters.readUInt16LE(14);
		this.numberOfFATs = parameters.readUInt8(16);
		this.rootEntCnt = parameters.readUInt16LE(17); // Not used in FAT32, but read for compatibility
		this.fatSize = parameters.readUInt32LE(32);
		this.oneFatSize = parameters.readUInt32LE(36);
		this.rootCluster = parameters.readUInt32LE(44);
		this.fatStartLBA = this.partitionInfo.startLBA + this.reservedSectors;

		if(this.rootEntCnt !== 0) {
			console.warn("RootEntCnt is not 0, this is not a FAT32 volume. This adapter is designed for FAT32 volumes only.");
		}

		console.log("FAT32 BIOS Parameter Block:");
		console.log(` * Sector Size: ${this.sectorSize} bytes`);
		console.log(` * Sectors per Cluster: ${this.sectorsPerCluster}`);
		console.log(` * Reserved Sectors: ${this.reservedSectors}`);
		console.log(` * Number of FATs: ${this.numberOfFATs}`);
		console.log(` * FAT Size: ${this.fatSize} sectors`);
		console.log(` * Root Cluster: ${this.rootCluster}`);

		// RootDirSectors = ((BPB_RootEntCnt * 32) + (BPB_BytsPerSec – 1)) / BPB_BytsPerSec;
		// const rootDirSectors = Math.floor(((this.rootEntCnt * 32) + (this.sectorSize - 1)) / this.sectorSize);
		// Optimize the calculation to avoid floating point division which does rounding
		const rootDirSectors = Math.ceil((this.rootEntCnt * 32) / this.sectorSize);

		// FirstDataSector = BPB_ResvdSecCnt + (BPB_NumFATs * FATSz) + RootDirSectors;
		const firstDataSector = this.reservedSectors + (this.numberOfFATs * this.oneFatSize) + rootDirSectors;
		this.firstDataSector = firstDataSector;


		const dataSector = this.fatSize - firstDataSector;
		const countOfClusters = Math.floor(dataSector / this.sectorsPerCluster);

		let fatType;
		if(countOfClusters < 4085) {
			fatType = 'fat12';
		} else if(countOfClusters < 65525) {
			fatType = 'fat16';
		} else {
			fatType = 'fat32';
		}

		console.log(" * Root directory sectors:", rootDirSectors);
		console.log(" * First data sector:", firstDataSector);
		console.log(" * Total clusters:", countOfClusters);
		console.log(" * FAT type:", fatType);


		this.initialised.resolve();
	}


	/**
	 * Given any valid data cluster number N, the sector number of the first sector of that cluster (again
	 * relative to sector 0 of the FAT volume) is computed as follows:
	 */
	protected calculateFirstSectorOfCluster(n: number): number {
		// FirstSectorofCluster = ((N – 2) * BPB_SecPerClus) + FirstDataSector;
		return ((n - 2) * this.sectorsPerCluster) + this.firstDataSector;
	}


	protected async listRoot(): Promise<IFileInfo[]> {
		await this.initialised;

		return this.listCluster(this.rootCluster);
	}


	protected async listCluster(clusterNumber: number): Promise<IFileInfo[]> {
		const firstSector = this.calculateFirstSectorOfCluster(clusterNumber);

		const sectorsToRead = this.sectorsPerCluster;

		const buffers: Buffer[] = [];
		let sectorsLeft = sectorsToRead;
		let sectorOffset = 0;
		while (sectorsLeft > 0) {
			const batch = Math.min(sectorsLeft, 14);
			const buf = await this.card.readBinaryData(
				this.partitionInfo.startLBA + firstSector + sectorOffset,
				batch
			);
			buffers.push(buf);
			sectorsLeft -= batch;
			sectorOffset += batch;
		}
		const buffer = Buffer.concat(buffers);

		const entries: IFileInfo[] = [];
		let longFileName = '';
		for(let offset = 0; offset + 32 <= buffer.length; offset += 32) {
			const entry = buffer.slice(offset, offset + 32);

			// If DIR_Name[0] == 0x00, then the directory entry is free (same as for 0xE5), and there are no
			// allocated directory entries after this one (all of the DIR_Name[0] bytes in all of the entries after
			// this one are also set to 0).
			// The special 0 value, rather than the 0xE5 value, indicates to FAT file system driver code that the
			// rest of the entries in this directory do not need to be examined because they are all free.
			if(entry[0] === 0x00) {
				break;
			}

			// If DIR_Name[0] == 0xE5, then the directory entry is free (there is no file or directory name in this
			// entry).
			if(entry[0] === 0xE5) {
				continue;
			}

			// Long File Name entry
			if(entry[11] === 0x0F) {
				const lfnEntry = entry;
				const order = lfnEntry[0] & 0x1F;
				if(order > 0) {
					const name1 = lfnEntry.slice(1, 11);
					const name2 = lfnEntry.slice(14, 26);
					const name3 = lfnEntry.slice(28, 32);
					const namePart = Buffer.concat([name1, name2, name3]).toString('utf16le');
					longFileName = namePart.split('\0')[0] + longFileName;
				}
				continue;
			}

			// If DIR_Name[0] == 0x05, then the actual file name character for this byte is 0xE5. 0xE5 is
			// actually a valid KANJI lead byte value for the character set used in Japan. The special 0x05 value
			// is used so that this special file name case for Japan can be handled properly and not cause FAT file
			// system code to think that the entry is free.
			if(entry[0] === 0x05) {
				entry[0] = 0xE5; // Replace 0x05 with 0xE5
			}

			let name: string;
			if(longFileName.length > 0) {
				name = longFileName;
				longFileName = '';
			} else {
				name = entry.toString('ascii', 0, 8).trim();
				const ext = entry.toString('ascii', 8, 11).trim();
				if(ext.length > 0) {
					name += '.' + ext;
				}
			}

			const creationTimeWord = entry.readUInt16LE(14);
			const creationDateWord = entry.readUInt16LE(16);
			const modificationTimeWord = entry.readUInt16LE(22);
			const modificationDateWord = entry.readUInt16LE(24);

			entries.push({
				name: name,
				size: entry.readUInt32LE(28),
				isDirectory: (entry[11] & 0x10) !== 0,
				clusterNumber: (entry.readUInt16LE(20) << 16) | entry.readUInt16LE(26), // Cluster number
				creationTime: this.parseFatDateTime(creationDateWord, creationTimeWord),
				modificationTime: this.parseFatDateTime(modificationDateWord, modificationTimeWord),
			});
		}

		return entries;
	}


	protected parseFatDateTime(date: number, time: number): Date {
		/*
		 * Date:
		 * Bits 0–4: Day of month, valid value range 1-31 inclusive.
		 * Bits 5–8: Month of year, 1 = January, valid value range 1–12 inclusive.
		 * Bits 9–15: Count of years from 1980, valid value range 0–127 inclusive (1980–2107).
		 *
		 * Time:
		 * Bits 0–4: 2-second count, valid value range 0–29 inclusive (0 – 58 seconds).
		 * Bits 5–10: Minutes, valid value range 0–59 inclusive.
		 * Bits 11–15: Hours, valid value range 0–23 inclusive
		 */

		const year = 1980 + (date >> 9);
		const month = (date >> 5) & 0b1111;
		const day = date & 0b11111;

		const hour = time >> 11;
		const minute = (time >> 5) & 0b111111;
		const second = (time & 0b11111) * 2;

		// FAT month is 1-12, day is 1-31. If 0, it's invalid.
		if(month === 0 || day === 0) {
			return new Date(0); // Return epoch for invalid date
		}

		// JavaScript's Date month is 0-indexed (0-11)
		return new Date(year, month - 1, day, hour, minute, second);
	}
}
