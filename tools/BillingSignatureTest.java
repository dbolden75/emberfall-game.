package com.emberfall.ashvale;
import java.security.*;
import java.nio.charset.StandardCharsets;
public class BillingSignatureTest {
 public static void main(String[] args)throws Exception{
  KeyPairGenerator g=KeyPairGenerator.getInstance("RSA");g.initialize(2048);KeyPair pair=g.generateKeyPair();
  String data="{\"purchaseState\":0,\"productId\":\"emberfall_aura_embers\"}";
  Signature s=Signature.getInstance("SHA1withRSA");s.initSign(pair.getPrivate());s.update(data.getBytes(StandardCharsets.UTF_8));byte[] sig=s.sign();
  if(!BillingSignature.verify(pair.getPublic().getEncoded(),data,sig))throw new AssertionError("valid signature rejected");
  if(BillingSignature.verify(pair.getPublic().getEncoded(),data+"tampered",sig))throw new AssertionError("tamper accepted");
  if(BillingSignature.verify(g.generateKeyPair().getPublic().getEncoded(),data,sig))throw new AssertionError("wrong key accepted");
  if(BillingSignature.verify(new byte[]{0},data,sig))throw new AssertionError("invalid key accepted");
  System.out.println("PASS: RSA receipt signature, tamper rejection, wrong key and malformed key.");
 }
}
