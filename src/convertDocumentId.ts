export function convertDocumentId(documentId: string) {
  // if the documentId is 64 hexadecimal characters, it's probably a sha256 hash
  return documentId.match(/^[0-9a-f]{64}$/i) ? "sha256:" + documentId : documentId;
}
