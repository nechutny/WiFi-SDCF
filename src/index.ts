import {NetworkDiscovery} from "./NetworkDiscovery.ts";

const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	instance.stopDiscovering();

	const fs = await card.getFileSystemAdapter(0);
	const files = await fs.listFiles("");
	console.log(`Files on card ${card.ip}:`, files);
	// const data = await card.readBinaryData(0, 4);
};

instance.startDiscovering();
