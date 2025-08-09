import type {IFileSystemAdapter} from "./types/IFileSystemAdapter.ts";
import {File} from "./File.ts";
import type {IFileInfo} from "./types/IFileInfo.ts";
import {FileNotFoundError} from "./errors/FileNotFoundError.ts";
import {DirectoryNotFoundError} from "./errors/DirectoryNotFoundError.ts";

export class Directory {

	protected entries: (Directory|File)[] | null = null;

	constructor(
		protected fsAdapter: IFileSystemAdapter,
		protected path: string,
		protected definition: IFileInfo,
	) {
	}


	get name(): string {
		return this.definition.name;
	}


	get creationDate(): Date {
		return this.definition.creationTime;
	}


	get modificationDate(): Date {
		return this.definition.modificationTime;
	}


	/**
	 * Lists all files and directories in this directory.
	 *
	 * @param refresh If true, the list will be refreshed from the file system.
	 *
	 * @return A promise that resolves to an array of Directory and File instances.
	 */
	public async list(refresh: boolean = false): Promise<(Directory|File)[]> {
		if(!this.entries || refresh) {
			this.entries = [];
			const files = await this.fsAdapter.listFolder(this.definition);
			for(const file of files) {
				if(file.isDirectory) {
					this.entries.push(new Directory(this.fsAdapter, `${this.path}/${file.name}`, file));
				} else {
					this.entries.push(new File(this.fsAdapter, file));
				}
			}
		}

		return this.entries;
	}


	/**
	 * Gets a file by its name from this directory. Uses cached results if available.
	 *
	 * @param name The name of the file to retrieve.
	 *
	 * @returns A promise that resolves to a File instance.
	 *
	 * @throws {FileNotFoundError} If the file with the specified name does not exist in this directory.
	 */
	public async getFile(name: string): Promise<File> {
		const entries = await this.list();
		for(const entry of entries) {
			if(entry instanceof File && this.fsAdapter.compareNames(entry.name, name)) {
				return entry;
			}
		}

		throw new FileNotFoundError();
	}


	/**
	 * Gets a directory by its name from this directory. Uses cached results if available.
	 *
	 * @param name The name of the directory to retrieve.
	 *
	 * @returns A promise that resolves to a Directory instance.
	 *
	 * @throws {DirectoryNotFoundError} If the directory with the specified name does not exist in this directory.
	 */
	public async getDirectory(name: string): Promise<Directory> {
		const entries = await this.list();
		for(const entry of entries) {
			if(entry instanceof Directory && this.fsAdapter.compareNames(entry.name, name)) {
				return entry;
			}
		}

		throw new DirectoryNotFoundError();
	}
}
