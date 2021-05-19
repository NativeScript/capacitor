/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { registerPlugin } from '@capacitor/core';

import type { NativeScriptCapPlugin } from './definitions';
import type { nativeAPI, nativeLogType, customNativeAPI } from './nativeapi';
export type { nativeAPI, customNativeAPI, NativeProperty } from './nativeapi';

const NativeScriptCap = registerPlugin<NativeScriptCapPlugin>(
  'NativeScriptCap',
  {
    web: () => import('./web').then(m => new m.NativeScriptCapWeb()),
  },
);

export * from './definitions';
export { NativeScriptCap };

// TODO: deal with memory tracking of callbacks
//  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry
//  Might also check for functions called "once" and "off" when a function is passed in and mark them to
//  be cleaned up on the first callback...

if (typeof (<any>window).native === 'undefined') {
  const NS_PROXY_ID = 'NS$id';
  const NS_PROXY_FUNCTION = 'NS$func';
  const NS_PROXY = 'NS$proxy';
  const NS_PROXY_PROP = 'NS$prop';
  const NS_PROXY_FULL_PROP = 'NS$fullProp';
  const NS_PROXY_CHILDREN = 'NS$children';
  const NS_PROXY_PARENT = 'NS$parent';
  const NS_PROXY_VALUE = 'NS$value';
  const NS_PROXY_IS_FUNCTION = 'NS$isFunction';
  const NS_FUNCTION_PENDING = 'NS$FunctionPending';
  const NS_FUNCTION_PENDING_LIST = 'NS$FunctionPendingList';
  const NS_PROXY_HAS_WAITING_VALUE = 'NS$hasWaitingValue';

  const NS_MARSHALL_STARTUP = 0;
  const NS_MARSHALL_STRING = 1;
  const NS_MARSHALL_FUNCTION = 2;
  const NS_MARSHALL_CONSTRUCTOR = 3;
  const NS_MARSHALL_GET = 4;
  const NS_MARSHALL_SET = 5;
  const NS_MARSHALL_PLATFORM = 6;
  const NS_MARSHALL_CALLBACK = 7;
  const NS_MARSHALL_CONSOLE = 1000;

  const DEBUGGING = true;

  // TODO: On Constructor and Function/Apply -- we should see if any values are promises;
  //  if they are promises then we should let them resolve before passing them
  //  This will allow us to do native.blah(native.hello.value); and it will work.  :-)

  const native_handler = {
    get: function (target: any, prop: any, receiver: any) {
      if (prop === 'isAndroid') {
        return (<any>window).native.__func.__android;
      } else if (prop === 'isIOS') {
        return (<any>window).native.__func.__ios;
      }
      if (prop === '__func') {
        return target;
      } else if (prop === '__isProxy') {
        return true;
      } else if (prop === 'run' || prop === 'get') {
        // TODO: Evaluate if we want to still support `native.get` and `native.run`
        return function (value: any) {
          return NativeScriptProxy.instance.marshallString(
            value,
            prop === 'get',
          );
        };
      } else {
        return NativeScriptProxy.instance._getter(target, prop, receiver);
      }
    },
    set: function (target: any, prop: any, value: any, receiver: any) {
      return NativeScriptProxy.instance._setter(target, prop, value, receiver);
    },
    construct: function () {
      throw new Error(
        "You are not supposed to do `new native()`, try nativeLog('hi');",
      );
    },
    apply: function () {
      throw new Error(
        "You are not supposed to do `native()`, try nativeLog('hi');",
      );
    },
  };

  const sub_handler = {
    // Target is the active Func
    // newTarget is the Proxy to the Func
    construct: function (target: any, argsList: any, newTarget: any) {
      target[NS_PROXY_IS_FUNCTION] = true;
      if (typeof target[NS_FUNCTION_PENDING] !== 'number') {
        target[NS_FUNCTION_PENDING] = 1;
        target[NS_FUNCTION_PENDING_LIST] = [];
      } else {
        target[NS_FUNCTION_PENDING]++;
      }
      NativeScriptProxy.instance.marshall(
        NS_MARSHALL_CONSTRUCTOR,
        target,
        target[NS_PROXY_PROP],
        argsList,
      );
      return newTarget;
    },
    get: function (target: any, prop: any, receiver: any) {
      return NativeScriptProxy.instance._getter(target, prop, receiver);
    },
    set: function (target: any, prop: any, value: any, receiver: any) {
      return NativeScriptProxy.instance._setter(target, prop, value, receiver);
    },
    apply: function (target: any, _thisArg: any, argumentsList: any) {
      if (DEBUGGING) {
        nativeLog(
          'Execute:',
          target[NS_PROXY_FULL_PROP] + '(',
          argumentsList,
          ')',
        );
      }
      target[NS_PROXY_IS_FUNCTION] = true;
      if (typeof target[NS_FUNCTION_PENDING] !== 'number') {
        target[NS_FUNCTION_PENDING] = 1;
        target[NS_FUNCTION_PENDING_LIST] = [];
      } else {
        target[NS_FUNCTION_PENDING]++;
      }
      NativeScriptProxy.instance.marshall(
        NS_MARSHALL_FUNCTION,
        target,
        target[NS_PROXY_PROP],
        argumentsList,
      );
      return target[NS_PROXY];
    },
  };

  class NativeScriptProxy {
    static instance: any;
    _id = 0;
    _trackingId = 0;
    _callbackId = 0;
    _tracking: any;
    _callbacks = [];

    constructor() {
      if (NativeScriptProxy.instance) {
        return NativeScriptProxy.instance[NS_PROXY];
      }
      NativeScriptProxy.instance = this;

      this._id = 0;
      this._trackingId = 0;
      this._tracking = {};

      const proxy = this.getProxy(null, 'native', native_handler);
      (<any>this)[NS_PROXY] = proxy;
      (<any>this)[NS_PROXY_FUNCTION] = proxy.__func;

      // Setup the Listener from NativeScript
      (<any>NativeScriptCap).addListener('fromNativeScript', (info: any) => {
        this.receiveMessage(info);
      });

      // Let the NS know we are here, fire this after we have returned the proxy object below
      setTimeout(() => {
        this.sendMessage({ cmd: NS_MARSHALL_STARTUP });
      }, 0);

      return proxy;
    }

    sendMessage(msg: any) {
      if (DEBUGGING) {
        nativeLog('Send Message', JSON.stringify(msg));
      }

      NativeScriptCap.notify({ value: JSON.stringify(msg) });
    }

    receiveMessage(msg: any) {
      if (DEBUGGING) {
        nativeLog('Received Message:', JSON.stringify(msg));
      }
      // Special case for Events and Messages directly from other side of bridge
      if (msg.tracking === -1) {
        switch (msg.cmd) {
          case NS_MARSHALL_PLATFORM:
            nativeLog(
              'Setting Platform to',
              msg.platform === true
                ? 'Android'
                : msg.platform === false
                ? 'ios'
                : 'unknown',
            );
            if (msg.platform) {
              (<any>window).native.__func.__android = true;
            } else {
              (<any>window).native.__func.__ios = true;
            }
            break;

          case NS_MARSHALL_CALLBACK:
            if (!this._callbacks[msg.id]) {
              nativeLog('Missing Callback', msg.id);
              return;
            }
            this._callbacks[msg.id].apply(null, msg.args);
            break;

          default:
            nativeLog('Unknown Receive message', msg.cmd);
        }
        return;
      }

      if (typeof msg.tracking === 'undefined') {
        throw new Error('RM: undefined TID, ' + JSON.stringify(msg));
      }

      const callbacks = this._tracking[msg.tracking];
      if (!callbacks) {
        throw new Error('RM: Missing TID, ' + JSON.stringify(msg));
      }
      delete this._tracking[msg.tracking];
      if (msg.error) {
        if (callbacks.reject) {
          callbacks.reject(msg.error);
        }
      } else {
        if (callbacks.resolve) {
          // TODO: .return doesn't seem to be used anymore; should revisit/delete? this code
          if (callbacks.return) {
            if (callbacks.func) {
              callbacks.func[NS_PROXY_HAS_WAITING_VALUE] =
                typeof msg.result !== 'undefined';
              if (typeof msg.result !== 'undefined') {
                callbacks.func[NS_PROXY_VALUE] = msg.result;
              }
            }
            callbacks.resolve(callbacks.return);
          } else {
            callbacks.resolve(msg.result);
          }
        } else if (callbacks.func) {
          callbacks.func[NS_PROXY_HAS_WAITING_VALUE] =
            typeof msg.result !== 'undefined';
          if (typeof msg.result !== 'undefined') {
            callbacks.func[NS_PROXY_VALUE] = msg.result;
          }
        } else {
          nativeLog('Unknown how to handle the Received results...');
        }
      }

      // Fire off any Getters on Functions that are awaiting the function finishing...
      if (callbacks.func[NS_PROXY_IS_FUNCTION]) {
        if (callbacks.func[NS_FUNCTION_PENDING] > 0) {
          while (callbacks.func[NS_FUNCTION_PENDING_LIST].length) {
            callbacks.func[NS_FUNCTION_PENDING]--;
            const func = callbacks.func[NS_FUNCTION_PENDING_LIST].pop();
            func();
          }
        }
      }
    }

    marshallString(value: any, returnObject: any) {
      if (DEBUGGING) {
        nativeLog('Marshall String:', value);
      }
      return new Promise((resolve, reject) => {
        let nextObject, wantsResults, func;
        let TID: any = ++this._trackingId;
        if (returnObject) {
          nextObject = this.getProxy(null, 'NATIVE', sub_handler);
          func = nextObject.__func;

          TID = 'T' + TID;
          this._tracking[TID] = {
            resolve,
            reject,
            func: func,
            return: nextObject,
          };
          wantsResults = true;
        } else {
          TID = 'R' + TID;
          this._tracking[TID] = { resolve, reject };
          wantsResults = false;
        }

        this.sendMessage({
          cmd: NS_MARSHALL_STRING,
          results: wantsResults,
          tracking: TID,
          value: value,
          parentObject: 0,
          nextObjID: func ? func[NS_PROXY_ID] : 0,
        });
      });
    }

    isPromise(p) {
      return p && Object.prototype.toString.call(p) === '[object Promise]';
    }

    fixArgs(value: any) {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async resolve => {
        if (value == null) {
          return resolve(null);
        }
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            value[i] = await this.fixArgs(value[i]);
          }
        } else if (typeof value.then === 'function') {
          value = await Promise.resolve(value);
        } else if (typeof value === 'function') {
          const idx = ++this._callbackId;
          const callId = '__NS_CALLBACK__' + idx;
          this._callbacks[idx] = value;
          value = callId;
        } else if (typeof value === 'number' || typeof value === 'string') {
          resolve(value);
          return;
        } else {
          const keys = Object.keys(value);
          if (!keys.length) {
            resolve(value.toString());
            return;
          }
          // eslint-disable-next-line @typescript-eslint/prefer-for-of
          for (let i = 0; i < keys.length; i++) {
            value[keys[i]] = await this.fixArgs(value[keys[i]]);
          }
        }
        resolve(value);
      });
    }

    marshall(type: any, func: any, prop: any, value: any = null) {
      if (DEBUGGING) {
        nativeLog('MARSHALL:', type, prop ? prop : '', value ? value : '');
      }

      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const TID = 'R' + ++this._trackingId;
        this._tracking[TID] = { resolve, reject, func };
        let newFunc = func;
        let results = prop;
        //nativeLog(newFunc[NS_PROXY_PARENT] != null  ? "Good" : "Null", newFunc[NS_PROXY_PARENT][NS_PROXY_IS_FUNCTION] ? "Function" : "Good")
        while (
          newFunc[NS_PROXY_PARENT] != null &&
          !newFunc[NS_PROXY_PARENT][NS_PROXY_IS_FUNCTION]
        ) {
          newFunc = newFunc[NS_PROXY_PARENT];
          results = newFunc[NS_PROXY_PROP] + '.' + results;
        }
        newFunc = newFunc[NS_PROXY_PARENT];
        const parent = newFunc[NS_PROXY_ID];
        const idx = results.lastIndexOf('.');
        let thisArg;
        if (idx) {
          thisArg = results.substr(0, idx);
        } else {
          thisArg = 'global';
        }

        if (DEBUGGING) {
          nativeLog('R:', results, parent, thisArg);
        }

        /*
                            const NS_MARSHALL_FUNCTION = 2;
                            const NS_MARSHALL_CONSTRUCTOR = 3;
                            const NS_MARSHALL_GET = 4;
                            const NS_MARSHALL_SET = 5;
                */

        if (value != null) {
          value = await this.fixArgs(value);
        }

        this.sendMessage({
          cmd: type,
          tracking: TID,
          value: results,
          thisArg: thisArg,
          parentObject: parent,
          nextObjID: func[NS_PROXY_ID],
          extra: value,
        });
      });
    }

    getNextId() {
      return this._id++;
    }

    getProxy(parent: any, prop: any, proxyClass: any) {
      if (parent && prop && parent[NS_PROXY_CHILDREN][prop]) {
        return parent[NS_PROXY_CHILDREN][prop][NS_PROXY];
      }

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const func = function () {};

      (<any>func)[NS_PROXY_ID] = this.getNextId();
      (<any>func)[NS_PROXY_PROP] = prop;
      (<any>func)[NS_PROXY_CHILDREN] = {};
      (<any>func)[NS_PROXY_IS_FUNCTION] = parent == null;
      (<any>func)[NS_PROXY_HAS_WAITING_VALUE] = false;

      //nativeLog("Prop", prop, parent == null ? "Null" : "Has Parent", func[NS_PROXY_IS_FUNCTION] ? "Func" : "Good");

      if (parent) {
        (<any>func)[NS_PROXY_PARENT] = parent;
        (<any>func)[NS_PROXY_FULL_PROP] =
          parent[NS_PROXY_FULL_PROP] + '.' + prop;
        parent[NS_PROXY_CHILDREN][prop] = func;
      } else {
        (<any>func)[NS_PROXY_FULL_PROP] = prop;
      }

      // Create Proxy Object
      const newProxy = new Proxy(func, proxyClass);
      (<any>func)[NS_PROXY] = newProxy;

      return newProxy;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _getter(target: any, prop: any, _receiver: any) {
      if (DEBUGGING) {
        if (
          typeof prop !== 'symbol' &&
          prop !== '__func' &&
          prop !== '__isProxy' &&
          prop !== 'then'
        ) {
          nativeLog('Getter:', target[NS_PROXY_FULL_PROP] + '.' + prop);
        }
      }
      switch (prop) {
        case 'then':
          return undefined;
        case 'symbol':
          return null;
        case 'toString':
          return function () {
            return '[NativeScript Proxy Object]';
          };
        case '__isProxy':
          return true;
        case '__func':
          return target;
        case 'set':
          return value => {
            return NativeScriptProxy.instance.marshall(
              NS_MARSHALL_SET,
              target,
              target[NS_PROXY_PROP],
              value,
            );
          };

        case 'get':
          nativeLog(
              'Getting Value',
              target[NS_PROXY_IS_FUNCTION] ? 'Function' : '',
              target[NS_PROXY_HAS_WAITING_VALUE] ? 'Waiting' : '',
          );
          if (
              target[NS_PROXY_IS_FUNCTION] ||
              target[NS_PROXY_HAS_WAITING_VALUE]
          ) {
            if (typeof target[NS_PROXY_VALUE] !== 'undefined') {
              const t = Promise.resolve(target[NS_PROXY_VALUE]);
              target[NS_PROXY_VALUE] = undefined;
              target[NS_PROXY_HAS_WAITING_VALUE] = false;
              return t;
            }

            // If the Function call is still pending, then we have to wait until it is done before we send the get...
            if (target[NS_FUNCTION_PENDING]) {
              return new Promise(resolve => {
                target[NS_FUNCTION_PENDING_LIST].push(resolve);
              }).then(() => {
                if (target[NS_PROXY_HAS_WAITING_VALUE]) {
                  if (typeof target[NS_PROXY_VALUE] !== 'undefined') {
                    const t = Promise.resolve(target[NS_PROXY_VALUE]);
                    target[NS_PROXY_VALUE] = undefined;
                    target[NS_PROXY_HAS_WAITING_VALUE] = false;
                    return t;
                  }
                }
                return NativeScriptProxy.instance.marshall(
                    NS_MARSHALL_GET,
                    target,
                    target[NS_PROXY_PROP],
                );
              });
            }
          }
          return NativeScriptProxy.instance.marshall(
              NS_MARSHALL_GET,
              target,
              target[NS_PROXY_PROP],
          );
        default:
          return NativeScriptProxy.instance.getProxy(target, prop, sub_handler);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _setter(target: any, prop: any, value: any, _receiver: any) {
      if (DEBUGGING) {
        nativeLog(
          'Setter:',
          target[NS_PROXY_FULL_PROP] + '.' + prop,
          '=',
          value,
        );
      }
      let newTarget;
      if (target[NS_PROXY_CHILDREN][prop]) {
        newTarget = target[NS_PROXY_CHILDREN][prop];
      } else {
        const tempProxy = NativeScriptProxy.instance.getProxy(
          target,
          prop,
          sub_handler,
        );
        newTarget = tempProxy.__func;
      }
      return NativeScriptProxy.instance.marshall(
        NS_MARSHALL_SET,
        newTarget,
        prop,
        value,
      );
    }
  }

  (<any>window).nativeLog = function (...args) {
    // const results = Array.prototype.join.call(args, " ");
    // console.log("Sending to native.Log", results);
    NativeScriptCap.notify({
      value: JSON.stringify({ cmd: NS_MARSHALL_CONSOLE, log: args }),
    });
  };

  (<any>window).native = new NativeScriptProxy();
}

export const native: typeof nativeAPI & customNativeAPI = (<any>window).native;
export const nativeLog: nativeLogType = (<any>window).nativeLog;
