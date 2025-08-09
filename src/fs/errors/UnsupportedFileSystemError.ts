import type {EFileSystems} from "../types/EFileSystems.ts";

export class UnsupportedFileSystemError {
  constructor(
	  public filesystemType: EFileSystems,
  ) {
  }
}
