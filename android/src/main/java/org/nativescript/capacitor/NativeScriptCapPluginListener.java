package org.nativescript.capacitor;

import androidx.annotation.Nullable;

public interface NativeScriptCapPluginListener {
    void setup(NativeScriptCapPlugin instance);
    void notify(@Nullable String message);
}
