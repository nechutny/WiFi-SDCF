import {NetworkDiscovery} from "./NetworkDiscovery.ts";
const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	instance.stopDiscovering();

	const fs = await card.getFileSystemAdapter(0);

	const dir = await fs.getDirectory("/");

	console.log("Directory entries:",
		(await dir.list())
			.map((entry) => entry.name));

	try {
		const info = await card.readInfo();
		console.log("Card info:", info);
	} catch (e) {
		console.log(e);
	}
};

instance.startDiscovering();
