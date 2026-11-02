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

    private static void decodePass(String text) throws Exception {
        if (!text.equals(BackupDocumentIntegrity.decodeUtf8(text.getBytes(StandardCharsets.UTF_8))))
            throw new AssertionError("UTF-8 document text changed");
        passed++;
    }
    private static void decodeFail(byte[] bytes) throws Exception {
        try {
            BackupDocumentIntegrity.decodeUtf8(bytes);
            throw new AssertionError("Accepted a malformed UTF-8 backup");
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
        // A transient zero-byte provider read may recover and is acceptable.
        pass(new ByteArrayInputStream(backup) {
            private int zerosRemaining = 3;
            @Override public synchronized int read(byte[] b, int off, int len) {
                if (zerosRemaining-- > 0) return 0;
                return super.read(b, off, len);
            }
        }, backup);
        // A defective provider returning zero forever must terminate with an
        // error rather than spinning and blocking all later backup operations.
        fail(new InputStream() {
            @Override public int read() { return 0; }
            @Override public int read(byte[] b, int off, int len) { return 0; }
        }, backup);
        // Corrupt UTF-8 must not silently replace name or other JSON characters
        // with U+FFFD and risk a valid-looking but altered player backup.
        decodePass("{\"name\":\"Éowyn 🐉\",\"save\":true}");
        decodePass("");
        decodeFail(new byte[]{(byte)0x80}); // Lone continuation.
        decodeFail(new byte[]{(byte)0xC0, (byte)0xAF}); // Overlong slash.
        decodeFail(new byte[]{(byte)0xE2, (byte)0x82}); // Truncated sequence.
        decodeFail(new byte[]{(byte)0xED, (byte)0xA0, (byte)0x80}); // Encoded surrogate.
        decodeFail(new byte[]{(byte)0xF0, (byte)0x9F, (byte)0x90}); // Truncated emoji.
        decodeFail(null);
        System.out.println("PASS: " + passed + " document integrity / strict UTF-8 checks; malformed imports are rejected before changing character saves.");
    }
}
