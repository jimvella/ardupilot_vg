<script lang="ts">
  import CesiumComponent from "$lib/components/CesiumComponent.svelte";
  import {
    CallbackProperty,
    Cartesian2,
    Cartesian3,
    Color,
    Ellipsoid,
    Entity,
    HeadingPitchRoll,
    JulianDate,
    LagrangePolynomialApproximation,
    Matrix3,
    Matrix4,
    PolylineGraphics,
    Quaternion,
    SampledPositionProperty,
    SampledProperty,
    ShadowMode,
    TimeInterval,
    TimeIntervalCollection,
    Transforms,
    defined,
    Math as CesiumMath,
    type Viewer,
    HeadingPitchRange,
  } from "cesium";
  import type { Writable } from "svelte/store";
  import { onMount } from "svelte";
  import { OrderedExponentialFilter } from "./filters/ExponentialFilter";

  let ardupilotBinParserworker: Worker | undefined = undefined;

  let state = {};

  const loadArdupilotData = (data, length, dataAtIndex) => {
    console.log("loading ardupilot data");

    const sampledPositionProperty = new SampledPositionProperty();
    const sampledVelocityProperty = new SampledProperty(Cartesian3);
    sampledVelocityProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });
    const sampledAccelerationProperty = new SampledProperty(Cartesian3);
    sampledAccelerationProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });

    const sampledOrientationProperty = new SampledProperty(Quaternion);
    sampledOrientationProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });

    const sampledWindProperty = new SampledProperty(Cartesian3);
    sampledWindProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });

    let start: JulianDate;
    let stop: JulianDate;

    const velocityRotationFromDatum = Transforms.headingPitchRollQuaternion(
      Cartesian3.ZERO,
      HeadingPitchRoll.fromDegrees(0, 90, 0)
    );

    const eastNorthUpToFixedFrameAtPosition: Matrix4 = new Matrix4();

    const accYFilter = new OrderedExponentialFilter(0.2, 3);
    const accXFilter = new OrderedExponentialFilter(0.2, 3);
    const accZFilter = new OrderedExponentialFilter(0.2, 3);

    let zmin = 0;
    let zmax = 0;

    yieldingLoop(
      length,
      100, // chunk
      (i) => {
        const p = {};
        p.time = JulianDate.fromDate(
          new Date(
            data.messages["POS"].time_boot_ms[i] +
              data.metadata.startTime.getTime()
          )
        );
        p.position = Cartesian3.fromDegrees(
          data.messages["POS"].Lng[i] / 10000000,
          data.messages["POS"].Lat[i] / 10000000,
          data.messages["POS"].Alt[i]
        );

        samples = samples + 1;

        if (start == undefined) {
          start = p.time;
        }
        stop = p.time;

        Transforms.eastNorthUpToFixedFrame(
          p.position,
          Ellipsoid.WGS84,
          eastNorthUpToFixedFrameAtPosition
        );

        // Extended Kalman Filter (EKF) Velocity estimate
        const vn = data.messages["XKF1[0]"].VN[i];
        const ve = data.messages["XKF1[0]"].VE[i];
        const vd = data.messages["XKF1[0]"].VD[i];

        const vVector = Matrix4.multiplyByPointAsVector(
          eastNorthUpToFixedFrameAtPosition,
          Cartesian3.fromElements(ve, vn, -vd),
          new Cartesian3()
        );
        sampledVelocityProperty.addSample(p.time, vVector);

        // Extended Kalman Filter (EKF) Wind estimate
        const vwn = data.messages["XKF2[0]"].VWN[i];
        const vwe = data.messages["XKF2[0]"].VWE[i];
        const wVector = Matrix4.multiplyByPointAsVector(
          eastNorthUpToFixedFrameAtPosition,
          Cartesian3.fromElements(vwe, vwn, 0),
          new Cartesian3()
        );
        sampledWindProperty.addSample(p.time, wVector);

        // Extended Kalman Filter (EKF) Attitude estimate
        const roll = data.messages["XKF1[0]"].Roll[i];
        const pitch = data.messages["XKF1[0]"].Pitch[i];
        const yaw = data.messages["XKF1[0]"].Yaw[i];

        const orientation = Transforms.headingPitchRollQuaternion(
          p.position,
          HeadingPitchRoll.fromDegrees(yaw - 90, pitch, roll)
        );
        sampledOrientationProperty.addSample(p.time, orientation);

        // IMU Acceleration measurments
        // https://ardupilot.org/copter/docs/logmessages.html#imu
        // Exp filter since the data is noisy (engine vibration?)
        const accX = accXFilter.apply(data.messages["IMU[2]"].AccX[i * 2]);
        const accY = accYFilter.apply(data.messages["IMU[2]"].AccY[i * 2]);
        const accZ = accZFilter.apply(data.messages["IMU[2]"].AccZ[i * 2]);

        const aVector = rotate(
          Cartesian3.fromElements(
            // Not sure about slip and forward / aft acceleration
            accX,
            -accZ,
            accY
          ),
          [orientation]
        );
        sampledAccelerationProperty.addSample(p.time, aVector);

        // Mark this location with a red point.
        const pointEntity = viewer.entities.add({
          //description: `First data point at (${lon}, ${lat})`,
          position: p.position,
          point: { pixelSize: 10, color: Color.RED },
          show: showSamples,
        });
        sampleEntities.push(pointEntity);

        // Point the camera at the points being loaded in
        if (i == 1) {
          viewer.flyTo(pointEntity, {
            offset: new HeadingPitchRange(Math.PI, 0, 1000),
          });
        }

        sampledPositionProperty.addSample(p.time, p.position);
      },
      () => {
        if (showVectors == false) {
          vectorEntities.forEach((i) => {
            i.show = showVectors;
          });
        }

        const modelUri =
          window.location.hostname == "localhost"
            ? "/Cesium_Air.gltf"
            : // Accomodate Github pages
              "/ardupilot_vg/Cesium_Air.gltf";

        const airplaneEntity = viewer.entities.add({
          availability: new TimeIntervalCollection([
            new TimeInterval({ start: start, stop: stop }),
          ]),
          position: sampledPositionProperty,
          model: {
            // Github pages prefix
            uri: modelUri,
            minimumPixelSize: 64,
            maximumScale: 100,
            scale: 1,
            shadows: ShadowMode.ENABLED,
            imageBasedLightingFactor: Cartesian2.ONE,
            //color: Color.fromAlpha(color, 1),
            //colorBlendMode: ColorBlendMode.MIX,
            //colorBlendAmount: 0.5,
            //silhouetteColor: Color.fromAlpha(color, 1),
            //silhouetteSize: 1,
          },
          orientation: sampledOrientationProperty,
          path: {
            //resolution: 1,
            // material: new PolylineGlowMaterialProperty({
            //   glowPower: 0.1,
            //   color: Color.YELLOW,
            // }),
            material: Color.MAGENTA,
            width: 2,
            show: showPath,
          },
        });
        airplaneEntity.position.setInterpolationOptions({
          interpolationAlgorithm: LagrangePolynomialApproximation,
          interpolationDegree: 5,
        });
        entity = airplaneEntity;

        const velocityEntity = viewer.entities.add({
          position: sampledPositionProperty,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionProperty.getValue(t);
              const v = sampledVelocityProperty.getValue(t);
              if (p && v) {
                return [p, Cartesian3.add(p, v, new Cartesian3())];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.RED,
          }),
        });
        interpolatedVectorEntities.push(velocityEntity);

        const accelerationEntity = viewer.entities.add({
          position: sampledPositionProperty,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionProperty.getValue(t);
              const v = sampledAccelerationProperty.getValue(t);
              if (p && v) {
                return [p, Cartesian3.add(p, v, new Cartesian3())];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.YELLOW,
          }),
        });
        interpolatedVectorEntities.push(accelerationEntity);

        const orientationEntity = viewer.entities.add({
          position: sampledPositionProperty,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionProperty.getValue(t);
              const v = rotate(Cartesian3.fromElements(-20, 0, 0), [
                sampledOrientationProperty.getValue(t),
                velocityRotationFromDatum,
              ]);
              if (p && v) {
                return [p, Cartesian3.add(p, v, new Cartesian3())];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.BLUE,
          }),
        });
        interpolatedVectorEntities.push(orientationEntity);

        // TODO - relative wind (ala aoa)
        const windEntity = viewer.entities.add({
          position: sampledPositionProperty,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionProperty.getValue(t);
              const v = sampledWindProperty.getValue(t);
              if (p && v) {
                return [p, Cartesian3.add(p, v, new Cartesian3())];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.AQUA,
          }),
        });
        interpolatedVectorEntities.push(windEntity);

        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = stop.clone();
        viewer.clock.currentTime = start.clone();

        viewer.timeline.zoomTo(start, stop);
        viewer.clock.shouldAnimate = true;

        viewer.trackedEntity = airplaneEntity;

        viewer.clock.onTick.addEventListener((clock) => {
          const sv = sampledVelocityProperty.getValue(clock.currentTime);
          if (sv) {
            velocity = Cartesian3.magnitude(sv);
          }

          const sg = sampledAccelerationProperty.getValue(clock.currentTime);
          if (sg) {
            g = Cartesian3.magnitude(sg);
          }

          const knotsPerMetersPerSecond = 1.944;
          const position = airplaneEntity.position.getValue(clock.currentTime);
          if (position) {
            let wind = Cartesian3.multiplyByScalar(
              Cartesian3.UNIT_X,
              Number(windSpeed) / knotsPerMetersPerSecond,
              new Cartesian3()
            );

            wind = rotate(
              wind,
              [
                Transforms.headingPitchRollQuaternion(
                  position,
                  HeadingPitchRoll.fromDegrees(Number(windDir), 0, 0)
                ),
              ],
              wind
            );

            if (sv) {
              const relativeAirflow = Cartesian3.add(
                sv,
                wind,
                new Cartesian3()
              );

              tas =
                Cartesian3.magnitude(relativeAirflow) * knotsPerMetersPerSecond;
            } else {
              tas = undefined;
            }
          } else {
            tas = undefined;
          }

          if (tas != undefined && g != undefined) {
            onUpdate(tas, g / 9.8, clock.currentTime);
          }
        });

        updateVgVectors();
      }
    );
  };

  onMount(async () => {
    const worker = await import(
      "$lib/components/dataflash/parser.worker?worker"
    );
    ardupilotBinParserworker = new worker.default();
    ardupilotBinParserworker.onmessage = (event) => {
      if (event.data.percentage) {
        state.processPercentage = event.data.percentage;
      } else if (event.data.availableMessages) {
        //this.$eventHub.$emit("messageTypes", event.data.availableMessages);
        console.log("available messages", event.data.availableMessages);
      } else if (event.data.metadata) {
        state.metadata = event.data.metadata;
      } else if (event.data.messages) {
        state.messages = event.data.messages;
        console.log("set messages", event.data.messages);
        //this.$eventHub.$emit("messages");
      } else if (event.data.messagesDoneLoading) {
        //this.$eventHub.$emit("messagesDoneLoading");
        console.log("Done loading", state);

        // https://ardupilot.org/copter/docs/logmessages.html#xkf1
        // https://ardupilot.org/copter/docs/logmessages.html#att
        // https://ardupilot.org/copter/docs/logmessages.html#pos
        // https://ardupilot.org/plane/docs/common-blackboxlogger.html
        // https://ardupilot.org/copter/docs/common-apm-navigation-extended-kalman-filter-overview.html

        // console.log("XKF1[0]", state.messages["XKF1[0]"]);
        // console.log("POS", state.messages["POS"]);
        // console.log("startTime", state.metadata.startTime.getTime());
        // for (let i = 0; i < 100; i++) {
        //   console.log(state.messages["POS"].time_boot_ms[i]);
        // }

        loadArdupilotData(
          state,
          state.messages["POS"].time_boot_ms.length,
          (i) => i
        );
      } else if (event.data.messageType) {
        state.messages[event.data.messageType] = event.data.messageList;
        console.log("set message list", event.data.messageType);
        //this.$eventHub.$emit("messages");
      } else if (event.data.files) {
        state.files = event.data.files;
        //this.$eventHub.$emit("messages");
      } else if (event.data.url) {
        console.log("Not implemented");
        //this.downloadFileFromURL(event.data.url);
      }
    };
  });

  function yieldingLoop(
    count: number,
    chunksize: number,
    callback: (i: number) => void,
    finished: () => void
  ) {
    var i = 0;
    (function chunk() {
      var end = Math.min(i + chunksize, count);
      for (; i < end; ++i) {
        callback(i);
      }
      if (i < count) {
        setTimeout(chunk, 0);
      } else {
        finished();
      }
    })();
  }

  // https://danceswithcode.net/engineeringnotes/quaternions/quaternions.html
  function rotate(
    vector: Cartesian3,
    rotations: Quaternion[],
    result?: Cartesian3
  ): Cartesian3 {
    if (!defined(result)) {
      result = new Cartesian3();
    }

    const rotation = rotations.reduce((accumulator, currentValue) => {
      return Quaternion.multiply(accumulator, currentValue, accumulator);
    }, Quaternion.IDENTITY.clone());

    const rotationInverse = Quaternion.inverse(rotation, new Quaternion());

    let p = new Quaternion(0, vector.x, vector.y, vector.z);
    // passive
    p = Quaternion.multiply(rotation, p, p);
    p = Quaternion.multiply(p, rotationInverse, p);

    result.x = p.x;
    result.y = p.y;
    result.z = p.z;

    return result;
  }

  let points: { position: Cartesian3; time: JulianDate }[] = [];
  let velocities: ({ vector: Cartesian3; time: JulianDate } | undefined)[] = [];
  let accelerations: ({ vector: Cartesian3; time: JulianDate } | undefined)[] =
    [];

  export let onUpdate: (v: number, g: number, t: JulianDate) => void = (
    v,
    g,
    t
  ) => {};

  export let vgVectorStore: Writable<
    Array<{ tas: number; g: number; t: JulianDate }>
  >;

  let entity: Entity;
  let sampleEntities: Entity[] = [];
  let vectorEntities: Entity[] = [];
  let interpolatedVectorEntities: Entity[] = [];

  let showSamples = false;
  let showVectors = false;
  let showInterpolatedVectors = true;
  let showPath = true;

  let samples = 0;
  let velocity = 0;
  let g = 0;

  let windDir = "360";
  let windSpeed = "0";
  let tas = undefined;

  let viewer: Viewer;

  const updateVgVectors = () => {
    console.log("Updating vg samples for wind");
    const result = [];

    console.log(vgVectorStore);

    const knotsPerMetersPerSecond = 1.944;
    for (let i = 4; i < points.length - 4; i++) {
      try {
        const position = points[i].position;
        let wind = Cartesian3.multiplyByScalar(
          Cartesian3.UNIT_X,
          Number(windSpeed) / knotsPerMetersPerSecond,
          new Cartesian3()
        );
        wind = rotate(
          wind,
          [
            Transforms.headingPitchRollQuaternion(
              position,
              HeadingPitchRoll.fromDegrees(Number(windDir), 0, 0)
            ),
          ],
          wind
        );
        const relativeAirflow = Cartesian3.add(
          velocities[i].vector,
          wind,
          new Cartesian3()
        );
        const _tas =
          Cartesian3.magnitude(relativeAirflow) * knotsPerMetersPerSecond;
        result.push({
          tas: _tas,
          g: Cartesian3.magnitude(accelerations[i].vector) / 9.8,
          t: points[i].time,
        });
      } catch (error) {
        console.log("i", i);
        throw error;
      }
    }
    vgVectorStore.set(result);
  };

  $: {
    windDir;
    windSpeed;
    updateVgVectors();
  }
</script>

<CesiumComponent onViewer={(i) => (viewer = i)} />
<br />
ArduPilot bin
<input
  type="file"
  on:input={(e) => {
    const fileList = event.target.files;
    console.log(fileList);
    if (fileList && fileList[0]) {
      const f = fileList[0];

      const fr = new FileReader();
      fr.onload = () => {
        ardupilotBinParserworker.postMessage({
          action: "parse",
          file: fr.result,
          isTlog: false,
        });
      };
      fr.readAsArrayBuffer(f);
    }
  }}
/>
<br />

Samples: {samples}
<br />
Velocity (m/s): {velocity}
<br />
g (m/s^2): {g}
<br />
Wind
<input type="text" id="windDir" name="windDir" size="3" bind:value={windDir} />T
<input
  type="text"
  id="windSpeed"
  name="windSpeed"
  size="3"
  bind:value={windSpeed}
/>kts
<br />
TAS {Math.round(tas)} kts
<br />
<label for="showSamples">Show samples</label>
<input
  type="checkbox"
  id="showSamples"
  name="showSamples"
  bind:checked={showSamples}
  on:change={(e) => {
    sampleEntities.forEach((i) => {
      i.show = showSamples;
    });
  }}
/>
<br />
<label for="showVectors">Show vectors</label>
<input
  type="checkbox"
  id="showVectors"
  name="showVectors"
  bind:checked={showVectors}
  on:change={(e) => {
    vectorEntities.forEach((i) => {
      i.show = showVectors;
    });
  }}
/>
<br />
<label for="showInterpolatedVectors">Show interpolated vectors</label>
<input
  type="checkbox"
  id="showInterpolatedVectors"
  name="showInterpolatedVectors"
  bind:checked={showInterpolatedVectors}
  on:change={(e) => {
    interpolatedVectorEntities.forEach((i) => {
      i.show = showInterpolatedVectors;
    });
  }}
/>
<br />
<label for="showPath">Show path</label>
<input
  type="checkbox"
  id="showPath"
  name="showPath"
  bind:checked={showPath}
  on:change={(e) => {
    entity.path.show = showPath;
  }}
/>
<br />
<h4>Sample Ardupilot bin files</h4>
<a
  href="https://ardupilotvg.s3.ap-southeast-2.amazonaws.com/2024-06-02+16-18-30.bin"
  >2024-06-02 16-18-30.bin</a
>
