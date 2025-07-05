export class Card {

	constructor(
		public readonly ip: string,
		public readonly mac: string,
		public readonly type: "SD" | "CF",
		public readonly version: string,
		public readonly capacity: number,
		public readonly apMode: boolean,
		public readonly subVersion: string
	) {
	}
}
