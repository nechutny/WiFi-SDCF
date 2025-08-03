import type {IFileInfo} from "./IFileInfo.ts";
import type {IFileSystemAdapter} from "./IFileSystemAdapter.ts";

export class File {
	constructor(
		protected fsAdapter: IFileSystemAdapter,
		protected definition: IFileInfo,
	) {
	}


	get name(): string {
		return this.definition.name;
	}


	get size(): number {
		return this.definition.size;
	}


	public async readContent(): Promise<Buffer> {
		return this.fsAdapter.getFileContent(this.definition);
	}
}
