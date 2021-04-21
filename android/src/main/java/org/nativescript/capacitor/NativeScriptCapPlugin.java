package org.nativescript.capacitor;

import androidx.annotation.Nullable;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeScriptCap")
public class NativeScriptCapPlugin extends Plugin {
    @Nullable
    public static NativeScriptCapPluginListener listener = null;

    @Override
    public void load() {
        super.load();
        if (listener != null) {
            listener.setup(this);
        }
    }

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void notify(PluginCall call) {
        if (listener != null) {
            listener.notify(call.getString("value"));
        }
    }
}
