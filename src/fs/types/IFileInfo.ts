export interface IFileInfo {
	name: string;

	/**
	 * Size of file in bytes
	 */
	size: number;
	isDirectory: boolean;

	/**
	 * Cluster number where the file or directory starts in the file system.
	 * This is used to locate the file or directory on the storage medium.
	 */
	clusterNumber: number;

	creationTime: Date;
	modificationTime: Date;
}
