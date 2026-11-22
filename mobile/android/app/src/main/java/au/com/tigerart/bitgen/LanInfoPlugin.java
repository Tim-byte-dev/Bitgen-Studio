package au.com.tigerart.bitgen;

// bitGen app (2.913.0): the phone's own Wi-Fi address, so the app can look for bitGen Studio on that network
// (www/lib/net.js hostsOf + scan). Tim: "if my phone is on the same wifi connection as the desktop ... connect
// automaticlly when i start the app". JS: Capacitor.Plugins.LanInfo.get() -> {wifi, ip, prefix}.

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.Inet4Address;

@CapacitorPlugin(name = "LanInfo")
public class LanInfoPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("wifi", false);
        ret.put("ip", "");
        ret.put("prefix", 0);
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network active = cm.getActiveNetwork();
                Network[] all = cm.getAllNetworks();
                Network[] order = new Network[all.length + 1];
                order[0] = active;
                System.arraycopy(all, 0, order, 1, all.length);
                for (Network n : order) {
                    if (n == null) continue;
                    NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                    if (caps == null) continue;
                    boolean lan = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                        || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
                    if (!lan) continue;
                    LinkProperties lp = cm.getLinkProperties(n);
                    if (lp == null) continue;
                    for (LinkAddress la : lp.getLinkAddresses()) {
                        if (la.getAddress() instanceof Inet4Address && !la.getAddress().isLoopbackAddress()) {
                            ret.put("wifi", true);
                            ret.put("ip", la.getAddress().getHostAddress());
                            ret.put("prefix", la.getPrefixLength());
                            call.resolve(ret);
                            return;
                        }
                    }
                }
            }
        } catch (Exception e) {
            ret.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(ret);
    }
}
