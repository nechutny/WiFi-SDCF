import type {ICardInfo} from "../types/ICardInfo.ts";

export const parseCardInfo = (msg: Buffer): ICardInfo => {
	/**
	 * Offset   Size (bytes)    Field         Format    Description
	 * 0        6               header        -         Header (b"FC1307")
	 * 6        1               direction     B         Direction (1 = to card, 2 = from card)
	 * 7        1               cmd           B         Command code (1 = card info)
	 * 8        6               zeroes        -         Zeroes (b"\x00\x00\x00\x00\x00\x00")
	 * 14       4               ip            B         IP address (4 bytes, big-endian)
	 * 18       6               mac           B         MAC address (6 bytes, big-endian)
	 * 24       2               type          -         Type of card (b"SD" or b"CF")
	 * 26	    11              version       -         Version string (ASCII, zero-padded to 11 bytes)
	 * 37	    4               capacity      I         Capacity in blocks (32-bit unsigned integer, big-endian)
	 * 41	    1               ap_mode       B         AP mode (1 = enabled, 1 != disabled)
	 * 42	    1               subver_length B         Length of subversion string (1 byte)
	 * 43	    N               subver        -         Subversion string (ASCII, length defined by subver_length)
	 */

	const startOffset = 14;
	const ipOffset = startOffset;
	const macOffset = startOffset + 4;
	const typeOffset = startOffset + 10;
	const versionOffset = startOffset + 12;
	const capacityOffset = startOffset + 23;
	const apModeOffset = startOffset + 27;
	const subverLengthOffset = startOffset + 28;
	const subverOffset = startOffset + 29;

	const ip = Array(4)
		.fill(0)
		.map((_, index) => ipOffset + index)
		.map((offset) => msg.at(offset))
		.join(".");


	const mac = Array(6)
		.fill(0)
		.map((_, index) => macOffset + index)
		.map((offset) => msg.at(offset)?.toString(16).padStart(2, '0'))
		.join(':');

	const type: "SD" | "CF" = msg.toString('ascii', typeOffset, typeOffset + 2) as "SD" | "CF";

	const versionFull = msg.toString('ascii', versionOffset, versionOffset + 11);
	const versionRegex = /Ver (\d+\.\d+\.\d+)/;
	const match = versionFull.match(versionRegex);
	const version = match ? match[1] : "Unknown";

	// 32 bit unsigned integer big endian, probably overflow for 128 GB CARD, or bad value for exFAT?
	const capacity: number = msg.readUInt32BE(capacityOffset);

	const apMode = msg.at(apModeOffset) === 1;

	const subverLength = msg.at(subverLengthOffset)!;

	const subver = msg.toString('ascii', subverOffset , subverOffset + subverLength);

	return {
		ip: ip,
		mac: mac,
		type: type,
		version: version,
		capacity: capacity,
		apMode: apMode,
		subver: subver,
	};
}
