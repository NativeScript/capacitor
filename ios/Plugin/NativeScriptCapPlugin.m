#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(NativeScriptCapPlugin, "NativeScriptCap",
           CAP_PLUGIN_METHOD(notify, CAPPluginReturnNone);
)
