import type {Directory} from "./Directory.ts";
import {File} from "./File.ts";

export class WatchDirectory implements Disposable {

	protected alreadyDiscoveredFiles: {[fileName: string]: File} = {};

	public onNewFile: (file: File) => void = () => {};
	public onFileModified: (file: File) => void = () => {};
	public onFileRemoved: (file: File) => void = () => {};

	protected unstableFiles: {[fileName: string]: {size: number, detectedAt: number}} = {};
	protected checkInterval: number = 5_000;

	protected interval: NodeJS.Timeout | null = null;

	constructor(
		protected directory: Directory
	) {
	}

	/**
	 * Starts watching the directory for changes.
	 *
	 * @param interval The interval in milliseconds to check for changes. Default is 5 000 ms.
	 */
	public start(interval = 5_000): void {
		this.checkInterval = interval;
		if(this.interval) {
			clearInterval(this.interval);
		}

		this.interval = setInterval(() => this.detectChanges(), interval);
		this.initExistingFiles();
		this.detectChanges();
	}


	[Symbol.dispose]() {
		this.destroy();
	}


	public destroy(): void {
		if(this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.onNewFile = () => {};
		this.onFileRemoved = () => {};
		this.onFileModified = () => {};
		this.alreadyDiscoveredFiles = {};
		this.unstableFiles = {};
	}


	protected async initExistingFiles(): Promise<void> {
		const files: File[] = (await this.directory.list(true))
			.filter((entry) => entry instanceof File) as File[];

		for(const file of files) {
			this.alreadyDiscoveredFiles[file.name] = file;
		}
	}


	protected async detectChanges(): Promise<void> {
		const files: File[] = (await this.directory.list(true))
			.filter((entry) => entry instanceof File);

		const newFiles: File[] = [];
		const modifiedFiles: File[] = [];
		const removedFiles: File[] = [];

		const currentFiles: {[fileName: string]: File} = {};
		for(const file of files) {
			currentFiles[file.name] = file;
		}

		// Check for new or modified files
		for(const file of files) {
			const existingFile = this.alreadyDiscoveredFiles[file.name];
			const unstableFile = this.unstableFiles[file.name];

			if(existingFile) {
				// File already known and stable, check changes
				if(existingFile.modificationDate.getTime() !== file.modificationDate.getTime() || existingFile.size !== file.size) {
					modifiedFiles.push(file);
					this.alreadyDiscoveredFiles[file.name] = file;
				}
			} else {
				// New or unstable file
				if(!unstableFile || unstableFile.size !== file.size) {
					// File is new or size has changed, add to unstable files
					this.unstableFiles[file.name] = {
						size: file.size,
						detectedAt: Date.now(),
					};
				}
			}
		}

		// Check unstable files for stability
		const now = Date.now();
		for(const fileName in this.unstableFiles) {
			const unstableFile = this.unstableFiles[fileName];
			const currentFile = currentFiles[fileName];

			if(currentFile && unstableFile.size === currentFile.size) {
				// Size is stable, check if it has been stable long enough
				if(now - unstableFile.detectedAt > this.checkInterval * 2) {
					// File is stable now
					newFiles.push(currentFile);
					this.alreadyDiscoveredFiles[fileName] = currentFile;
					delete this.unstableFiles[fileName];
				}
			} else if(!currentFile) {
				// File is no longer present, remove from unstable files
				delete this.unstableFiles[fileName];
			}
		}

		// Check for removed files
		// Any file that was previously discovered but is not in currentFiles is considered removed
		for(const fileName in this.alreadyDiscoveredFiles) {
			if(!currentFiles[fileName]) {
				removedFiles.push(this.alreadyDiscoveredFiles[fileName]);
				delete this.alreadyDiscoveredFiles[fileName];
			}
		}

		newFiles.forEach((file) => this.onNewFile(file));
		modifiedFiles.forEach((file) => this.onFileModified(file));
		removedFiles.forEach((file) => this.onFileRemoved(file));
	}

}
