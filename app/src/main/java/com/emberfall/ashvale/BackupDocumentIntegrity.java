package com.emberfall.ashvale;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

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

    /** Reject damaged UTF-8 rather than silently altering saved names or JSON values. */
    static String decodeUtf8(byte[] bytes) throws IOException {
        if (bytes == null) throw new IOException("Cannot decode backup document");
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException invalid) {
            throw new IOException("Backup document is not valid UTF-8", invalid);
        }
    }
}
