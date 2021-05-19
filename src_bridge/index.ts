// Only True if using the Browser Test Harness
const NS_IS_TESTING_HARNESS = false;

// Marshall values over the bridge
const NS_MARSHALL_STARTUP = 0;
const NS_MARSHALL_STRING = 1;
const NS_MARSHALL_FUNCTION = 2;
const NS_MARSHALL_CONSTRUCTOR = 3;
const NS_MARSHALL_GET = 4;
const NS_MARSHALL_SET = 5;
const NS_MARSHALL_PLATFORM = 6;
const NS_MARSHALL_CALLBACK = 7;

const NS_MARSHALL_CONSOLE = 1000;

declare var NativeScriptCapPlugin, org, com;

let NativeBridge;
class NativeInterface {
  static instance = null;
  _active: boolean = false;
  _source: any = null;
  _listener: any = null;
  _capacitor: any = null;
  _debugging = false;
  _objectTracking = {};
  _isFunction = {};
  sendResponse: any;

  constructor() {
    if (NativeInterface.instance) {
      return NativeInterface.instance;
    }
    NativeInterface.instance = this;
    this._source = null;

    if (NS_IS_TESTING_HARNESS) {
      this.sendResponse = msg => {
        (<any>window).NativeScriptCap.sendResponse(msg);
      };
      (<any>window).NativeScriptCap.addListener('toNativeScript', msg => {
        let newMsg = JSON.parse(msg.value);
        this.handleMessage({ data: newMsg });
      });
      return;
    }

    // @ts-ignore
    if (global.android) {
      this.sendResponse = this._sendResponseAndroid;
      this._listener = new (<any>(
        org
      )).nativescript.capacitor.NativeScriptCapPluginListener({
        notify: (message: string) => {
          // console.log('notify:', message)
          NativeInterface.instance.handleMessage({
            data: JSON.parse(message),
          });
        },
        setup: (instance: any) => {
          // console.log('setup instance:', instance);
          this._capacitor = instance;
          global.androidCapacitorActivity = instance.getActivity();
        },
      });
      (<any>(
        org
      )).nativescript.capacitor.NativeScriptCapPlugin.listener = this._listener;
    } else {
      this.sendResponse = this._sendResponseIOS;

      NativeScriptCapPlugin.setup(
        instance => {
          this._capacitor = instance;
        },
        message => {
          NativeInterface.instance.handleMessage({
            data: JSON.parse(message),
          });
        },
      );
    }
  }

  _createCallback(value) {
    let id = parseInt(value.substr(15), 10);
    return (...args) => {
      this.sendResponse({
        tracking: -1,
        id: id,
        cmd: NS_MARSHALL_CALLBACK,
        args: args,
      });
    };
  }

  _setupCallbacks(values) {
    if (values == null) {
      return values;
    }
    if (typeof values === 'number') {
      return values;
    }
    if (typeof values === 'string') {
      if (values.startsWith('__NS_CALLBACK__')) {
        values = this._createCallback(values);
      }
    } else if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        values[i] = this._setupCallbacks(values[i]);
      }
    } else {
      let keys = Object.keys(values);
      for (let i = 0; i < keys.length; i++) {
        values[keys[i]] = this._setupCallbacks(values[keys[i]]);
      }
    }
    return values;
  }

  handleMessage(msg: any) {
    runOnUIThread(() => {
      if (this._debugging && msg.data && msg.data.cmd !== 1000) {
        console.log(msg.data);
      }
      if (msg.data.extra != null) {
        msg.data.extra = this._setupCallbacks(msg.data.extra);
      }
      switch (msg.data.cmd) {
        case NS_MARSHALL_STARTUP:
          this._active = true;
          // @ts-ignore
          this.sendResponse({
            tracking: -1,
            cmd: NS_MARSHALL_PLATFORM,
            platform: !!(<any>global).android,
          });
          break;

        case NS_MARSHALL_STRING:
          this.handleStringCommand(msg.data);
          break;

        case NS_MARSHALL_FUNCTION:
          this.handleFunctionCommand(msg.data);
          break;

        case NS_MARSHALL_CONSTRUCTOR:
          this.handleConstructorCommand(msg.data);
          break;

        case NS_MARSHALL_GET:
          this.handleGetCommand(msg.data);
          break;

        case NS_MARSHALL_SET:
          this.handleSetCommand(msg.data);
          break;

        case NS_MARSHALL_CONSOLE:
          if (this._debugging) {
            console.log('Ionic:', msg.data.log);
          }
          break;

        default:
          console.log('Unknown Message', msg.data.cmd);
      }
    });
  }

  _sendResponseAndroid(msg) {
    if (!this._capacitor) {
      console.error('Capacitor is not defined.');
      return;
    }
    try {
      this._capacitor.notifyListeners(
        'fromNativeScript',
        new com.getcapacitor.JSObject(JSON.stringify(msg)),
      );
    } catch (err) {
      console.error(err);
    }
  }

  _sendResponseIOS(msg) {
    if (!this._capacitor) {
      console.error('Capacitor is not defined.');
      return;
    }
    if (this._debugging) {
      console.log('Sending Response to ios', msg);
    }
    this._capacitor.notifyListenersData(
      'fromNativeScript',
      NSDictionary.dictionaryWithDictionary(msg),
    );
  }

  /**
   * Returns a Value from a property/variable
   * @param parent
   * @param command
   */
  runGetCommand(parent: any, command: string) {
    if (parent) {
      command = 'parent.' + command;
    }
    if (this._debugging) {
      console.log('Running Command', command);
    }
    //console.log("Run Got: ", val);

    return eval(command);
  }

  /**
   * Runs a Function
   * @param parent
   * @param command
   * @param thisArg
   * @param variables
   */
  runFunctionCommand(
    parent: any,
    command: string,
    thisArg: any,
    variables: any,
  ) {
    if (parent) {
      command = 'parent.' + command;
    }
    if (this._debugging) {
      console.log('Running Command', command, thisArg, variables);
    }
    return eval(command + '(...variables);');
  }

  /**
   * Runs a Constructor
   * @param parent
   * @param command
   * @param variables
   */
  runConstructorCommand(parent: any, command: string, variables: any) {
    if (parent) {
      command = 'parent.' + command;
    }
    if (this._debugging) {
      console.log('Running Command', command, variables);
    }
    // TODO: Reflect.construct(func, args) might be a lot faster, needs to be tested on iOS
    return eval('new ' + command + '(...variables);');
  }

  /**
   * Sets a variable/property
   * @param parent
   * @param curObject
   * @param command
   * @param value
   */
  runSetCommand(parent: any, curObject: any, command: string, value: string) {
    if (parent) {
      command = 'parent.' + command;
    } else if (curObject) {
      command = 'curObject';
    }

    if (this._debugging) {
      console.log('Running Command', command + ' =', value);
    }
    eval(command + '=value;');
    // @ts-ignore
    // console.log(global.testClass);
  }

  /**
   * This handles the Get Message
   * @param msg
   */
  handleGetCommand(msg: any) {
    let parent;
    if (msg.parentObject) {
      parent = this._objectTracking[msg.parentObject];
    }

    try {
      let result;
      if (this._isFunction[msg.nextObjID]) {
        result = this._objectTracking[msg.nextObjID];
      } else {
        result = this.runGetCommand(parent, msg.value);
        //console.log(result);
      }
      // Get "Properties/Variables" objects shouldn't be cached
      //this._objectTracking[msg.nextObjID] = result;
      this.sendResponse({
        tracking: msg.tracking,
        result: result.toString() ?? '',
      });
    } catch (err) {
      if (this._debugging) {
        console.log('HandleGetCommand Error:', err, err.stack);
      }
      this.sendResponse({
        tracking: msg.tracking,
        error: err ? err.toString() : null,
      });
      return;
    }
  }

  /**
   * This handles the Set Message
   * @param msg
   */
  handleSetCommand(msg: any) {
    let parent, curObject;
    if (msg.parentObject) {
      parent = this._objectTracking[msg.parentObject];
    }
    if (typeof this._objectTracking[msg.nextObjID] !== 'undefined') {
      parent = null;
      curObject = this._objectTracking[msg.nextObjID];
    }

    try {
      this.runSetCommand(parent, curObject, msg.value, msg.extra);
      // I don't believe we can track a "Set" because the prop will be off of a different structure
      // We need to re-set this value directly when ever a set...
      // this._objectTracking[msg.nextObjID] = result;
      this.sendResponse({ tracking: msg.tracking });
    } catch (err) {
      if (this._debugging) {
        console.log('HandleSetCommand Error:', err, err.stack);
      }
      this.sendResponse({
        tracking: msg.tracking,
        error: err ? err.toString() : null,
      });
      return;
    }
  }

  /**
   * This handles the Function Message
   * @param msg
   */
  handleFunctionCommand(msg: any) {
    let parent;
    if (msg.parentObject) {
      parent = this._objectTracking[msg.parentObject];
    }

    try {
      let thisArg = msg.thisArg;
      if (this._isFunction[msg.parentObject]) {
        console.log('Replacing Parent with', parent);
        thisArg = parent;
      }

      // check for callback interface methods
      let result = this.runFunctionCommand(
        parent,
        msg.value,
        thisArg,
        msg.extra,
      );
      this._objectTracking[msg.nextObjID] = result;
      this._isFunction[msg.nextObjID] = true;
      if (result == null) {
        this.sendResponse({ tracking: msg.tracking });
      } else {
        this.sendResponse({ tracking: msg.tracking, result: result });
      }
    } catch (err) {
      if (this._debugging) {
        console.log('HandleFunctionCommand Error:', err, err.stack);
      }
      this.sendResponse({
        tracking: msg.tracking,
        error: err ? err.toString() : null,
      });
      return;
    }
  }

  /**
   * This handles the Constructor Message
   * @param msg
   */
  handleConstructorCommand(msg: any) {
    let parent;
    if (msg.parentObject) {
      parent = this._objectTracking[msg.parentObject];
    }

    try {
      let result = this.runConstructorCommand(parent, msg.value, msg.extra);
      this._objectTracking[msg.nextObjID] = result;
      this._isFunction[msg.nextObjID] = true;
      this.sendResponse({ tracking: msg.tracking, result: result });
    } catch (err) {
      if (this._debugging) {
        console.log('HandleConstructCommand Error:', err, err.stack);
      }
      this.sendResponse({
        tracking: msg.tracking,
        error: err ? err.toString() : null,
      });
      return;
    }
  }

  /**
   * This handles a Raw String
   * @param msg
   */
  handleStringCommand(msg: any) {
    if (msg.results === false) {
      try {
        if (msg.value.startsWith('native.')) {
          eval(msg.value.substr(7));
        } else {
          eval(msg.value);
        }
      } catch (err) {
        this.sendResponse({
          tracking: msg.tracking,
          error: err ? err.toString() : null,
        });
        return;
      }
      this.sendResponse({ tracking: msg.tracking });
      return;
    } else {
      // No need for a Parent, never will be one from the String Command
      try {
        const result = eval(msg.value);
        if (msg.nextObjID > 0) {
          this._objectTracking[msg.nextObjID] = result;
          this.sendResponse({
            tracking: msg.tracking,
            result: result.toString() ?? '',
          });
        }
      } catch (err) {
        this.sendResponse({
          tracking: msg.tracking,
          error: err ? err.toString() : 'Unknown error',
        });
        return;
      }
    }
  }
}

if (typeof NativeBridge === 'undefined') {
  NativeBridge = new NativeInterface();
  global.isAndroid = !!global.android;
  global.isIOS = !global.android;
  global.native = global;
}

export const iosRootViewController = () => {
  if (global.android) {
    console.log('iosRootViewController is iOS only.');
  } else {
    const app = UIApplication.sharedApplication;
    const win =
      app.keyWindow ||
      (app.windows && app.windows.count > 0 && app.windows.objectAtIndex(0));
    let vc = win.rootViewController;
    while (vc && vc.presentedViewController) {
      vc = vc.presentedViewController;
    }
    return vc;
  }
};

let androidBroadcastReceiverClass;
let androidRegisteredReceivers: { [key: string]: android.content.BroadcastReceiver };

function ensureBroadCastReceiverClass() {
	if (androidBroadcastReceiverClass) {
		return;
	}

	@NativeClass
	class BroadcastReceiver extends android.content.BroadcastReceiver {
		private _onReceiveCallback: (context: android.content.Context, intent: android.content.Intent) => void;

		constructor(onReceiveCallback: (context: android.content.Context, intent: android.content.Intent) => void) {
			super();
			this._onReceiveCallback = onReceiveCallback;

			return global.__native(this);
		}

		public onReceive(context: android.content.Context, intent: android.content.Intent) {
			if (this._onReceiveCallback) {
				this._onReceiveCallback(context, intent);
			}
		}
	}

	androidBroadcastReceiverClass = BroadcastReceiver;
}

export const androidBroadcastReceiverRegister = (intentFilter: string, onReceiveCallback: (context: android.content.Context, intent: android.content.Intent) => void): void => {
  ensureBroadCastReceiverClass();
  const registerFunc = (context: android.content.Context) => {
    const receiver: android.content.BroadcastReceiver = new androidBroadcastReceiverClass(onReceiveCallback);
    context.registerReceiver(receiver, new android.content.IntentFilter(intentFilter));
    if (!androidRegisteredReceivers) {
      androidRegisteredReceivers = {};
    }
    androidRegisteredReceivers[intentFilter] = receiver;
  };

  if (global.androidCapacitorActivity) {
    registerFunc(global.androidCapacitorActivity);
  }
}

export const androidBroadcastReceiverUnRegister = (intentFilter: string): void => {
  if (!androidRegisteredReceivers) {
    androidRegisteredReceivers = {};
  }
  const receiver = androidRegisteredReceivers[intentFilter];
  if (receiver) {
    global.androidCapacitorActivity.unregisterReceiver(receiver);
    androidRegisteredReceivers[intentFilter] = undefined;
    delete androidRegisteredReceivers[intentFilter];
  }
}

let DialogImpl;
let DialogFragmentImpl;
if (global.android) {
  @NativeClass()
  class DialogImplClass extends android.app.Dialog {
    constructor(fragment, context, themeResId) {
      super(context, themeResId);
      return global.__native(this);
    }
  }

  DialogImpl = DialogImplClass;

  @NativeClass()
  class DialogFragmentImplClass extends androidx.fragment.app.DialogFragment {
    view: () => android.view.View;
    id: string;
    constructor(
      view: () => android.view.View /* callback to create your android dialog view */,
      id?: string /* optional fragment id */,
    ) {
      super();
      this.view = view;
      this.id = id;
      return global.__native(this);
    }
    onCreateDialog(savedInstanceState) {
      super.onCreateDialog(savedInstanceState);

      const theme = this.getTheme();
      // In fullscreen mode, get the application's theme.
      // theme = activity.getApplicationInfo().theme;
      const dialog = new DialogImpl(this, global.androidCapacitorActivity, theme);
      dialog.setCanceledOnTouchOutside(true);
      return dialog;
    }
    onCreateView(inflater: any, container: any, savedInstanceState: any) {
      return this.view();
    }
  }
  DialogFragmentImpl = DialogFragmentImplClass;
}

export const androidCreateDialog = (
  view: () => android.view.View /* callback to create your android dialog view */,
  id?: string /* optional fragment id */,
) => {
  const df = new DialogFragmentImpl(view, id);
  const fragmentManager = (<any>global.androidCapacitorActivity).getSupportFragmentManager();
  df.show(fragmentManager, id || uniqueId());
};

// general internal utility
const uniqueId = () => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

export const runOnUIThread = (function () {
  if (global.android) {
    return function (func) {
      if (func) {
        /* Switch to this once multithreading is enabled by default
        const handler = new android.os.Handler(
          android.os.Looper.getMainLooper(),
        );
        handler.post(
          new java.lang.Runnable({
            run() {
              // run on main
              func();
            },
          }),
        );
        */
        func();
      }
    };
  } else {
    const runloop = CFRunLoopGetMain();
    return function (func) {
      if (runloop && func) {
        CFRunLoopPerformBlock(runloop, kCFRunLoopDefaultMode, func);
        CFRunLoopWakeUp(runloop);
      } else if (func) {
        func();
      }
    };
  }
})();
