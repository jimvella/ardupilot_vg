<script lang="ts">
  if (window.location.hostname == "localhost") {
    window.CESIUM_BASE_URL = "/";
  } else {
    // Accomodate github pages
    window.CESIUM_BASE_URL = "/ardupilot_vg";
  }

  import {
    Ion,
    Math as CesiumMath,
    Terrain,
    Viewer,
    ImageryLayer,
    TrustedServers,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Color,
    NearFarScalar,
  } from "cesium";
  import "cesium/Build/Cesium/Widgets/widgets.css";
  import { onMount } from "svelte";

  export let onViewer: (i: Viewer) => void = (i) => {
    console.log("viewer consumer not installed");
  };

  let viewer;

  onMount(async () => {
    console.log("on mount");
    Ion.defaultAccessToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0ZTZiODk0MC1jZTNmLTQwMGItYWRiMi02MjMxMmYxZThhZjgiLCJpZCI6MTc4MTAzLCJpYXQiOjE2OTk5Mzk0MTV9.YdpBSGayCK2hi3ZxaFXf1xiRsmpQ9REMh-hU9rmqeW4";

    // Send credentials
    // https://cesium.com/learn/cesiumjs/ref-doc/TrustedServers.html
    TrustedServers.add("localhost", 8080);

    viewer = new Viewer("cesiumContainer", {
      //baseLayer: imageryLayerFromLayerName("world"),
      //imageryProvider: false,
      //baseLayerPicker: false,
      //geocoder: false,
      //timeline: false,
      //animation: false,
      //selectionIndicator: false,
      //creditContainer: document.createElement("none"),
      terrain: Terrain.fromWorldTerrain(),
      shadows: true,
      //terrainShadows: ShadowMode.ENABLED,
      msaaSamples: 8,
    });

    viewer.shadowMap.maximumDistance = 10000;

    // viewer.scene.postProcessStages.ambientOcclusion.enabled = false;
    // viewer.scene.postProcessStages.bloom.enabled = false;
    // viewer.scene.globe.enableLighting = true;
    // viewer.scene.globe.depthTestAgainstTerrain = true;
    // viewer.shadowMap.maxmimumDistance = 10000.0;
    // viewer.shadowMap.softShadows = true;
    // viewer.shadowMap.size = 4096;
    // viewer.scene.globe.translucency.frontFaceAlphaByDistance =
    //   new NearFarScalar(50.0, 0.4, 150.0, 1.0);
    // viewer.scene.globe.translucency.enabled = true;
    // viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    // viewer.scene.globe.undergroundColor = Color.MIDNIGHTBLUE;
    // viewer.scene.globe.undergroundColorAlphaByDistance.near = 2;
    // viewer.scene.globe.undergroundColorAlphaByDistance.far = 10;
    // viewer.scene.globe.undergroundColorAlphaByDistance.nearValue = 0.2;
    // viewer.scene.globe.undergroundColorAlphaByDistance.farValue = 1.0;

    // hide controls
    //viewer.animation.container.style.visibility = "hidden";
    //viewer.timeline.container.style.visibility = "hidden";
    viewer.fullscreenButton.container.style.visibility = "hidden";
    viewer.forceResize();
    viewer.scene.debugShowFramesPerSecond = true;

    var handler = new ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction((click) => {
      console.log("cesium click", click);
      const picked = viewer.scene.pick(click.position);
      console.log("picked", picked);
    }, ScreenSpaceEventType.LEFT_DOWN);

    // Effectively disables native selection
    // viewer.selectedEntityChanged.addEventListener((i) => {
    //   if (i) {
    //     viewer.selectedEntity = undefined;
    //   }
    // });

    onViewer(viewer);
  });
</script>

<div id="cesiumContainer" />
