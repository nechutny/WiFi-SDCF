import dgram from "node:dgram";
import {Card} from "./Card.ts";
import {ResolvablePromise} from "./ResolvablePromise.ts";

export class NetworkDiscovery {

	public readonly LOCAL_PORT = 24388;
	public readonly CARD_PORT = 24387;


	protected discovered: Card[] = [];

	protected udpServer: unknown;

	protected cardDiscovered: ResolvablePromise<Card>;

	constructor(
		protected multicastAddress: string = "192.168.0.255",
	) {
		this.initUdpServer();
	}

	public async *discover(): AsyncGenerator<Card, Card, Card> {
		this.cardDiscovered = new ResolvablePromise();
		this.sendBroadcast();

		while(true) {
			const card = await this.cardDiscovered;
			this.cardDiscovered = new ResolvablePromise();
			yield card;
		}
	}

	protected sendBroadcast(): void {
		const data = Buffer.from('KTC');
		const client = dgram.createSocket('udp4');


		client.bind(() => {
			client.setBroadcast(true);
			console.log("Sending broadcast to discover cards...");
			client.send(data, this.CARD_PORT, this.multicastAddress, (err) => {
				if (err) {
					console.error(`UDP client error: ${err}`);
				} else {
					console.log(`Broadcast sent to port ${this.CARD_PORT}`);
				}
				client.close();
			});
		});
	}

	protected handleIncommingMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		const header = "FC1307";

		if(msg.length < header.length || msg.toString('utf8', 0, header.length) !== header) {
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
				console.warn(`Unknown command received: ${command}`);
				return;
		}
	}

	protected parseCardInfo(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		const startOffset = 14;

		const ip = [
			msg.at(startOffset),
			msg.at(startOffset + 1),
			msg.at(startOffset + 2),
			msg.at(startOffset + 3)
		].join('.');

		const mac = [
			msg.at(startOffset + 4)?.toString(16).padStart(2, '0'),
			msg.at(startOffset + 5)?.toString(16).padStart(2, '0'),
			msg.at(startOffset + 6)?.toString(16).padStart(2, '0'),
			msg.at(startOffset + 7)?.toString(16).padStart(2, '0'),
			msg.at(startOffset + 8)?.toString(16).padStart(2, '0'),
			msg.at(startOffset + 9)?.toString(16).padStart(2, '0'),
		].join(':');


		const type: "SD" | "CF" = msg.toString('utf8', startOffset + 10, startOffset + 12) as "SD" | "CF";

		const versionFull = msg.toString('ascii', startOffset + 12, startOffset + 23);
		const versionRegex = /Ver (\d+\.\d+\.\d+)/;
		const match = versionFull.match(versionRegex);
		const version = match ? match[1] : "Unknown";

		// 32 bit unsigned integer big endian, probably overflow for 128 GB CARD
		const capacity: number = msg.readUInt32BE(23 + startOffset);

		const apMode = msg.at(startOffset + 27) === 1;

		const subverLength = msg.at(startOffset + 28)!;

		const subver = msg.toString('ascii', startOffset + 29, startOffset + 29 + subverLength);

		if(this.discovered.some((card) => card.ip === ip && card.mac === mac)) {
			console.warn(`Card with IP ${ip} and MAC ${mac} already discovered.`);
			return;
		}

		const card = new Card(ip, mac, type, version, capacity, apMode, subver);
		this.discovered.push(card);
		this.cardDiscovered.resolve(card);
	}

	protected initUdpServer(): void {
		const server = dgram.createSocket("udp4");
		server.on("error", (err) => {
			console.error(`UDP server error: ${err}`);
			server.close();
		});
		server.on("message", (msg, rinfo) => {
			console.log(`UDP server got message from ${rinfo.address}:${rinfo.port}`);
			this.handleIncommingMessage(msg, rinfo);
		});
		server.on("listening", () => {
			const address = server.address();
			console.log(`UDP server listening on ${address.address}:${address.port}`);
		});
		server.on("close", () => {
			console.log("UDP server closed");
		});
		server.bind(this.LOCAL_PORT);

		this.udpServer = server;
	}

}
