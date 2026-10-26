package com.emberfall.ashvale;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/** Explicit, session-only HTTPS transport. The game WebView stays offline. */
public final class PlaytestConnection {
    private final Activity activity;
    private final WebView view;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile HttpsURLConnection connection;
    private volatile boolean closed;
    public PlaytestConnection(Activity a, WebView v) { activity=a; view=v; }
    @JavascriptInterface public void send(String endpoint, String token, String body) {
        if (closed || !busy.compareAndSet(false,true)) return;
        worker.execute(() -> {
            String id="";
            try {
                JSONObject data=new JSONObject(body); id=data.getString("id");
                URL url=new URL(endpoint);
                if (!"https".equals(url.getProtocol()) || url.getUserInfo()!=null || url.getRef()!=null
                        || token.length()<32 || token.length()>512 || token.startsWith("sk-")
                        || token.contains("\r") || token.contains("\n")) throw new Exception();
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
                if (bytes.length>1500000 || id.length()>100) throw new Exception();
                HttpsURLConnection c=(HttpsURLConnection)url.openConnection(); connection=c;
                c.setInstanceFollowRedirects(false); c.setConnectTimeout(10000); c.setReadTimeout(15000);
                c.setRequestMethod("POST"); c.setDoOutput(true);
                c.setRequestProperty("Content-Type","application/json");
                c.setRequestProperty("Authorization","Bearer "+token);
                c.setFixedLengthStreamingMode(bytes.length);
                try(java.io.OutputStream out=c.getOutputStream()){out.write(bytes);}
                if (c.getResponseCode()!=200) throw new Exception();
                byte[] reply;
                try(java.io.InputStream in=c.getInputStream()){
                    java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();
                    byte[] buffer=new byte[1024];int count;
                    while((count=in.read(buffer))!=-1){
                        if(output.size()+count>4096)throw new Exception();
                        output.write(buffer,0,count);
                    }
                    reply=output.toByteArray();
                }
                if(reply.length>4096) throw new Exception();
                JSONObject ack=new JSONObject(new String(reply,StandardCharsets.UTF_8));
                if(!id.equals(ack.optString("accepted"))) throw new Exception();
                result(id,true);
            } catch(Exception e) { result(id,false); }
            finally { HttpsURLConnection c=connection;connection=null;if(c!=null)c.disconnect();busy.set(false); }
        });
    }
    private void result(String id, boolean ok) {
        final String script="window.dispatchEvent(new CustomEvent('playtestDelivery',{detail:{id:"
            +JSONObject.quote(id)+",ok:"+ok+"}}))";
        activity.runOnUiThread(() -> {if(!closed)view.evaluateJavascript(script,null);});
    }
    public void close(){closed=true;HttpsURLConnection c=connection;if(c!=null)c.disconnect();worker.shutdownNow();}
}
