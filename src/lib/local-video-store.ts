const DATABASE_NAME = "analise-equipa-local-videos";
const STORE_NAME = "training-videos";
const PARTS_STORE_NAME = "training-video-parts";
const VERSION = 2;
export const MAX_PERSISTED_VIDEO_SIZE = 1024 * 1024 * 1024;

type StoredVideo = { trainingId: string; file: File; savedAt: number };
export type LocalVideoFileHandle = {
  name: string;
  getFile(): Promise<File>;
  queryPermission?(options?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
};
export type LocalTrainingVideoPart = {
  id: string;
  trainingId: string;
  partNumber: number;
  startTimeSeconds: number;
  durationSeconds: number;
  fileName: string;
  file: File;
  savedAt: number;
};
type StoredVideoPart = Omit<LocalTrainingVideoPart, "file"> & {
  file?: File;
  fileHandle?: LocalVideoFileHandle;
};

// Multi-GB videos remain available while navigating inside the same browser
// session without being copied into IndexedDB or uploaded to the server.
const sessionVideos = new Map<string, File>();
const sessionVideoParts = new Map<string, LocalTrainingVideoPart[]>();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local video storage is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "trainingId" });
      }
      if (!database.objectStoreNames.contains(PARTS_STORE_NAME)) {
        const parts = database.createObjectStore(PARTS_STORE_NAME, { keyPath: "id" });
        parts.createIndex("trainingId", "trainingId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local storage."));
  });
}

export async function rememberTrainingVideoPart(input: Omit<LocalTrainingVideoPart, "id" | "savedAt">, fileHandle?: LocalVideoFileHandle) {
  const part: LocalTrainingVideoPart = {
    ...input,
    id: `${input.trainingId}:${input.partNumber}`,
    savedAt: Date.now(),
  };
  const current = sessionVideoParts.get(input.trainingId) || [];
  sessionVideoParts.set(input.trainingId, [...current.filter((item) => item.partNumber !== input.partNumber), part].sort((a, b) => a.partNumber - b.partNumber));

  const database = await openDatabase();
  try {
    const stored: StoredVideoPart = {
      id: part.id,
      trainingId: part.trainingId,
      partNumber: part.partNumber,
      startTimeSeconds: part.startTimeSeconds,
      durationSeconds: part.durationSeconds,
      fileName: part.fileName,
      savedAt: part.savedAt,
      ...(fileHandle ? { fileHandle } : part.file.size <= MAX_PERSISTED_VIDEO_SIZE ? { file: part.file } : {}),
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PARTS_STORE_NAME, "readwrite");
      transaction.objectStore(PARTS_STORE_NAME).put(stored);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the recording part in the browser."));
      transaction.onabort = () => reject(transaction.error || new Error("The browser could not remember the recording part."));
    });
  } finally {
    database.close();
  }
  return part;
}

export async function getRememberedTrainingVideoParts(trainingId: string) {
  const sessionParts = sessionVideoParts.get(trainingId);
  if (sessionParts?.length) return sessionParts;

  const database = await openDatabase();
  try {
    const stored = await new Promise<StoredVideoPart[]>((resolve, reject) => {
      const request = database.transaction(PARTS_STORE_NAME, "readonly").objectStore(PARTS_STORE_NAME).index("trainingId").getAll(trainingId);
      request.onsuccess = () => resolve((request.result as StoredVideoPart[] | undefined) || []);
      request.onerror = () => reject(request.error || new Error("Could not restore the local recording parts."));
    });
    const parts: LocalTrainingVideoPart[] = [];
    for (const item of stored.sort((a, b) => a.partNumber - b.partNumber)) {
      let file = item.file || null;
      if (!file && item.fileHandle) {
        try {
          const permission = await item.fileHandle.queryPermission?.({ mode: "read" });
          if (!permission || permission === "granted") file = await item.fileHandle.getFile();
        } catch {
          // The browser may require the folder to be selected again after a restart.
        }
      }
      if (file) parts.push({ ...item, file });
    }
    if (parts.length) sessionVideoParts.set(trainingId, parts);
    return parts;
  } finally {
    database.close();
  }
}

export async function rememberTrainingVideo(trainingId: string, file: File) {
  sessionVideos.set(trainingId, file);

  if (file.size > MAX_PERSISTED_VIDEO_SIZE) return;

  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ trainingId, file, savedAt: Date.now() } satisfies StoredVideo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the video in the browser."));
      transaction.onabort = () => reject(transaction.error || new Error("The browser does not have enough storage space."));
    });
  } finally {
    database.close();
  }
}

export function videoPersistsAfterRestart(file: Pick<File, "size">) {
  return file.size <= MAX_PERSISTED_VIDEO_SIZE;
}

export async function getRememberedTrainingVideo(trainingId: string) {
  const sessionFile = sessionVideos.get(trainingId);
  if (sessionFile) return sessionFile;

  const database = await openDatabase();
  try {
    const file = await new Promise<File | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(trainingId);
      request.onsuccess = () => resolve((request.result as StoredVideo | undefined)?.file || null);
      request.onerror = () => reject(request.error || new Error("Could not restore the local video."));
    });
    if (file) sessionVideos.set(trainingId, file);
    return file;
  } finally {
    database.close();
  }
}
