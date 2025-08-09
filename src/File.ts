import type {IFileInfo} from "./fs/types/IFileInfo.ts";
import type {IFileSystemAdapter} from "./fs/types/IFileSystemAdapter.ts";

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


	get creationDate(): Date {
		return this.definition.creationTime;
	}


	get modificationDate(): Date {
		return this.definition.modificationTime;
	}

	/**
	 * Reads the content of the file.
	 *
	 * @return A promise that resolves to a Buffer containing the file content.
	 */
	public async readContent(): Promise<Buffer> {
		return this.fsAdapter.getFileContent(this.definition);
	}


	/**
	 * Downloads the file to the specified local path.
	 *
	 * @param localPath The path where the file should be saved.
	 *
	 * @returns The size of the downloaded file in bytes.
	 */
	public async download(localPath: string): Promise<number> {
		const content = await this.readContent();
		const fs = await import("fs/promises");
		await fs.writeFile(localPath, content);

		return content.length;
	}
}
