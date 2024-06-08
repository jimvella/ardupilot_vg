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
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/cesium/Build/Cesium/Workers/*",
          dest: "Workers",
        },
        {
          src: "node_modules/cesium/Build/Cesium/ThirdParty/*",
          dest: "ThirdParty",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Assets/*",
          dest: "Assets",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Widgets/*",
          dest: "Widgets",
        },
      ],
    }),
  ],
});
