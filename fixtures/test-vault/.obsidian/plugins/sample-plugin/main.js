// Sample browser-safe plugin
module.exports = class SamplePlugin {
  onload() {
    console.log("[SamplePlugin] loaded");
  }

  onunload() {
    console.log("[SamplePlugin] unloaded");
  }
};
