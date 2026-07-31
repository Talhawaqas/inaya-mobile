// polyfills.js
// Required global shims for @metamask/connect-multichain in React Native.
// Must be imported AFTER react-native-get-random-values but BEFORE any
// SDK code — see the import order in App.js.

import { Buffer } from 'buffer';

global.Buffer = Buffer;

let windowObj;

if (typeof global !== 'undefined' && global.window) {
  windowObj = global.window;
} else if (typeof window !== 'undefined') {
  windowObj = window;
} else {
  windowObj = {};
}

if (!windowObj.location) {
  windowObj.location = {
    hostname: 'inayanetwork.com',
    href: 'https://inayanetwork.com',
  };
}

if (typeof windowObj.addEventListener !== 'function') {
  windowObj.addEventListener = () => {};
}
if (typeof windowObj.removeEventListener !== 'function') {
  windowObj.removeEventListener = () => {};
}
if (typeof windowObj.dispatchEvent !== 'function') {
  windowObj.dispatchEvent = () => true;
}

// On web, `global` IS `window`, and `window.window` is a read-only
// self-reference getter — assigning it throws a TypeError that Metro
// swallows silently, leaving the app rendering nothing. Only assign when
// global is a distinct object (i.e. React Native's JS global, not a browser).
if (typeof global !== 'undefined' && global !== windowObj) {
  global.window = windowObj;
}

// Note: @metamask/connect-multichain uses eventemitter3 internally and
// does NOT need Event/CustomEvent polyfills (those are only required if
// also using Wagmi) — omitted deliberately, not an oversight.