package com.emberfall.ashvale;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.nio.charset.StandardCharsets;
final class BillingSignature {
    static boolean verify(byte[] publicKey, String data, byte[] signed) {
        try {
            PublicKey key=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicKey));
            Signature verifier=Signature.getInstance("SHA1withRSA");
            verifier.initVerify(key); verifier.update(data.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(signed);
        } catch (Exception e) { return false; }
    }
}
