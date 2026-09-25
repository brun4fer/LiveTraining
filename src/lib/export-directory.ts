export type ExportDirectory = FileSystemDirectoryHandle;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

export async function pickExportDirectory(): Promise<ExportDirectory | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  return picker({ mode: "readwrite" });
}

export async function writeBlobToDirectory(directory: ExportDirectory, path: string, blob: Blob) {
  const fileHandle = await getExportFileHandle(directory, path);
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

export async function writeUrlToDirectory(directory: ExportDirectory, path: string, url: string, onProgress?: (progress: number | null) => void) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`The video download failed (${response.status}).`);
  if (!response.body) throw new Error("This browser could not read the video download.");
  const fileHandle = await getExportFileHandle(directory, path);
  const writable = await fileHandle.createWritable();
  const reader = response.body.getReader();
  const total = Number(response.headers.get("content-length") || 0);
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      received += value.byteLength;
      onProgress?.(total > 0 ? Math.min(1, received / total) : null);
    }
    await writable.close();
    onProgress?.(1);
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

async function getExportFileHandle(directory: ExportDirectory, path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) throw new Error("The export file path is empty.");

  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  return current.getFileHandle(parts.at(-1) as string, { create: true });
}

export function isExportPickerCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

