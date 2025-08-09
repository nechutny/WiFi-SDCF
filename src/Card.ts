import dgram from "node:dgram";
import udpServerInstance from "./network/UdpServer.ts";
import {CARD_PORT} from "./constants/CARD_PORT.ts";
import {USERNAME} from "./constants/USERNAME.ts";
import {PASSWORD} from "./constants/PASSWORD.ts";
import {ResolvablePromise} from "./utils/ResolvablePromise.ts";
import {READ_TIMEOUT} from "./constants/READ_TIMEOUT.ts";
import type {IFileSystemAdapter} from "./fs/types/IFileSystemAdapter.ts";
import {FAT32Adapter} from "./fs/FAT32Adapter.ts";
import {MBRUtility} from "./fs/MBRUtility.ts";
import {EFileSystems} from "./fs/types/EFileSystems.ts";
import {UnsupportedFileSystemError} from "./fs/errors/UnsupportedFileSystemError.ts";
import {TimeoutError} from "./errors/TimeoutError.ts";

export class Card implements Disposable{

	protected transferId: number = 93;

	protected dataPromises: {[transferId: number]: ResolvablePromise<Buffer> | undefined} = {};


	constructor(
		public readonly ip: string,
		public readonly mac?: string,
		public readonly type?: "SD" | "CF",
		public readonly version?: string,
		public readonly capacity?: number,
		public readonly apMode?: boolean,
		public readonly subVersion?: string
	) {
		udpServerInstance.subscribeForCard(this.ip, (msg, rinfo) => this.onMessage(msg, rinfo));
	}

	[Symbol.dispose]() {
		this.destroy();
	}

	public destroy() {

	}

	/**
	 * Returns a file system adapter for the card which can be used to interact with the file system on the card.
	 * @returns {Promise<IFileSystemAdapter>}
	 */
	public async getFileSystemAdapter(partition: number = 0): Promise<IFileSystemAdapter> {

		const MbrUtility = new MBRUtility(this);

		const partitions = await MbrUtility.getPartitions();
		if(partitions.length < partition) {
			throw new Error(`${partition} partition does not exist`);
		}

		switch(partitions[partition].type) {
			case EFileSystems.FAT32:
				return new FAT32Adapter(this, partitions[partition]);
			default:
				throw new UnsupportedFileSystemError(partitions[partition].type);
		}
	}


	/**
	 * Reads binary data from the card starting at the specified LBA (Logical Block Address).
	 * @param LBA_start
	 * @param total_xfer_count - The total number of blocks to read. Value must be in range from 1 to 14
	 */
	public async readBinaryData(LBA_start: number, total_xfer_count: number): Promise<Buffer> {

		if(total_xfer_count < 1 || total_xfer_count > 14) {
			// throw new Error("Total transfer count must be between 1 and 14");
			console.warn(`Total transfer count ${total_xfer_count} is out of bounds, Should be <1,14>.`);
		}

		/**
		 * Offset   Size (bytes)    Field         Format    Description
		 * 0        6               header        -         Header (b"FC1307")
		 * 6        1               direction     B         Direction (1 = to card, 2 = from card)
		 * 7        1               cmd           B         Command code (4 = read data)
		 * 8        4               lba           I         Logical Block Address (start block)
		 * 12       2               xfer_count    H         Total transfer count (number of blocks to read)
		 * 14       1               username_len  B         Length of username
		 * 15       1               password_len  B         Length of password
		 * 16       16              username      -         Username (ASCII string, zero-padded to 16 bytes)
		 * 32       16              password      -         Password (ASCII string, zero-padded to 16 bytes)
		 * 48       4               transfer_id   I         Transfer ID (big-endian, incremented for each request)
		 */

		const msg = Buffer.alloc(52);
		msg.write("FC1307", 0, "ascii");
		msg.writeUInt8(1, 6); // Direction
		msg.writeUInt8(4, 7); // Command Code
		msg.writeUInt32BE(LBA_start, 8); // Start LBA
		msg.writeUInt16BE(total_xfer_count, 12); // Total transfer count


		msg.writeUInt8(USERNAME.length, 14); // Username length
		msg.writeUInt8(PASSWORD.length, 15); // Password length
		msg.write(USERNAME, 16, "ascii"); // Username
		msg.write(PASSWORD, 32, "ascii"); // Password

		msg.writeUInt32BE(this.transferId, 48); // Transfer ID

		const myTransferId = this.transferId;
		this.transferId++;

		this.dataPromises[myTransferId] = new ResolvablePromise();

		const client = dgram.createSocket('udp4');

		client.bind(() => {
			client.send(msg, CARD_PORT, this.ip, (err) => {
				if (err) {
					console.error(`UDP client error: ${err}`);
				}
				client.close();
			});
		});

		setTimeout(() => {
			if(this.dataPromises[myTransferId]) {
				this.dataPromises[myTransferId].reject(new TimeoutError(msg));
			}
		}, READ_TIMEOUT);

		const data = await this.dataPromises[myTransferId];
		delete this.dataPromises[myTransferId];

		return data;
	}


	protected onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {

		/**
		 * Command codes:
		 *
		 *     card info: 1
		 *     get pwd type: 17
		 *     new data in card: 9
		 *     online wifi mode change: 15
		 *     query wifi info: 11
		 *     read data: 4
		 *     scan ssid: 16
		 *     set wifi info: 10
		 */

		const cmd = msg.readUInt8(7);
		switch(cmd) {
			case 4: // Read Data
				this.incomingReadData(msg, rinfo);
		}
	}


	protected incomingReadData(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		/**
		 * Offset   Size (bytes)    Field         Format    Description
		 * 0        6               header        -         Header (b"FC1307")
		 * 6        1               direction     B         Direction (1 = to card, 2 = from card)
		 * 7        1               cmd           B         Command code (4 = read data)
		 * 8        4               lba           I         Logical Block Address (start block)
		 * 12       2               lba_offset    H         Offset into LBA span
		 * 14       2               0x18          H         Probably command or flags
		 * 16       2               n_bytes       H         Number of data bytes in this packet
		 * 18       4               tid           I         Transaction ID
		 * 22       2               Padding       -         Zero padding (b"\x00\x00")
		 * 24       N               storage_data  -         Raw data bytes (up to MAX_BLOCKS * BLOCK_SIZE)
		 */

		const lba = msg.readUInt32BE(8);
		const lbaOffset = msg.readUInt16BE(12);
		const flags = msg.readUInt16BE(14);
		const nBytes = msg.readUInt16BE(16);
		const tid = msg.readUInt32BE(18);
		const padding = msg.readUInt16BE(22);
		const storageData = msg.slice(24, 24 + nBytes);

		if (this.dataPromises[tid]) {
			this.dataPromises[tid].resolve(storageData);
		} else {
			console.warn(`Received data for unknown transfer ID: ${tid}`);
		}
	}
}
