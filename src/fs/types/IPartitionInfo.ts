import type {EFileSystems} from "./EFileSystems.ts";

export interface IPartitionInfo {
	startLBA: number;
	length: number;
	type: EFileSystems;
}
