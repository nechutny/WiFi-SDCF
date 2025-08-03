import type {IFileSystemAdapter} from "./IFileSystemAdapter.ts";
import {File} from "./File.ts";
import type {IFileInfo} from "./IFileInfo.ts";
import {FileNotFoundError} from "./FileNotFoundError.ts";
import {DirectoryNotFoundError} from "./DirectoryNotFoundError.ts";

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


	public async getFile(name: string): Promise<File> {
		const entries = await this.list();
		for(const entry of entries) {
			if(entry instanceof File && this.fsAdapter.compareNames(entry.name, name)) {
				return entry;
			}
		}

		throw new FileNotFoundError();
	}


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
