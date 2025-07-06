export interface IFileInfo {
	name: string;
	size: number; // in bytes
	modifiedTime: Date; // last modified time
	isDirectory: boolean; // true if it's a directory, false if it's a file
	permissions?: string; // optional, e.g., 'rwxr-xr-x'
	owner?: string; // optional, owner of the file or directory
	group?: string; // optional, group of the file or directory
}
