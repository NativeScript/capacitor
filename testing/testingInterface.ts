// This import is only used by this for Testing -- Copy everything after this chunk
class test {
    public blah = "original";
    funcCall() {
        console.log("Called FuncCall");
        return 1;
    }

    funcPromCall(a,b) {
        console.log("a",a,b);
        return null;
    }

    funcCallback(func) {
        setTimeout(() => func(1), 1000);
    }
}

class NativeScriptCap {
    static listeners = {fromNativeScript: [], toNativeScript: []};
    static addListener(event, callback) {
        if (typeof this.listeners[event] === 'undefined') {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    static sendResponse(value, event="fromNativeScript") {
        for (let i=0;i<this.listeners[event].length;i++) {
            this.listeners[event][i](value);
        }
    }

    static notify(data) {
        this.sendResponse(data, "toNativeScript");
    }

    /* static notify(data) {
        let msg = JSON.parse(data.value);
        if (msg.cmd !== NS_MARSHALL_CONSOLE) {
            console.log(msg);
        }
        switch (msg.cmd) {
            case NS_MARSHALL_STARTUP:
                this.sendResponse({
                    tracking: -1,
                    cmd: NS_MARSHALL_PLATFORM,
                    platform: true,
                });
                break;
            case NS_MARSHALL_GET:


            case NS_MARSHALL_PLATFORM:
            case NS_MARSHALL_CONSOLE:
                console.log(msg.log); break; // complete


            case NS_MARSHALL_CALLBACK:
                console.log("Callback");
                break;

            default:
                console.log("Unknown Command", msg.cmd);
        }
    } */
}

(<any>window).test = new test();
(<any>window).NativeScriptCap = NativeScriptCap;

// ---------------------------------------------------------
