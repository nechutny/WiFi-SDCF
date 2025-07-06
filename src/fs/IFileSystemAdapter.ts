import type {IFileInfo} from "./IFileInfo.ts";

export interface IFileSystemAdapter {
	listFiles(path: string): Promise<string[]>;

	getFileInfo(path: string): Promise<IFileInfo>;

	getFileContent(path: string): Promise<Buffer>;
}
