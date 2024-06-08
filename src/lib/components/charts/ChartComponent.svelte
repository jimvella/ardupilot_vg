<script lang="ts">
  import { Chart } from "chart.js";
  import ChartDataLabels from "chartjs-plugin-datalabels";
  import { onMount, tick } from "svelte";
  import {} from "./RegisterRegisterables";

  export let chartBuilder: (canvasElement: HTMLCanvasElement) => Chart;
  //export let update: (callback :() => {}) => {};

  let canvas: HTMLCanvasElement;
  let chart;

  onMount(async () => {
    chart = chartBuilder(canvas);
  });

  // $: {
  //   if (chart) {
  //     console.log("update");
  //     chart.update();
  //   }
  // }

  // tick().then(() => {
  //   console.log("tick");
  // });
</script>

<canvas bind:this={canvas} />

<!-- <canvas /> -->

<style>
  canvas {
    width: 100%;
    height: 100%;
    /* background-color: #666; */
  }
</style>
