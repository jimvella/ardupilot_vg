<script lang="ts">
  import { Chart } from "chart.js";
  import { onMount } from "svelte";
  import {} from "./RegisterRegisterables";

  export let chartBuilder: (canvasElement: HTMLCanvasElement) => Chart;

  let canvas: HTMLCanvasElement;
  let chart;

  onMount(async () => {
    chart = chartBuilder(canvas);
  });
</script>

<canvas bind:this={canvas} />

<style>
  canvas {
    width: 100%;
    height: 100%;
  }
</style>
