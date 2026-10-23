// Hand-off from the user workspace to File uploads: "Upload report" in the user bar, or a file dropped
// on the workspace's drop zone, opens the upload dialog on the next page (with the file, if any).

let pending: { file?: File } | null = null;

export const requestUpload = (file?: File) => {
  pending = { file };
};

/** Returns the pending request once, then clears it. */
export const takeUpload = () => {
  const p = pending;
  pending = null;
  return p;
};
