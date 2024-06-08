import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import Icons from "unplugin-icons/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    sveltekit(),
    Icons({
      compiler: "svelte",
    }),
    // ardupilot_vg to accomodate github pages
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/cesium/Build/Cesium/Workers/*",
          dest: "ardupilot_vg/Workers",
        },
        {
          src: "node_modules/cesium/Build/Cesium/ThirdParty/*",
          dest: "ardupilot_vg/ThirdParty",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Assets/*",
          dest: "ardupilot_vg/Assets",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Widgets/*",
          dest: "ardupilot_vg/Widgets",
        },
      ],
    }),
  ],
});
