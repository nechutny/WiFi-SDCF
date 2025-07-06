import dgram from "node:dgram";
import udpServerInstance from "./network/UdpServer.ts";
import {CARD_PORT} from "./constants/CARD_PORT.ts";
import {USERNAME} from "./constants/USERNAME.ts";
import {PASSWORD} from "./constants/PASSWORD.ts";
import {ResolvablePromise} from "./utils/ResolvablePromise.ts";
import {READ_TIMEOUT} from "./constants/READ_TIMEOUT.ts";

export class Card {

	protected transferId: number = 93;

	protected dataPromises: {[transferId: number]: ResolvablePromise<Buffer> | undefined} = {};

	constructor(
		public readonly ip: string,
		public readonly mac: string,
		public readonly type: "SD" | "CF",
		public readonly version: string,
		public readonly capacity: number,
		public readonly apMode: boolean,
		public readonly subVersion: string
	) {
		udpServerInstance.subscribeForCard(this.ip, (msg, rinfo) => this.onMessage(msg, rinfo));
	}

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
	 *
	 *
	 * The Authentication packet looks like this:
	 * FC1307-tag|Direction|CommandCode|6 zero bytes|username length|password length|username|11 zero bytes|pwd|to 11 bytes zero padded counter
	 * Concrete (note, that the numbers are written in hex):
	 * FC1307|01|17|000000000000|05|05|admin|00000000000000000000|admin|0000000000000000000000
	 */

	public destroy() {

	}

	public onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		const cmd = msg.readUInt8(7);
		switch(cmd) {
			case 4: // Read Data
				this.incomingReadData(msg, rinfo);
		}
	}

	protected incomingReadData(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		/**
		 * Offset   Size (bytes)    Field         Format	Description
		 * 0        6               header        -         Header (b"FC1307")
		 * 6        1               direction     B         Direction (1 = to card, 0 = from card)
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
		console.log(`Received read data from ${rinfo.address}:${rinfo.port}`);
		console.log(`LBA: ${lba}, LBA Offset: ${lbaOffset}, Flags: ${flags}, N Bytes: ${nBytes}, TID: ${tid}, Padding: ${padding}`);
		// console.log(`Storage Data: ${storageData.toString('hex')}`);

		if (this.dataPromises[tid]) {
			this.dataPromises[tid].resolve(storageData);
		} else {
			console.warn(`Received data for unknown transfer ID: ${tid}`);
		}
	}

	public async readData(LBA_start: number, total_xfer_count: number): Promise<Buffer> {

		/**
		 * Offset   Size (bytes)    Field         Format	Description
		 * 0        6               header        -         Header (b"FC1307")
		 * 6        1               direction     B         Direction (1 = to card, 0 = from card)
		 * 7        1               cmd           B         Command code (4 = read data)
		 * 8		4               lba           I         Logical Block Address (start block)
		 * 12       2               xfer_count    H         Total transfer count (number of blocks to read)
		 * 14       1               username_len  B         Length of username
		 * 15       1               password_len  B         Length of password
		 * 16       16              username      -         Username (ASCII string, zero-padded to 16 bytes)
		 * 32       16              password      -         Password (ASCII string, zero-padded to 16 bytes)
		 * 48       4               transfer_id   I         Transfer ID (big-endian, incremented for each request)
		 */

		const login = "admin";
		const password = "admin";

		const msg = Buffer.alloc(64);
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
			console.log("Sending read data...");
			client.send(msg, CARD_PORT, this.ip, (err) => {
				if (err) {
					console.error(`UDP client error: ${err}`);
				}
				console.log(`Sent read data request to card. ${this.ip}:${CARD_PORT}`);
				client.close();
			});
		});

		setTimeout(() => {
			if(this.dataPromises[myTransferId]) {
				this.dataPromises[myTransferId].reject();
			}
		}, READ_TIMEOUT);

		const data = await this.dataPromises[myTransferId];
		delete this.dataPromises[myTransferId];

		return data;
	}
}
