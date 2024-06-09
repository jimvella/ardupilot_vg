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
    PolylineGlowMaterialProperty,
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
    getTimestamp,
  } from "cesium";
  import type { Writable } from "svelte/store";
  import { onMount } from "svelte";

  /*
    Test flight objectives
    - Establish which sensor is sideslip
      * wings level rudder turns
      * accelerate and decelerate without changing attitude
    - Establish Vs for Vg diagram
      * wings level stall
    - Test wind estimation without airspeed.
      * Fly straight and level for a few sec, turn 90 degrees 
        and fly straight and level for a few sec.
  */

  let ardupilotBinParserworker: Worker | undefined = undefined;

  let state = {};

  class ExponentialFilter {
    smoothingFactor: number;
    lastValue: number | undefined = undefined;

    constructor(smoothingFactor: number) {
      this.smoothingFactor = smoothingFactor;
    }

    apply(i: number): number {
      if (this.lastValue != undefined) {
        const result =
          this.smoothingFactor * i +
          (1 - this.smoothingFactor) * this.lastValue;
        this.lastValue = result;
        return result;
      } else {
        this.lastValue = i;
        return this.lastValue;
      }
    }

    // Convinience function
    applyArray(array: { x: number; y: number }[]): { x: number; y: number }[] {
      return array.map((i) => {
        return { x: i.x, y: this.apply(i.y) };
      });
    }
  }

  class OrderedExponentialFilter {
    filters: ExponentialFilter[];

    constructor(smoothingFactor: number, order: number) {
      this.filters = Array(order)
        .fill()
        .map((i) => new ExponentialFilter(smoothingFactor));
    }

    apply(i: number): number {
      let result = i;
      this.filters.forEach((f) => {
        result = f.apply(result);
      });
      return result;
    }

    // Convinience function
    applyArray(array: { x: number; y: number }[]): { x: number; y: number }[] {
      return array.map((i) => {
        return { x: i.x, y: this.apply(i.y) };
      });
    }
  }

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

    let velocityEstimator = new DiscreteDerivativeEstimator();
    let accelerationEstimator = new DiscreteDerivativeEstimator();

    const rotationFromDatumToUp = Transforms.headingPitchRollQuaternion(
      Cartesian3.ZERO,
      HeadingPitchRoll.fromDegrees(180, 0, 0)
    );
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
      //trackPoints.length,
      length,
      100, // chunk
      (i) => {
        // const p = dataAtIndex(i);

        // if (p == undefined) {
        //   console.log("p undefined");
        //   return;
        // }
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

        //points.push(p);
        // Extended Kalman Filter (EKF) Velocity estimate
        const vn = data.messages["XKF1[0]"].VN[i];
        const ve = data.messages["XKF1[0]"].VE[i];
        const vd = data.messages["XKF1[0]"].VD[i];

        Transforms.eastNorthUpToFixedFrame(
          p.position,
          Ellipsoid.WGS84,
          eastNorthUpToFixedFrameAtPosition
        );
        const vVector = Matrix4.multiplyByPointAsVector(
          eastNorthUpToFixedFrameAtPosition,
          Cartesian3.fromElements(ve, vn, -vd),
          new Cartesian3()
        );
        sampledVelocityProperty.addSample(p.time, vVector);

        const vwn = data.messages["XKF2[0]"].VWN[i];
        const vwe = data.messages["XKF2[0]"].VWE[i];
        const wVector = Matrix4.multiplyByPointAsVector(
          eastNorthUpToFixedFrameAtPosition,
          Cartesian3.fromElements(vwe, vwn, 0),
          new Cartesian3()
        );
        sampledWindProperty.addSample(p.time, wVector);

        const roll = data.messages["XKF1[0]"].Roll[i];
        const pitch = data.messages["XKF1[0]"].Pitch[i];
        const yaw = data.messages["XKF1[0]"].Yaw[i];

        const orientation = Transforms.headingPitchRollQuaternion(
          p.position,
          HeadingPitchRoll.fromDegrees(yaw - 90, pitch, roll)
        );
        sampledOrientationProperty.addSample(p.time, orientation);

        // const velocity = velocityEstimator.apply({
        //   vector: p.position,
        //   time: p.time,
        // });
        // const velocity = {
        //   vector: vVector,
        //   time: p.time
        // }
        //velocities.push(velocity);
        //if (velocity) {

        //}

        // https://ardupilot.org/copter/docs/logmessages.html#imu
        const accX = accXFilter.apply(data.messages["IMU[2]"].AccX[i * 2]);
        const accY = accYFilter.apply(data.messages["IMU[2]"].AccY[i * 2]);
        const accZ = accZFilter.apply(data.messages["IMU[2]"].AccZ[i * 2]);

        // TODO - also needs to be roated by attitude
        // const aVector = Matrix4.multiplyByPointAsVector(
        //   eastNorthUpToFixedFrameAtPosition,
        //   Cartesian3.fromElements(
        //     ,
        //     accYFilter.apply(accY),
        //     accZFilter.apply(accZ)
        //   ),
        //   new Cartesian3()
        // );
        // //const a2 = rotate(aVector, [orientation]);
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

        // const acceleration = .apply(velocity);
        const acceleration = undefined;

        // if (acceleration) {
        //   // Add 1g vector
        //   const upQuarternion = Transforms.headingPitchRollQuaternion(
        //     p.position,
        //     HeadingPitchRoll.fromDegrees(0, 90, 0)
        //   );
        //   const gVector = rotate(Cartesian3.fromElements(9.8, 0, 0), [
        //     upQuarternion,
        //     rotationFromDatumToUp,
        //   ]);
        //   acceleration.vector = Cartesian3.add(
        //     acceleration.vector,
        //     gVector,
        //     acceleration.vector
        //   );
        // }

        // accelerations.push(acceleration);
        // if (acceleration) {
        //   sampledAccelerationProperty.addSample(
        //     points[i - 2].time,
        //     acceleration.vector
        //   );
        // }

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

        // Mark vectors
        // if (velocity) {
        //   const velocityEntity = viewer.entities.add({
        //     position: points[i - 1].position,
        //     polyline: new PolylineGraphics({
        //       positions: new CallbackProperty((t) => {
        //         return [
        //           points[i - 1].position,
        //           Cartesian3.add(
        //             points[i - 1].position,
        //             velocity.vector,
        //             new Cartesian3()
        //           ),
        //         ];
        //       }, true),
        //       width: 3,
        //       material: Color.RED,
        //       // Wont render at all if we start with false
        //       show: true,
        //     }),
        //   });
        //   vectorEntities.push(velocityEntity);
        // }

        // if (acceleration) {
        //   const accelerationEntity = viewer.entities.add({
        //     position: points[i - 2].position,
        //     polyline: new PolylineGraphics({
        //       positions: new CallbackProperty((t) => {
        //         return [
        //           points[i - 2].position,
        //           Cartesian3.add(
        //             points[i - 2].position,
        //             acceleration.vector,
        //             new Cartesian3()
        //           ),
        //         ];
        //       }, true),
        //       width: 3,
        //       material: Color.YELLOW,
        //       show: true,
        //     }),
        //   });
        //   vectorEntities.push(accelerationEntity);
        // }

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

        let rotationScratch: Matrix3 = new Matrix3();
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
          // orientation: new CallbackProperty((t) => {
          //   const p = sampledPositionProperty.getValue(t);
          //   const v = sampledVelocityProperty.getValue(t);
          //   const a = sampledAccelerationProperty.getValue(t);

          //   try {
          //     if (p && v && a) {
          //       Cartesian3.normalize(v, v);

          //       Transforms.rotationMatrixFromPositionVelocity(
          //         p,
          //         v,
          //         Ellipsoid.WGS84,
          //         rotationScratch
          //       );
          //       let result = Quaternion.fromRotationMatrix(
          //         rotationScratch,
          //         new Quaternion()
          //       );

          //       // Roll axis rotation
          //       // vector at right angles to v and a
          //       let aCrossV = Cartesian3.cross(a, v, new Cartesian3());
          //       let normal = Ellipsoid.WGS84.geodeticSurfaceNormal(
          //         p,
          //         new Cartesian3()
          //       );
          //       let angle =
          //         (Cartesian3.angleBetween(aCrossV, normal) * 180) / Math.PI;

          //       let rollQuarternion = Quaternion.fromHeadingPitchRoll(
          //         HeadingPitchRoll.fromDegrees(0, 0, 90 - angle)
          //       );
          //       result = Quaternion.multiply(result, rollQuarternion, result);
          //       return result;
          //     } else {
          //       return undefined;
          //     }
          //   } catch (error) {
          //     console.log("error with orientation", error);
          //     return undefined;
          //   }
          // }, false),
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
                // Quaternion.fromHeadingPitchRoll(
                //   HeadingPitchRoll.fromDegrees(Number(windDir + 90), 0, 0)
                // ),
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

    console.log("zmin", zmin);
    console.log("zmax", zmax);
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
          //20000,
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

  /*
    Takes points either side and finds the tangent / derivative
  */
  class DiscreteDerivativeEstimator {
    nMinus2: { vector: Cartesian3; time: JulianDate } | undefined;
    nMinus1: { vector: Cartesian3; time: JulianDate } | undefined;

    public constructor() {}

    apply(n: { vector: Cartesian3; time: JulianDate } | undefined) {
      if (n) {
        let result = undefined;

        if (n && this.nMinus1 && this.nMinus2) {
          // tanget at n - 1
          let v = Cartesian3.subtract(
            n.vector,
            this.nMinus2.vector,
            new Cartesian3()
          );
          v = Cartesian3.divideByScalar(
            v,
            (JulianDate.toDate(n.time).getTime() -
              JulianDate.toDate(this.nMinus2.time).getTime()) /
              1000,
            v
          );

          result = { vector: v, time: this.nMinus1.time };
        }

        this.nMinus2 = this.nMinus1;
        this.nMinus1 = n;
        return result;
      } else {
        return undefined;
      }
    }
  }

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

  const loadTrack = (data, length, dataAtIndex) => {
    console.log("processing");
    // const trackPoints = gpx
    //   .getElementsByTagName("gpx")[0]
    //   .getElementsByTagName("trk")[0]
    //   .getElementsByTagName("trkseg")[0]
    //   .getElementsByTagName("trkpt");

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

    let start: JulianDate;
    let stop: JulianDate;

    let velocityEstimator = new DiscreteDerivativeEstimator();
    let accelerationEstimator = new DiscreteDerivativeEstimator();

    const rotationFromDatumToUp = Transforms.headingPitchRollQuaternion(
      Cartesian3.ZERO,
      HeadingPitchRoll.fromDegrees(180, 0, 0)
    );

    yieldingLoop(
      //trackPoints.length,
      length,
      10, // chunk
      (i) => {
        const p = dataAtIndex(i);

        if (p == undefined) {
          console.log("p undefined");
          return;
        }

        samples = samples + 1;

        if (start == undefined) {
          start = p.time;
        }
        stop = p.time;
        points.push(p);

        // const tp = trackPoints[i];
        // const lat = tp.getAttribute("lat");
        // const lon = tp.getAttribute("lon");

        // // Do we need to convert gps height?
        // //https://cesium.com/learn/cesiumjs-learn/cesiumjs-flight-tracker/
        // const ele = tp.getElementsByTagName("ele")[0].textContent;
        // const time = tp.getElementsByTagName("time")[0].textContent;
        // samples = samples + 1;

        // const date = JulianDate.fromDate(new Date(time));
        // if (start == undefined) {
        //   start = date;
        // }
        // stop = date;

        // const position = Cartesian3.fromDegrees(
        //   Number(lon),
        //   Number(lat),
        //   Number(ele)
        // );

        // points.push({
        //   position: position,
        //   time: date,
        // });

        const velocity = velocityEstimator.apply({
          vector: p.position,
          time: p.time,
        });
        velocities.push(velocity);
        if (velocity) {
          sampledVelocityProperty.addSample(
            points[i - 1].time,
            velocity.vector
          );
        }

        const acceleration = accelerationEstimator.apply(velocity);

        if (acceleration) {
          // Add 1g vector
          const upQuarternion = Transforms.headingPitchRollQuaternion(
            p.position,
            HeadingPitchRoll.fromDegrees(0, 90, 0)
          );
          const gVector = rotate(Cartesian3.fromElements(9.8, 0, 0), [
            upQuarternion,
            rotationFromDatumToUp,
          ]);
          acceleration.vector = Cartesian3.add(
            acceleration.vector,
            gVector,
            acceleration.vector
          );
        }

        accelerations.push(acceleration);
        if (acceleration) {
          sampledAccelerationProperty.addSample(
            points[i - 2].time,
            acceleration.vector
          );
        }

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

        // Mark vectors
        if (velocity) {
          const velocityEntity = viewer.entities.add({
            position: points[i - 1].position,
            polyline: new PolylineGraphics({
              positions: new CallbackProperty((t) => {
                return [
                  points[i - 1].position,
                  Cartesian3.add(
                    points[i - 1].position,
                    velocity.vector,
                    new Cartesian3()
                  ),
                ];
              }, true),
              width: 3,
              material: Color.RED,
              // Wont render at all if we start with false
              show: true,
            }),
          });
          vectorEntities.push(velocityEntity);
        }

        if (acceleration) {
          const accelerationEntity = viewer.entities.add({
            position: points[i - 2].position,
            polyline: new PolylineGraphics({
              positions: new CallbackProperty((t) => {
                return [
                  points[i - 2].position,
                  Cartesian3.add(
                    points[i - 2].position,
                    acceleration.vector,
                    new Cartesian3()
                  ),
                ];
              }, true),
              width: 3,
              material: Color.YELLOW,
              show: true,
            }),
          });
          vectorEntities.push(accelerationEntity);
        }

        sampledPositionProperty.addSample(p.time, p.position);
      },
      () => {
        if (showVectors == false) {
          vectorEntities.forEach((i) => {
            i.show = showVectors;
          });
        }

        let rotationScratch: Matrix3 = new Matrix3();
        const airplaneEntity = viewer.entities.add({
          availability: new TimeIntervalCollection([
            new TimeInterval({ start: start, stop: stop }),
          ]),
          position: sampledPositionProperty,
          model: {
            uri: "/Cesium_Air.gltf",
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
          orientation: new CallbackProperty((t) => {
            const p = sampledPositionProperty.getValue(t);
            const v = sampledVelocityProperty.getValue(t);
            const a = sampledAccelerationProperty.getValue(t);

            try {
              if (p && v && a) {
                Cartesian3.normalize(v, v);

                Transforms.rotationMatrixFromPositionVelocity(
                  p,
                  v,
                  Ellipsoid.WGS84,
                  rotationScratch
                );
                let result = Quaternion.fromRotationMatrix(
                  rotationScratch,
                  new Quaternion()
                );

                // Roll axis rotation
                // vector at right angles to v and a
                let aCrossV = Cartesian3.cross(a, v, new Cartesian3());
                let normal = Ellipsoid.WGS84.geodeticSurfaceNormal(
                  p,
                  new Cartesian3()
                );
                let angle =
                  (Cartesian3.angleBetween(aCrossV, normal) * 180) / Math.PI;

                let rollQuarternion = Quaternion.fromHeadingPitchRoll(
                  HeadingPitchRoll.fromDegrees(0, 0, 90 - angle)
                );
                result = Quaternion.multiply(result, rollQuarternion, result);
                return result;
              } else {
                return undefined;
              }
            } catch (error) {
              console.log("error with orientation", error);
              return undefined;
            }
          }, false),
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
                // Quaternion.fromHeadingPitchRoll(
                //   HeadingPitchRoll.fromDegrees(Number(windDir + 90), 0, 0)
                // ),
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
