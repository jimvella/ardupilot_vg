import DataflashParser from "./parser";

let parser;
self.addEventListener("message", function (event) {
  if (event.data === null) {
    console.log("got bad file message!");
  } else if (event.data.action === "parse") {
    const data = event.data.file;
    parser = new DataflashParser(true);
    parser.processData(data, [
      "CMD",
      "MSG",
      "FILE",
      "MODE",
      "AHR2",
      "ATT",
      "GPS",
      "POS",
      "XKQ1",
      "XKQ",
      "NKQ1",
      "NKQ2",
      "XKQ2",
      "PARM",
      "MSG",
      "STAT",
      "EV",
      // Not sure why these aren't extracted by default
      // https://github.com/ArduPilot/UAVLogViewer/blob/e67fa69dc0d400fb8aa1987c39ca19b75a5572c2/src/tools/parsers/parser.worker.js#L17
      "BARO",
      "HYGR",
      "IMU",
      "XKF1",
      "XKF2",
      "XKF3",
      "XKF4",
    ]);
  } else if (event.data.action === "loadType") {
    if (!parser) {
      console.log("parser not ready");
    }
    parser.loadType(event.data.type.split("[")[0]);
  }
});
