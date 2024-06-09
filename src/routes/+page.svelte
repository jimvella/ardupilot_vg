<script lang="ts">
  import CesiumVgTracker from "$lib/components/CesiumVGTracker.svelte";
  import VgChart from "$lib/components/VGChart.svelte";
  import { JulianDate } from "cesium";
  import { writable } from "svelte/store";

  let tas: number;
  let g: number;
  let t: JulianDate;

  // Will need to update when the estimated wind is changed
  // so using a store to publish the changes.
  let vgVectorStore = writable<
    Array<{ tas: number; g: number; t: JulianDate }>
  >([]);
  // vgVectorStore.set([
  //   { tas: 20, g: 1, t: JulianDate.fromDate(new Date()) },
  //   { tas: 40, g: 1.2, t: JulianDate.fromDate(new Date()) },
  //   { tas: 60, g: 4, t: JulianDate.fromDate(new Date()) },
  // ]);

  let columns = true;
  let width = 100;
</script>

<svelte:head>
  <title>VG Diagram</title>
  <meta name="description" content="Dynamic VG diagram from aircraft track" />
</svelte:head>
<div>
  <h2>Dynamic VG Diagram from Aicraft Track</h2>
  <button
    on:click={() => {
      columns = !columns;
    }}>{columns ? "1 column" : "2 columns"}</button
  >
  <div style="width: 100%;">
    <div
      style={columns ? "width: 50%;  float: left;" : "width: " + width + "%"}
    >
      <VgChart {tas} {g} {t} vgSamples={vgVectorStore} />
      VG Chart width (%)
      <input type="range" min="1" max="100" bind:value={width} />
    </div>
    <div style={columns ? "margin-left: 50%;" : ""}>
      <CesiumVgTracker
        onUpdate={(_tas, _g, _t) => {
          //console.log("update: " + tas + " " + g);
          tas = _tas;
          g = _g;
          t = _t;
        }}
        {vgVectorStore}
      />
    </div>
  </div>
</div>
<br />
<br />
<a href="ardupilot_datalogger">Flight path logging</a>
