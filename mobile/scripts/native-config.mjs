// Settings Capacitor doesn't write for us. Safe to run again and again (it checks before adding).
//  - Invite links (https://floor2rafters.com/join/CODE) open the app on Android and iPhone.
//  - Portrait only, and the permission for phone notifications on Android 13+.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const HOST = "floor2rafters.com";
let changed = 0;
function edit(rel, fn) {
  const f = new URL(rel, root);
  if (!existsSync(f)) return console.log("skip (not created yet): " + rel);
  const before = readFileSync(f, "utf8"), after = fn(before);
  if (after !== before) { writeFileSync(f, after); changed++; console.log("updated " + rel); }
}

// ---- Android ----
edit("android/app/src/main/AndroidManifest.xml", (x) => {
  if (!x.includes('android:host="' + HOST + '"')) {
    const filter = `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${HOST}" android:pathPrefix="/join/" />
            </intent-filter>
`;
    // put it inside the main activity, right after its launcher intent-filter
    x = x.replace(/(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>\s*<\/intent-filter>)/, "$1" + filter);
  }
  if (!x.includes('android:screenOrientation')) x = x.replace(/<activity(\s)/, '<activity android:screenOrientation="portrait"$1');
  if (!x.includes("android.permission.POST_NOTIFICATIONS"))
    x = x.replace(/(<uses-permission android:name="android\.permission\.INTERNET"\s*\/>)/, '$1\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />');
  return x;
});

// ---- iPhone ----
const ENT = "ios/App/App/App.entitlements";
const entFile = new URL(ENT, root);
if (existsSync(new URL("ios/App/App/", root)) && !existsSync(entFile)) {
  writeFileSync(entFile, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`); changed++; console.log("created " + ENT);
}
edit(ENT, (x) => {
  if (!x.includes("com.apple.developer.associated-domains"))
    x = x.replace("<dict>", `<dict>
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:${HOST}</string>
	</array>`);
  if (!x.includes("aps-environment"))
    x = x.replace("<dict>", `<dict>
	<key>aps-environment</key>
	<string>production</string>`);
  return x;
});
edit("ios/App/App.xcodeproj/project.pbxproj", (x) => {
  // point the build at the entitlements file (once per build configuration)
  if (x.includes("CODE_SIGN_ENTITLEMENTS")) return x;
  return x.replace(/(INFOPLIST_FILE = App\/Info\.plist;)/g, "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\t$1");
});
edit("ios/App/App/Info.plist", (x) => {
  // portrait only on iPhone
  return x.replace(/(<key>UISupportedInterfaceOrientations<\/key>\s*<array>)[\s\S]*?(<\/array>)/,
    "$1\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t$2");
});
edit("ios/App/App/AppDelegate.swift", (x) => {
  // hand the phone's notification token to the app (Capacitor push notifications)
  if (x.includes("capacitorDidRegisterForRemoteNotifications")) return x;
  const add = `
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}
`;
  const i = x.lastIndexOf("}");
  return x.slice(0, i) + add.replace(/^\n/, "") + x.slice(i + 1);
});
console.log(changed ? "Native settings applied." : "Native settings already in place.");
