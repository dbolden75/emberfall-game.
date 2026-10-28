package com.emberfall.ashvale;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public final class BackupDocumentIntegrityTest {
    private static int passed = 0;

    private static void pass(InputStream stream, byte[] bytes) throws Exception {
        BackupDocumentIntegrity.verify(stream, bytes);
        passed++;
    }
    private static void fail(InputStream stream, byte[] bytes) throws Exception {
        try {
            BackupDocumentIntegrity.verify(stream, bytes);
            throw new AssertionError("Accepted an unverified document");
        } catch (IOException expected) {
            passed++;
        }
    }

    public static void main(String[] args) throws Exception {
        byte[] backup = "{\"format\":\"thornhaven-save\",\"name\":\"Éowyn\"}".getBytes(StandardCharsets.UTF_8);
        pass(new ByteArrayInputStream(backup), backup);
        pass(new ByteArrayInputStream(new byte[0]), new byte[0]);
        byte[] altered = backup.clone(); altered[8] ^= 1;
        fail(new ByteArrayInputStream(altered), backup);
        fail(new ByteArrayInputStream(Arrays.copyOf(backup, backup.length - 1)), backup);
        fail(new ByteArrayInputStream(Arrays.copyOf(backup, backup.length + 1)), backup);
        fail(null, backup);
        fail(new ByteArrayInputStream(backup), null);
        byte[] big = new byte[1048576];
        for (int i = 0; i < big.length; i++) big[i] = (byte)(i * 31);
        pass(new ByteArrayInputStream(big) {
            @Override public synchronized int read(byte[] b, int off, int len) {
                return super.read(b, off, Math.min(7, len));
            }
        }, big);
        fail(new InputStream() {
            @Override public int read() throws IOException { throw new IOException("Provider read failed"); }
        }, backup);
        System.out.println("PASS: " + passed + " document round-trip checks, including truncation, changed bytes, extra bytes, read failure, and chunked reads.");
    }
}
