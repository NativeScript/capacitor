import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(NativeScriptCapPlugin)
public class NativeScriptCapPlugin: CAPPlugin {
    @objc public static var _callback: ((NativeScriptCapPlugin) -> Void)? = nil
    @objc public static var _notify: ((String) -> Void)? = nil
    
    
    @objc public static func setup(_ callback: @escaping (NativeScriptCapPlugin) -> Void, _ notify: @escaping (String) -> Void) {
        NativeScriptCapPlugin._callback = callback
        NativeScriptCapPlugin._notify = notify
    }
    

    @objc func notify(_ call: CAPPluginCall){
        guard let value = call.getString("value") else { return }
        NativeScriptCapPlugin._notify!(value)
        
    }

    @objc public override func load() {
        NativeScriptCapPlugin._callback!(self)
    }
}
