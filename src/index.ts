import {NetworkDiscovery} from "./NetworkDiscovery.ts";
import { writeFile } from "fs/promises";

const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	instance.stopDiscovering();

	const fs = await card.getFileSystemAdapter(0);

	const dir = await fs.getDirectory("/");

	const testDir = await dir.getDirectory("test");

	console.log("Directory entries:",
		(await dir.list())
			.map((entry) => entry.name)
	);

	const file = await dir.getFile("110123~1.JPG");

	const content = await file.readContent();

	console.log("File content size:", content.length, "original file size", file.size);

	// write to a file
	const tmpPath = "./tmp-output.jpg";
	await writeFile(tmpPath, content);
};

instance.startDiscovering();
