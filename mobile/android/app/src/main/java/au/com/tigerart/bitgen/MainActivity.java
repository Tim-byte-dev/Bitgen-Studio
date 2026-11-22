package au.com.tigerart.bitgen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LanInfoPlugin.class);   // 2.913.0: 📶 the phone's Wi-Fi address (find bitGen Studio on it)
        super.onCreate(savedInstanceState);
    }
}
