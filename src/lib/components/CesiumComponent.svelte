<script lang="ts">
  window.CESIUM_BASE_URL = "/";
  import {
    Cartesian3,
    createOsmBuildingsAsync,
    Ion,
    Math as CesiumMath,
    Terrain,
    Viewer,
    ArcGisMapServerImageryProvider,
    ArcGisMapService,
    ArcGisBaseMapType,
    ImageryLayer,
    WebMapServiceImageryProvider,
    UrlTemplateImageryProvider,
    TrustedServers,
    TileMapServiceImageryProvider,
    Rectangle,
    Color,
    JulianDate,
    SampledPositionProperty,
    TimeIntervalCollection,
    TimeInterval,
    PathGraphics,
    VelocityOrientationProperty,
    ShadowMode,
    Cartesian2,
    CustomShader,
    UniformType,
    TextureUniform,
    VaryingType,
    CustomShaderMode,
    ColorBlendMode,
    SampledProperty,
    Quaternion,
    HeadingPitchRoll,
    Transforms,
    WebMapTileServiceImageryProvider,
    Credit,
    GeographicTilingScheme,
    Entity,
    Event,
    ConstantPositionProperty,
    PositionProperty,
    ReferenceFrame,
    Property,
    PropertyArray,
    VelocityVectorProperty,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Scene,
    Cartographic,
    HermitePolynomialApproximation,
    ConstantProperty,
    CallbackProperty,
    defined,
  } from "cesium";
  import "cesium/Build/Cesium/Widgets/widgets.css";
  import { onMount } from "svelte";

  export let onViewer: (i: Viewer) => void = (i) => {
    console.log("viewer consumer not installed");
  };

  let imageryLayer: ImageryLayer;
  let brightness = 1;
  let contrast = 0.5;
  let alpha = 1;
  let minimumPixelSize = 64;
  let maximumScale = 10000;
  let scale = 1;

  let viewer;

  onMount(async () => {
    console.log("on mount");
    Ion.defaultAccessToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0ZTZiODk0MC1jZTNmLTQwMGItYWRiMi02MjMxMmYxZThhZjgiLCJpZCI6MTc4MTAzLCJpYXQiOjE2OTk5Mzk0MTV9.YdpBSGayCK2hi3ZxaFXf1xiRsmpQ9REMh-hU9rmqeW4";

    // Send credentials
    // https://cesium.com/learn/cesiumjs/ref-doc/TrustedServers.html
    TrustedServers.add("localhost", 8080);

    // ArcGisMapService.defaultAccessToken =
    //   "AAPK72423108676948249a0facf6abe1c8e5G1AKcx5Szt4BD9WpyxFB5iwPuB6vQSFQ8o6-H8VpiSNzU0lDOJ1YnbMlsJp5Uk-7";
    // const arcgisImagery = ArcGisMapServerImageryProvider.fromBasemapType(
    //   ArcGisBaseMapType.HILLSHADE
    // );
    // const esri = await ArcGisMapServerImageryProvider.fromUrl(
    //   "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
    //   //"https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer",
    //   {
    //     token:
    //       "AAPK72423108676948249a0facf6abe1c8e5G1AKcx5Szt4BD9WpyxFB5iwPuB6vQSFQ8o6-H8VpiSNzU0lDOJ1YnbMlsJp5Uk-7",
    //   }
    // );

    // const tms = await TileMapServiceImageryProvider.fromUrl(
    //   //"http://dcsmaps.com/caucasus/",
    //   "http://localhost:8080/caucasus/",
    //   {
    //     fileExtension: "png",
    //   }
    // );

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
      //shadows: true,
      //terrainShadows: ShadowMode.ENABLED,
      //msaaSamples: 8,
    });
    viewer.shadowMap.maximumDistance = 10000;

    // viewer.clock.onTick.addEventListener((clock) => {
    //   //currentAcmiTime = JulianDate.toDate(clock.currentTime).getTime();
    //   //cesiumTime.set(JulianDate.toDate(clock.currentTime).getTime());
    //   cesiumTime.set(clock.currentTime);
    // });

    // hide controls
    //viewer.animation.container.style.visibility = "hidden";
    //viewer.timeline.container.style.visibility = "hidden";
    //viewer.forceResize();

    // Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
    // const viewer = new Viewer("cesiumContainer", {
    //   terrain: Terrain.fromWorldTerrain(),
    // });

    // viewer.camera.flyTo({
    //   destination: Cartesian3.fromDegrees(42.2, 41.8, 10000),
    //   orientation: {
    //     heading: CesiumMath.toRadians(320),
    //     pitch: CesiumMath.toRadians(-15.0),
    //   },
    //   duration: 0,
    // });
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
    console.log("end on mount");
  });
</script>

<div id="cesiumContainer" />
