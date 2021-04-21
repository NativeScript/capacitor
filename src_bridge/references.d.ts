/// <reference path="../node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="../node_modules/@nativescript/types-ios/index.d.ts" />
/// <reference path="../node_modules/@nativescript/types-android/lib/android-30.d.ts" />

declare module NodeJS  {
  interface Global {
      native?: NodeJS.Global & typeof globalThis;
      androidCapacitorActivity: android.app.Activity;
  }
}

