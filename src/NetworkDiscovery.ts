import dgram from "node:dgram";
import {Card} from "./Card.ts";
import udpServerInstance from "./network/UdpServer.ts";
import {CARD_PORT} from "./constants/CARD_PORT.ts";

export class NetworkDiscovery {

	/**
	 * Callback that is called when a card is discovered.
	 */
	public onCardDiscovered: (card: Card) => void = () => {};

	protected discovered: Card[] = [];
	protected broadcastInterval: NodeJS.Timeout | null = null;


	constructor(
		protected multicastAddress: string = "192.168.0.255",
	) {
		this.initUdpServer();
	}


	/**
	 * Destroys the NetworkDiscovery instance, stopping the UDP server and clearing discovered cards.
	 */
	public destroy(): void {
		this.stopDiscovering();
		this.discovered.forEach((card: Card) => card.destroy());
		this.discovered = [];
		this.onCardDiscovered = () => {};
	}


	/**
	 * Starts discovering cards on the network by sending a broadcast message.
	 * @param broadcastInterval Interval to send the broadcast message in milliseconds. Default is 10 seconds (10_000 ms).
	 */
	public startDiscovering(broadcastInterval: number = 10_000): void {
		this.broadcastInterval = setInterval(() => {
			this.sendBroadcast();
		}, broadcastInterval)
		this.sendBroadcast();
	}


	/**
	 * Stops discovering cards on the network
	 */
	public stopDiscovering(): void {
		if(this.broadcastInterval) {
			clearInterval(this.broadcastInterval);
			this.broadcastInterval = null;
		}
	}


	protected sendBroadcast(): void {
		const data = Buffer.from('KTC');
		const client = dgram.createSocket('udp4');

		client.bind(() => {
			client.setBroadcast(true);
			console.log("Sending broadcast to discover cards...");
			client.send(data, CARD_PORT, this.multicastAddress, (err) => {
				if (err) {
					console.error(`UDP client error: ${err}`);
				}
				client.close();
			});
		});
	}


	/**
	 * Handles incoming messages from the UDP server.
	 * @param msg The received message buffer.
	 * @param rinfo Remote info of the sender.
	 */
	protected handleIncommingMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		const header = "FC1307";

		if(msg.length < header.length || msg.toString('ascii', 0, header.length) !== header) {
			console.warn("Received message does not match expected header.");
			return;
		}

		const direction = msg.at(6);
		if(direction != 2) {
			console.warn(`Received message with unexpected direction: ${direction}, should be 2`);
			return;
		}

		const command = msg.at(7);

		switch(command) {
			case 0x01:
				this.parseCardInfo(msg, rinfo);
				break;
			default:
				return;
		}
	}


	/**
	 * Parses the card information from the received message.
	 * @param msg The received message buffer.
	 * @param rinfo Remote info of the sender.
	 */
	protected parseCardInfo(msg: Buffer, rinfo: dgram.RemoteInfo): void {

		/**
		 * Offset   Size (bytes)    Field         Format    Description
		 * 0        6               header        -         Header (b"FC1307")
		 * 6        1               direction     B         Direction (1 = to card, 2 = from card)
		 * 7        1               cmd           B         Command code (1 = card info)
		 * 8        6               zeroes        -         Zeroes (b"\x00\x00\x00\x00\x00\x00")
		 * 14       4               ip            B         IP address (4 bytes, big-endian)
		 * 18       6               mac           B         MAC address (6 bytes, big-endian)
		 * 24       2               type          -         Type of card (b"SD" or b"CF")
		 * 26	    11              version       -         Version string (ASCII, zero-padded to 11 bytes)
		 * 37	    4               capacity      I         Capacity in blocks (32-bit unsigned integer, big-endian)
		 * 41	    1               ap_mode       B         AP mode (1 = enabled, 1 != disabled)
		 * 42	    1               subver_length B         Length of subversion string (1 byte)
		 * 43	    N               subver        -         Subversion string (ASCII, length defined by subver_length)
		 */

		const startOffset = 14;
		const ipOffset = startOffset;
		const macOffset = startOffset + 4;
		const typeOffset = startOffset + 10;
		const versionOffset = startOffset + 12;
		const capacityOffset = startOffset + 23;
		const apModeOffset = startOffset + 27;
		const subverLengthOffset = startOffset + 28;
		const subverOffset = startOffset + 29;

		const ip = Array(4)
			.fill(0)
			.map((_, index) => ipOffset + index)
			.map((offset) => msg.at(offset))
			.join(".");


		const mac = Array(6)
			.fill(0)
			.map((_, index) => macOffset + index)
			.map((offset) => msg.at(offset)?.toString(16).padStart(2, '0'))
			.join(':');

		const type: "SD" | "CF" = msg.toString('ascii', typeOffset, typeOffset + 2) as "SD" | "CF";

		const versionFull = msg.toString('ascii', versionOffset, versionOffset + 11);
		const versionRegex = /Ver (\d+\.\d+\.\d+)/;
		const match = versionFull.match(versionRegex);
		const version = match ? match[1] : "Unknown";

		// 32 bit unsigned integer big endian, probably overflow for 128 GB CARD, or bad value for exFAT?
		const capacity: number = msg.readUInt32BE(capacityOffset);

		const apMode = msg.at(apModeOffset) === 1;

		const subverLength = msg.at(subverLengthOffset)!;

		const subver = msg.toString('ascii', subverOffset , subverOffset + subverLength);

		if(this.discovered.some((card) => card.ip === ip && card.mac === mac)) {
			console.warn(`Card with IP ${ip} and MAC ${mac} already discovered.`);
			return;
		}

		console.log("Discovered card:");
		console.log(` * IP: ${ip}`);
		console.log(` * MAC: ${mac}`);
		console.log(` * AP Mode: ${apMode ? "Enabled" : "Disabled"}`);
		console.log(` * Type: ${type}`);
		console.log(` * Capacity: ${capacity} blocks`);
		console.log(` * Version: ${version}`);
		console.log(` * Subversion: ${subver}`);
		console.log("");

		const card = new Card(ip, mac, type, version, capacity, apMode, subver);
		this.discovered.push(card);
		this.onCardDiscovered(card);
	}


	/**
	 * Initializes the UDP server to listen for incoming messages.
	 */
	protected initUdpServer(): void {
		udpServerInstance.subscribeForAll((msg, rinfo) => this.handleIncommingMessage(msg, rinfo));
	}

}
