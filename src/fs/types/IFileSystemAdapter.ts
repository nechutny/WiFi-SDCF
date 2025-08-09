import type {IFileInfo} from "./IFileInfo.ts";
import {Directory} from "../../Directory.ts";

export interface IFileSystemAdapter {
	/**
	 * Use this method to get Directory instance which can be then used to list files and directories.
	 */
	getDirectory(path: string): Promise<Directory>;


	/**
	 * Reads the content of a file and returns it as a Buffer.
	 *
	 * @param file The file to read.
	 *
	 * @returns A promise that resolves to a Buffer containing the file content.
	 */
	getFileContent(file: IFileInfo): Promise<Buffer>;

	/**
	 * Lists all files and directories in the specified path.
	 *
	 * @param path The path to list files and directories from. Can be a string or an IFileInfo object.
	 *
	 * @returns A promise that resolves to an array of IFileInfo objects representing the files and directories.
	 */
	listFolder(path: string | IFileInfo): Promise<IFileInfo[]>;

	/**
	 * Does name comparison based on file system rules (eg. case-insensitive for FAT32).
	 */
	compareNames(name1: string, name2: string): boolean;
}
