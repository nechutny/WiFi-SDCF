import type {EFileSystems} from "./fs/types/EFileSystems.ts";

export class UnsupportedFileSystemError {
  constructor(
	  public filesystemType: EFileSystems,
  ) {
  }
}
