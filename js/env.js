// Browser environment checks (pure, testable).
// In-app browsers (Facebook, Instagram, Line, Android WebView) often block Google sign-in.
export function isInAppBrowser(ua = '') {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|GSA\/|; wv\)/i.test(ua);
}
