import type {Card} from "../Card.ts";
import type {IPartitionInfo} from "./IPartitionInfo.ts";

export class MBRUtility {
	constructor(
		protected card: Card,
	) {
	}

	public async getPartitions(): Promise<IPartitionInfo[]> {
		const MBR = await this.card.readBinaryData(0, 1); // Read the first sector (512 bytes)
		const partitionTableOffset = 446; // Partition table starts at byte 446
		const partitionEntrySize = 16; // Each partition entry is 16 bytes
		const partitions: IPartitionInfo[] = [];

		for (let i = 0; i < 4; i++) {
			const entryOffset = partitionTableOffset + i * partitionEntrySize;
			const partitionType = MBR.readUInt8(entryOffset + 4); // Partition type
			const startLBA = MBR.readUInt32LE(entryOffset + 8); // Starting LBA
			const length = MBR.readUInt32LE(entryOffset + 12); // Number of blocks

			if (partitionType !== 0) { // Ignore empty partitions
				partitions.push({
					startLBA,
					length,
					type: this.detectFileSystem(partitionType),
				});
			}
		}

		return partitions;
	}

	public detectFileSystem(partitionType: number): string {
		switch (partitionType) {
			case 0x0B:
			case 0x0C:
				return "FAT32";
			case 0x07:
				return "NTFS"; // Or exFAT
			case 0x83:
				return "Linux Filesystem";
			case 0x05:
			case 0x0F:
				return "Extended Partition";
			default:
				return "Unknown";
		}
	}
}
