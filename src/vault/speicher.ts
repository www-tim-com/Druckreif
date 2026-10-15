// Merkt sich den Ordner-Zugriff (FileSystemDirectoryHandle) in IndexedDB für die nächste Sitzung.

const DB = 'druckreif'
const STORE = 'freigaben'

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB, 1)
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(STORE)
    anfrage.onsuccess = () => resolve(anfrage.result)
    anfrage.onerror = () => reject(anfrage.error)
  })
}

export async function merken(schluessel: string, wert: unknown): Promise<void> {
  const db = await oeffnen()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(wert, schluessel)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function holen<T>(schluessel: string): Promise<T | undefined> {
  const db = await oeffnen()
  return new Promise((resolve, reject) => {
    const anfrage = db.transaction(STORE).objectStore(STORE).get(schluessel)
    anfrage.onsuccess = () => resolve(anfrage.result as T | undefined)
    anfrage.onerror = () => reject(anfrage.error)
  })
}
