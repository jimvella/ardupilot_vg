import { Chart, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Global initialisation for Charts.js
Chart.register(...registerables);
Chart.register(ChartDataLabels);
