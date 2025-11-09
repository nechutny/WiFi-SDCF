import dgram from "node:dgram";
import {Card} from "./Card.ts";
import udpServerInstance from "./network/UdpServer.ts";
import {CARD_PORT} from "./constants/CARD_PORT.ts";
import {parseCardInfo} from "./utils/parseCardInfo.ts";

export class NetworkDiscovery implements Disposable {

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


	[Symbol.dispose]() {
		this.destroy();
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

		const info = parseCardInfo(msg);

		if(this.discovered.some((card) => card.ip === info.ip && card.mac === info.mac)) {
			return;
		}

		console.log("Discovered card:");
		console.log(` * IP: ${info.ip}`);
		console.log(` * MAC: ${info.mac}`);
		console.log(` * AP Mode: ${info.apMode ? "Enabled" : "Disabled"}`);
		console.log(` * Type: ${info.type}`);
		console.log(` * Capacity: ${info.capacity} blocks`);
		console.log(` * Version: ${info.version}`);
		console.log(` * Subversion: ${info.subver}`);
		console.log("");

		const card = new Card(info.ip, info.mac, info.type, info.version, info.capacity, info.apMode, info.subver);
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
