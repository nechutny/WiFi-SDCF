import {NetworkDiscovery} from "./NetworkDiscovery.ts";
const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	instance.stopDiscovering();

	const fs = await card.getFileSystemAdapter(0);

	const dir = await fs.getDirectory("/");

	console.log("Directory entries:",
		(await dir.list())
			.map((entry) => entry.name));
};

instance.startDiscovering();
