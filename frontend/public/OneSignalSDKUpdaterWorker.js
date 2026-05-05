self.addEventListener("message", () => {
  // Required by some browsers during initial SW script evaluation.
});

importScripts("/push-sw.js");
