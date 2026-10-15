// Ergänzungen für Browser-APIs und Pakete ohne eigene Typen.

interface FileSystemHandle {
  queryPermission(optionen?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(optionen?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker(optionen?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}

declare module 'markdown-it-footnote'
declare module 'markdown-it-mark'
declare module '/node_modules/pagedjs/dist/paged.polyfill.js?url' {
  const url: string
  export default url
}
