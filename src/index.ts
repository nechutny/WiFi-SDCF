import {NetworkDiscovery} from "./NetworkDiscovery.ts";
const instance = new NetworkDiscovery();

instance.onCardDiscovered = async (card) => {
	instance.stopDiscovering();

	const fs = await card.getFileSystemAdapter(0);

	const dir = await fs.getDirectory("/");

	const testDir = await dir.getDirectory("test");

	console.log("Directory entries:",
		(await testDir.list())
			.map((entry) => entry.name)
	);

	const file = await testDir.getFile("115918609_3391274204236400_5452241364505433529_o.jpg");

	// write to a file
	const tmpPath = "./tmp-output.jpg";
	const downloaded = await file.download(tmpPath);

	console.log("File content size:", downloaded, "original file size", file.size);
};

instance.startDiscovering();
