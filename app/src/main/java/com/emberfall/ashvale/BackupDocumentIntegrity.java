package com.emberfall.ashvale;

import java.io.IOException;
import java.io.InputStream;

/** Confirms that a document provider retained every backup byte before success. */
final class BackupDocumentIntegrity {
    private BackupDocumentIntegrity() {}

    static void verify(InputStream stream, byte[] expected) throws IOException {
        if (stream == null || expected == null) throw new IOException("Cannot verify backup document");
        byte[] buffer = new byte[8192];
        int offset = 0;
        int count;
        int emptyReads = 0;
        while ((count = stream.read(buffer)) != -1) {
            // Broken document providers may return zero forever instead of
            // EOF or bytes. Never hang the backup executor indefinitely.
            if (count == 0) {
                if (++emptyReads >= 16) throw new IOException("Document provider repeatedly returned no bytes");
                continue;
            }
            emptyReads = 0;
            if (count > expected.length - offset) throw new IOException("Backup document contains extra data");
            for (int i = 0; i < count; i++) {
                if (buffer[i] != expected[offset + i]) throw new IOException("Backup document differs from exported data");
            }
            offset += count;
        }
        if (offset != expected.length) throw new IOException("Backup document was truncated");
    }
}
