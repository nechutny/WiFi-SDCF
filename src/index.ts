import {NetworkDiscovery} from "./NetworkDiscovery.ts";

const instance = new NetworkDiscovery();
const generator = instance.discover();

while(true) {
	const card = await generator.next();
	console.log(`Discovered card: ${card.value.ip}`);
}
