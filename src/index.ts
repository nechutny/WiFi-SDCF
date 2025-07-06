import {NetworkDiscovery} from "./NetworkDiscovery.ts";

const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	const data = await card.readData(0, 4);
};

instance.startDiscovering();
