import { WebPlugin } from '@capacitor/core';

import type { NativeScriptCapPlugin } from './definitions';

export class NativeScriptCapWeb
  extends WebPlugin
  implements NativeScriptCapPlugin {

  notify(options: {value: any}): void {
    console.log('NOTIFY', options);
    // throw new Error('Method not implemented.');
  }
}
