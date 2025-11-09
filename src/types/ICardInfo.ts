export interface ICardInfo {
	ip: string;
	mac: string;
	type: "SD" | "CF";
	version: string;
	capacity: number;
	apMode: boolean;
	subver: string;
}
