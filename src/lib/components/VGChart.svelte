<script lang="ts">
  import { Chart, type ChartData } from "chart.js";
  import ChartComponent from "./charts/ChartComponent.svelte";
  import ChartDataLabels from "chartjs-plugin-datalabels";
  import type { Readable } from "svelte/store";
  import { JulianDate } from "cesium";
  import Accordion from "./Accordion.svelte";

  const asiGreen = "#48a95a";
  const asiYellow = "#fbe014";
  const asiRed = "#e22831";

  const range = (start: number, end: number) => {
    const result: number[] = [];
    let i = start;
    while (i < end) {
      result.push(i);
      i = i + 1;
    }
    return result;
  };

  const aircraftDataset = (_tas, _g) => {
    return {
      label: "aircraft",
      data: [{ x: _tas, y: _g }],
      //backgroundColor: "rgb(255, 0, 255)",
      borderColor: "rgb(0, 0, 0)",
      backgroundColor: "rgb(255, 0, 255, 0.5)",
      pointStyle: "circle",
      pointRadius: 4,
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const aircraftHistoricalDataset = (
    _vgSamples: { tas: number; g: number; t: JulianDate }[],
    _currentTime: JulianDate
  ) => {
    let minutes = Number(showVgSamplesWithinMinutes);
    console.log("aircraftHistoricalDataset");
    const start = JulianDate.addMinutes(
      _currentTime,
      -minutes,
      new JulianDate()
    );
    const startMillis = JulianDate.toDate(start).getTime();
    const end = JulianDate.addMinutes(_currentTime, minutes, new JulianDate());
    const endMillis = JulianDate.toDate(end).getTime();
    const spanMillis = (endMillis - startMillis) / 2;

    return {
      label: "aircraft",
      data: _vgSamples
        .filter((i) => {
          return (
            JulianDate.greaterThan(i.t, start) && JulianDate.lessThan(i.t, end)
          );
        })
        .map((i) => {
          return {
            x: i.tas,
            y: i.g,
          };
        }),
      pointBackgroundColor: _vgSamples
        .filter((i) => {
          return (
            JulianDate.greaterThan(i.t, start) && JulianDate.lessThan(i.t, end)
          );
        })
        .map((i) => {
          const red = Math.min(
            Math.round(
              ((endMillis - JulianDate.toDate(i.t).getTime()) / spanMillis) *
                255
            ),
            255
          );
          const blue = Math.min(
            Math.round(
              ((JulianDate.toDate(i.t).getTime() - startMillis) / spanMillis) *
                255
            ),
            255
          );
          return "rgb(" + red + ", 0, " + blue + ", 0.5)";
        }),
      //backgroundColor: "rgb(255, 0, 255)",
      //borderColor: "rgb(0, 0, 0)",
      backgroundColor: "rgb(255, 0, 255, 0.5)",
      pointStyle: "circle",
      pointRadius: 4,
      datalabels: {
        labels: {
          title: null,
        },
      },
      showLine: false,
    };
  };

  const oneGDataset = (_vne) => {
    return {
      label: "1g",
      data: [
        { x: 0, y: 1 },
        { x: Number(_vne), y: 1 },
      ],
      backgroundColor: "rgb(255, 99, 132)",
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const vnoDataset = (_vno, _vne, _gLimitPositive) => {
    return {
      label: "Vno",
      data: [
        { x: Number(_vno), y: Number(_gLimitPositive) },
        { x: Number(_vne), y: Number(_gLimitPositive) },
      ],
      backgroundColor: asiYellow,
      fill: "origin",
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const vnoDatasetNegative = (_vno, _vne, _gLimitNegative) => {
    return {
      label: "Vno",
      data: [
        { x: Number(_vno), y: -Number(_gLimitNegative) },
        { x: Number(_vne), y: -Number(_gLimitNegative) },
      ],
      backgroundColor: asiYellow,
      fill: "origin",
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const vsPositiveDataset = (_vs, _gLimitPositive, _vne, _vno) => {
    const vmax = Math.min(
      Math.sqrt(Number(_gLimitPositive)) * Number(_vs),
      _vne
    );
    let points = range(0, vmax);
    points.push(vmax);

    let data = points.map((i) => {
      return { x: i, y: Math.pow(i / Number(_vs), 2) };
    });

    if (Number(_vno) > Number(vmax)) {
      data.push({ x: Number(vno), y: Number(_gLimitPositive) });
    }

    return {
      label: "vs+",
      data: data,
      backgroundColor: asiGreen,
      fill: "origin",
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const vsNegativeDataset = (_vs, _gLimitNegative, _vne, _vno) => {
    const vmax = Math.min(
      Math.sqrt(Number(_gLimitNegative)) * Number(_vs),
      _vne
    );
    let points = range(0, vmax);
    points.push(vmax);

    let data = points.map((i) => {
      return { x: i, y: -Math.pow(i / Number(_vs), 2) };
    });

    if (Number(_vno) > Number(vmax)) {
      data.push({ x: Number(_vno), y: -Number(_gLimitNegative) });
    }

    return {
      label: "vs-",
      data: data,
      backgroundColor: asiGreen,
      fill: "origin",
      datalabels: {
        labels: {
          title: null,
        },
      },
    };
  };

  const vSpeedsDataset = (_vs, _gLimitPositive, _vno, _vne) => {
    return {
      label: "v speeds",
      data: [
        {
          x: Number(_vs),
          y: 1,
          label: "Vs",
        },
        {
          x: Math.sqrt(Number(_gLimitPositive)) * Number(_vs),
          y: Number(_gLimitPositive),
          label: "Va",
        },
        {
          x: Number(_vno),
          y: 1,
          label: "Vno",
        },
        {
          x: Number(_vne),
          y: 1,
          label: "Vne",
        },
      ],
      borderColor: "rgb(0, 0, 0)",
      backgroundColor: "rgb(0, 0, 0, 0.5)",
      pointStyle: "circle",
      pointRadius: 2,
      datalabels: {
        align: "end",
        anchor: "end",
        color: "rgb(0, 0, 0)",
      },
      showLine: false,
    };
  };

  const scales = (_vne, _gLimitPositive, _gLimitNegative) => {
    const gmargin =
      Math.max(Number(_gLimitPositive), Number(_gLimitNegative)) / 2;
    return {
      x: {
        title: {
          text: "TAS (kts)",
          display: true,
          color: "rgba(0, 0, 0, 1)",
          font: {
            size: 18,
            family: "monospace",
            weight: "bold",
          },
        },
        type: "linear",
        position: "bottom",
        max: Number(vne) * 1.2,
      },
      y: {
        title: {
          text: "g (load factor)",
          display: true,
          color: "rgba(0, 0, 0, 1)",
          font: {
            size: 18,
            family: "monospace",
            weight: "bold",
          },
        },
        max: Number(gLimitPositive) + gmargin,
        min: -(Number(gLimitNegative) + gmargin),
      },
    };
  };

  const chartBuilder: (canvasElement: HTMLCanvasElement) => Chart = (
    canvasElement
  ) => {
    const vgPlugin = {
      id: "vgPlugin",
      beforeDraw(chart: Chart, args, options) {
        const {
          ctx,
          chartArea: { left, top, width, height },
          scales: { x, y },
        } = chart;

        ctx.save();

        ctx.fillStyle = asiRed;
        ctx.fillRect(
          x.getPixelForValue(Number(vne)),
          top,
          width - x.getPixelForValue(Number(vne)) + left,
          height
        );

        const vmaxPositive = Math.sqrt(Number(gLimitPositive)) * Number(vs);
        const vmaxNegative = Math.sqrt(Number(gLimitNegative)) * Number(vs);

        ctx.fillRect(
          x.getPixelForValue(vmaxPositive),
          top,
          width - x.getPixelForValue(vmaxPositive) + left,
          top + y.getPixelForValue(-Number(gLimitNegative))
        );

        ctx.fillRect(
          x.getPixelForValue(vmaxNegative),
          y.getPixelForValue(-Number(gLimitNegative)),
          width - x.getPixelForValue(vmaxNegative) + left,
          height - y.getPixelForValue(-Number(gLimitNegative)) + top
        );

        ctx.restore();
      },
    };

    const result = new Chart(canvasElement, {
      type: "line",
      data: {
        datasets: [
          aircraftDataset(tas, g),
          vSpeedsDataset(vs, gLimitPositive, vno, vne),
          aircraftHistoricalDataset($vgSamples, new JulianDate()),
          oneGDataset(vne),
          vnoDataset(vno, vne, gLimitPositive),
          vnoDatasetNegative(vno, vne, gLimitNegative),
          vsPositiveDataset(vs, gLimitPositive, vne, vno),
          vsNegativeDataset(vs, gLimitNegative, vne, vno),
        ],
      },
      options: {
        elements: {
          point: { pointStyle: false },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        animation: {
          duration: 0,
        },
        scales: scales(vno, gLimitPositive, gLimitNegative),
      },
      plugins: [vgPlugin, ChartDataLabels],
    });
    chart = result;
    return result;
  };

  export let tas: number;
  export let g: number;
  export let t: JulianDate;
  export let vgSamples: Readable<
    Array<{ tas: number; g: number; t: JulianDate }>
  >;

  let vs = "46";
  let vno = "139";
  let vne = "156";
  let gLimitPositive = "6";
  let gLimitNegative = "5";
  let showVgSamplesWithinMinutes = "0";

  let chart: Chart;

  $: {
    if (chart) {
      chart.data.datasets[0] = aircraftDataset(tas, g);
      chart.update();
    }
  }

  const rebuildDatasets = () => {
    if (chart) {
      console.log("rebuilding datasets");
      chart.data.datasets[1] = oneGDataset(vne);
      chart.data.datasets[2] = vSpeedsDataset(vs, gLimitPositive, vno, vne);
      //chart.data.datasets[3] = aircraftHistoricalDataset($vgSamples);
      chart.data.datasets[4] = vnoDataset(vno, vne, gLimitPositive);
      chart.data.datasets[5] = vnoDatasetNegative(vno, vne, gLimitNegative);
      chart.data.datasets[6] = vsPositiveDataset(vs, gLimitPositive, vne, vno);
      chart.data.datasets[7] = vsNegativeDataset(vs, gLimitNegative, vne, vno);

      console.log("updating");
      chart.options.scales = scales(vne, gLimitPositive, gLimitNegative);
      chart.update();
      console.log("updated");
    }
  };

  $: {
    vs;
    vno;
    vne;
    gLimitPositive;
    gLimitNegative;
    $vgSamples;
    rebuildDatasets();
  }

  $: {
    showVgSamplesWithinMinutes;
    if (chart && t) {
      chart.data.datasets[3] = aircraftHistoricalDataset($vgSamples, t);
      chart.update();
    }
  }
</script>

<ChartComponent {chartBuilder} />

<Accordion open={true}>
  <!-- <span slot="head"
    >This is my header number two, it's quite long so should span multiple lines
    (if not: please resize the window!)</span
  > -->
  <div slot="details">
    Vs (stall)*
    <input type="text" id="vne" name="vne" size="3" bind:value={vs} /><br />
    Vno (normal operating)
    <input type="text" id="vne" name="vne" size="3" bind:value={vno} /><br />
    Vne (never exceed)
    <input type="text" id="vne" name="vne" size="3" bind:value={vne} /><br />
    g+ max
    <input
      type="text"
      id="vne"
      name="vne"
      size="3"
      bind:value={gLimitPositive}
    /><br />
    g- max
    <input
      type="text"
      id="vne"
      name="vne"
      size="3"
      bind:value={gLimitNegative}
    /><br />
    <br />
    <button
      on:click={() => {
        vs = "46";
        vno = "139";
        vne = "156";
        gLimitPositive = "6";
        gLimitNegative = "5";
      }}>Decathlon preset</button
    >
    <br />
    <button
      on:click={() => {
        vs = "56";
        vno = "136";
        vne = "158";
        gLimitPositive = "6";
        gLimitNegative = "3";
      }}>FUJI FA200 preset</button
    >
    <br />
    <p>
      Notes:
      <br /><br />
      Vs<sub>accelerated</sub> = <span>&#8730;</span>g * Vs<sub
        >straight and level</sub
      >
    </p>
    <p>* Vs varies with aircraft weight.</p>
  </div>
</Accordion>
