export interface IFileInfo {
	name: string;
	size: number; // in bytes
	isDirectory: boolean; // true if it's a directory, false if it's a file
	clusterNumber: number; // cluster number in the file system
	creationTime: Date; // creation time of the file or directory
	modificationTime: Date; // modification time of the file or directory
}
