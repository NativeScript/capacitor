import {
  iosRootViewController,
  androidCreateDialog,
} from '@nativescript/capacitor/bridge';

/**
 * Try calling from Ionic with:
 *
 * import { native } from '@nativescript/capacitor';
 *
 * native.openNativeModalView();
 *
 * Reference:
 * iOS: https://developer.apple.com/library/archive/featuredarticles/ViewControllerPGforiPhoneOS/index.html
 * Android: https://developer.android.com/reference/android/widget/LinearLayout
 */

native.openNativeModalView = () => {
  if (native.isAndroid) {
    androidCreateDialog(() => {
      const activity = native.androidCapacitorActivity;

      const layout = new android.widget.LinearLayout(activity);
      layout.setGravity(android.view.Gravity.CENTER);
      layout.setOrientation(android.widget.LinearLayout.VERTICAL);

      const btn = new android.widget.Button(activity);
      btn.setText('Ionic');
      layout.addView(btn);

      const btn1 = new android.widget.Button(activity);
      btn1.setText('Capacitor');
      layout.addView(btn1);

      return layout;
    });
  } else {
    const vc = UIViewController.alloc().init();
    vc.view.backgroundColor = UIColor.blueColor;
    const label = UILabel.alloc().initWithFrame(
      CGRectMake(0, 30, UIScreen.mainScreen.bounds.size.width, 50),
    );
    label.text = `Well this is fun.`;
    label.textColor = UIColor.orangeColor;
    label.textAlignment = NSTextAlignment.Center;
    label.font = UIFont.systemFontOfSize(35);
    vc.view.addSubview(label);
    iosRootViewController().presentModalViewControllerAnimated(vc, true);
  }
};
