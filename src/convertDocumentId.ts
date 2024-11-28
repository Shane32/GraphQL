export function convertDocumentId(documentId: string) {
  // if the documentId is 64 lowercase hexadecimal characters, it's probably a standardized
  // sha256 hash and should be prefixed with "sha256:" to indicate that
  return documentId.match(/^[0-9a-f]{64}$/) ? "sha256:" + documentId : documentId;
}
