import type { IFileInfo } from "./IFileInfo.ts";
import type {IFileSystemAdapter} from "./IFileSystemAdapter.ts";
import type {Card} from "../Card.ts";
import type {IPartitionInfo} from "./IPartitionInfo.ts";
import {ResolvablePromise} from "../utils/ResolvablePromise.ts";

export class FAT32Adapter implements IFileSystemAdapter {

	/**
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
	 * This field is the new 32-bit total count of sectors on the volume.
	 * This count includes the count of all sectors in all four regions of the
	 * volume. This field can be 0; if it is 0, then BPB_TotSec16 must be
	 * non-zero. For FAT32 volumes, this field must be non-zero. For
	 * FAT12/FAT16 volumes, this field contains the sector count if
	 * BPB_TotSec16 is 0 (count is greater than or equal to 0x10000).
	 */
	protected fatSize: number;

	/**
	 * This field is only defined for FAT32 media and does not exist on
	 * FAT12 and FAT16 media. This is set to the cluster number of the
	 * first cluster of the root directory, usually 2 but not required to be 2.
	 */
	protected rootCluster: number;
	protected fatStartLBA: number;

	protected initialised: ResolvablePromise<void> = new ResolvablePromise();


	constructor(
		protected card: Card,
		protected partitionInfo: IPartitionInfo,
	) {
		this.readBIOSParameterBlock();
	}


	protected async readBIOSParameterBlock(): Promise<void> {
		const parameters = await this.card.readBinaryData(this.partitionInfo.startLBA, 1);

		this.sectorSize = parameters.readUInt16LE(11);
		this.sectorsPerCluster = parameters.readUInt8(13);
		this.reservedSectors = parameters.readUInt16LE(14);
		this.numberOfFATs = parameters.readUInt8(16);
		this.fatSize = parameters.readUInt32LE(32);
		this.rootCluster = parameters.readUInt32LE(44);
		this.fatStartLBA = this.partitionInfo.startLBA + this.reservedSectors;

		console.log("FAT32 BIOS Parameter Block:");
		console.log(` * Sector Size: ${this.sectorSize} bytes`);
		console.log(` * Sectors per Cluster: ${this.sectorsPerCluster}`);
		console.log(` * Reserved Sectors: ${this.reservedSectors}`);
		console.log(` * Number of FATs: ${this.numberOfFATs}`);
		console.log(` * FAT Size: ${this.fatSize} sectors`);
		console.log(` * Root Cluster: ${this.rootCluster}`);

		this.initialised.resolve();
	}


	public async listFiles(path: string): Promise<string[]> {
		await this.initialised;

		throw new Error("Method not implemented.");
	}


	public async getFileInfo(path: string): Promise<IFileInfo> {
        throw new Error("Method not implemented.");
    }


	public async getFileContent(path: string): Promise<Buffer> {
        throw new Error("Method not implemented.");
    }


}
