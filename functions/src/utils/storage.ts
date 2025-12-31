export function createFirebaseStorageDownloadUrl(bucketName: string, objectPath: string, token: string): string {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

