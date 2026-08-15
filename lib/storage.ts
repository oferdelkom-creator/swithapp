// Extracts a safe, lowercase file extension (e.g. ".jpg") to use in a storage object
// key instead of the original filename verbatim - avoids upload failures from
// non-ASCII characters, spaces, or other symbols a phone/OS might put in a filename
// (e.g. a Hebrew-named file, or an emoji dropped in by a share-sheet). Falls back to
// no extension if none is found rather than guessing.
export function safeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : "";
}
