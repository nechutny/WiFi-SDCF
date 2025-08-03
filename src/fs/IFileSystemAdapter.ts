import type {IFileInfo} from "./IFileInfo.ts";
import {Directory} from "./Directory.ts";

export interface IFileSystemAdapter {
	/**
	 * Use this method to get Directory instance which can be then used to list files and directories.
	 */
	getDirectory(path: string): Promise<Directory>;


	getFileContent(file: IFileInfo): Promise<Buffer>;
	listFolder(path: string | IFileInfo): Promise<IFileInfo[]>;

	/**
	 * Does name comparison based on file system rules (eg. case-insensitive for FAT32).
	 */
	compareNames(name1: string, name2: string): boolean;
}
