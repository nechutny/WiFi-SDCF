import dgram from "node:dgram";
import {LOCAL_PORT} from "../constants/LOCAL_PORT.ts";

export class UdpServer implements Disposable {

	protected udpServer: dgram.Socket | null = null;

	protected subscribers: {[ip: string]: ((msg: Buffer, rinfo: dgram.RemoteInfo) => void)} = {};
	protected allSubscribers: ((msg: Buffer, rinfo: dgram.RemoteInfo) => void)[] = [];

	constructor() {
		const server = dgram.createSocket("udp4");

		server.on("error", (err) => {
			console.error(`UDP server error: ${err}`);
			server.close();
		});

		server.on("message", (msg, rinfo) => {
			this.handleIncommingMessage(msg, rinfo);
		});

		server.on("listening", () => {
			const address = server.address();
			console.log(`UDP server listening on ${address.address}:${address.port}`);
		});

		server.on("close", () => {
			console.log("UDP server closed");
		});

		server.bind(LOCAL_PORT);

		this.udpServer = server;
	}

	protected handleIncommingMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
		this.allSubscribers.forEach((callback) => callback(msg, rinfo));
		if(this.subscribers[rinfo.address]) {
			this.subscribers[rinfo.address](msg, rinfo);
		}
	}

	public subscribeForCard(ip: string, callback: (msg: Buffer, rinfo: dgram.RemoteInfo) => void): void {
		this.subscribers[ip] = callback;
	}

	public unsubscribeForCard(ip: string): void {
		delete this.subscribers[ip];
	}

	public subscribeForAll(callback: (msg: Buffer, rinfo: dgram.RemoteInfo) => void): void {
		this.allSubscribers.push(callback);
	}

	[Symbol.dispose]() {
		this.destroy();
	}

	public destroy(): void {
		if (this.udpServer) {
			this.udpServer.close();
			this.udpServer = null;
		}
		this.subscribers = {};
		this.allSubscribers = [];
		console.log("UDP server destroyed");
	}
}

const instance = new UdpServer();

export default instance;
