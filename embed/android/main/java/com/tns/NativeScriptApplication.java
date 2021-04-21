package com.tns;

import android.app.Application;
import com.tns.Runtime;
import com.tns.RuntimeHelper;
import java.io.File;

public class NativeScriptApplication extends Application {
    Runtime rt;
    private static NativeScriptApplication thiz;

    public NativeScriptApplication() {
        thiz = this;
    }

    public void onCreate() {
        super.onCreate();
        rt = RuntimeHelper.initRuntime(this);
        if(rt != null){
            File file = new File(getFilesDir(), "public/nativescript/index.js");
            rt.runModule(file);
        }
    }

    public static Application getInstance() {
        return thiz;
    }
}
