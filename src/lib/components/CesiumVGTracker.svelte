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
    PolylineColorAppearance,
    Primitive,
    GeometryInstance,
    PolylineGeometry,
    ColorGeometryInstanceAttribute,
  } from "cesium";
  import { writable, type Writable } from "svelte/store";
  import { onMount, tick } from "svelte";
  import { OrderedExponentialFilter } from "./filters/ExponentialFilter";

  let ardupilotBinParserworker: Worker | undefined = undefined;

  let state = {};
  let scale = 20;
  let pitchOffset = 0;
  let altitudeOffset = 0;

  let altitudeOffsetStore = writable(0);
  $: {
    altitudeOffsetStore.set(altitudeOffset);
  }

  const projectOntoPlane = (v: Cartesian3, plane: [Cartesian3, Cartesian3]) => {
    //projmx - m(mtm)-1mt x
    //https://www.youtube.com/watch?v=OScgkL21Ffc
    const mtm = [
      plane[0].x * plane[0].x +
        plane[0].y * plane[0].y +
        plane[0].z * plane[0].z,
      plane[0].x * plane[1].x +
        plane[0].y * plane[1].y +
        plane[0].z * plane[1].z,
      plane[0].x * plane[1].x +
        plane[0].y * plane[1].y +
        plane[0].z * plane[1].z,
      plane[1].x * plane[1].x +
        plane[1].y * plane[1].y +
        plane[1].z * plane[1].z,
    ];

    const det = mtm[0] * mtm[3] - mtm[1] * mtm[2];
    const invmtm = [mtm[3] / det, -mtm[2] / det, -mtm[1] / det, mtm[0] / det];
    const minvmtm = [
      plane[0].x * invmtm[0] + plane[1].x * invmtm[2],
      plane[0].x * invmtm[1] + plane[1].x * invmtm[3],
      plane[0].y * invmtm[0] + plane[1].y * invmtm[2],
      plane[0].y * invmtm[1] + plane[1].y * invmtm[3],
      plane[0].z * invmtm[0] + plane[1].z * invmtm[2],
      plane[0].z * invmtm[1] + plane[1].z * invmtm[3],
    ];

    const mtx = [
      plane[0].x * v.x + plane[0].y * v.y + plane[0].z * v.z,
      plane[1].x * v.x + plane[1].y * v.y + plane[1].z * v.z,
    ];

    const minvmtm_mtx = Cartesian3.fromElements(
      minvmtm[0] * mtx[0] + minvmtm[1] * mtx[1],
      minvmtm[2] * mtx[0] + minvmtm[3] * mtx[1],
      minvmtm[4] * mtx[0] + minvmtm[5] * mtx[1]
    );

    return minvmtm_mtx;
  };

  const loadArdupilotData = (data, length, dataAtIndex) => {
    console.log("loading ardupilot data");
    totalSamples = length;

    const sampledPositionProperty = new SampledPositionProperty();
    sampledPositionProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });
    const sampledRawPositionProperty = new SampledPositionProperty();
    sampledRawPositionProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });
    const sampledPositionPropertyWithAltOffset = new CallbackProperty((t) => {
      const i = sampledRawPositionProperty.getValue(t);
      const lng = i.x / 10000000;
      const lat = i.y / 10000000;
      const alt = i.z + altitudeOffset;
      return Cartesian3.fromDegrees(lng, lat, alt);
    }, false);

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
    const sampledFixedFrameAccelerationProperty = new SampledProperty(
      Cartesian3
    );

    const sampledOrientationProperty = new SampledProperty(Quaternion);
    sampledOrientationProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });
    const sampledRawOrientationProperty = new SampledProperty(Cartesian3);
    // sampledRawOrientationProperty.setInterpolationOptions({
    //   interpolationAlgorithm: LagrangePolynomialApproximation,
    //   interpolationDegree: 5,
    // });

    const sampledWindProperty = new SampledProperty(Cartesian3);
    sampledWindProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });
    const sampledRawWindProperty = new SampledProperty(Cartesian2);
    sampledRawWindProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 5,
    });

    let start: JulianDate;
    let stop: JulianDate;

    const velocityRotationFromDatum = Transforms.headingPitchRollQuaternion(
      Cartesian3.ZERO,
      HeadingPitchRoll.fromDegrees(0, 90, 0)
    );
    const rotateHeadingAndPitch = Transforms.headingPitchRollQuaternion(
      Cartesian3.ZERO,
      HeadingPitchRoll.fromDegrees(0, 0, 270)
    );

    const eastNorthUpToFixedFrameAtPosition: Matrix4 = new Matrix4();

    const accYFilter = new OrderedExponentialFilter(0.2, 3);
    const accXFilter = new OrderedExponentialFilter(0.2, 3);
    const accZFilter = new OrderedExponentialFilter(0.2, 3);

    let zmin = 0;
    let zmax = 0;

    yieldingLoop(
      length,
      //30000,
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

        sampledRawPositionProperty.addSample(
          p.time,
          Cartesian3.fromElements(
            data.messages["POS"].Lng[i],
            data.messages["POS"].Lat[i],
            data.messages["POS"].Alt[i]
          )
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
        sampledRawWindProperty.addSample(
          p.time,
          Cartesian2.fromElements(vwn, vwe)
        );

        // Extended Kalman Filter (EKF) Attitude estimate
        const roll = data.messages["XKF1[0]"].Roll[i];
        const pitch = data.messages["XKF1[0]"].Pitch[i];
        const yaw = data.messages["XKF1[0]"].Yaw[i];

        const orientation = Transforms.headingPitchRollQuaternion(
          p.position,
          HeadingPitchRoll.fromDegrees(yaw - 90, pitch, roll)
        );
        sampledOrientationProperty.addSample(p.time, orientation);

        sampledRawOrientationProperty.addSample(
          p.time,
          Cartesian3.fromElements(yaw, pitch, roll)
        );

        // IMU Acceleration measurments
        // https://ardupilot.org/copter/docs/logmessages.html#imu
        // Exp filter since the data is noisy (engine vibration?)
        const accX = accXFilter.apply(data.messages["IMU[2]"].AccX[i * 2]);
        const accY = accYFilter.apply(data.messages["IMU[2]"].AccY[i * 2]);
        const accZ = accZFilter.apply(data.messages["IMU[2]"].AccZ[i * 2]);

        sampledFixedFrameAccelerationProperty.addSample(
          p.time,
          Cartesian3.fromElements(accX, accY, accZ)
        );

        const aVector = rotate(
          Cartesian3.fromElements(accX, -accY, -accZ),
          [orientation],
          new Cartesian3()
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

        sampledPositionProperty.addSample(p.time, p.position);
        //positions.push(p.position);
      },
      () => {
        const pitchOffsetOrientation = new CallbackProperty((t) => {
          const p = sampledPositionProperty.getValue(t);
          const i = sampledRawOrientationProperty.getValue(t);

          const _heading = i.x;
          const _pitch = i.y;
          const _roll = i.z;

          const orientation = Transforms.headingPitchRollQuaternion(
            p,
            HeadingPitchRoll.fromDegrees(
              // TODO - some abberations through some heading / pitch angles
              (_heading + 270) % 360,
              _pitch + pitchOffset,
              _roll
            )
          );
          return orientation;
        }, false);

        const modelUri =
          window.location.hostname == "localhost"
            ? "/Cesium_Air.gltf"
            : // Accomodate Github pages
              "/ardupilot_vg/Cesium_Air.gltf";

        const airplaneEntity = viewer.entities.add({
          availability: new TimeIntervalCollection([
            new TimeInterval({ start: start, stop: stop }),
          ]),
          position: sampledPositionPropertyWithAltOffset,
          model: {
            // Github pages prefix
            uri: modelUri,
            //minimumPixelSize: 64,
            //maximumScale: 100,
            scale: scale,
            shadows: ShadowMode.ENABLED,
            imageBasedLightingFactor: Cartesian2.ONE,
            //color: Color.fromAlpha(color, 1),
            //colorBlendMode: ColorBlendMode.MIX,
            //colorBlendAmount: 0.5,
            //silhouetteColor: Color.fromAlpha(color, 1),
            //silhouetteSize: 1,
          },
          //orientation: sampledOrientationProperty,
          orientation: pitchOffsetOrientation,
          // Seems to hog performance
          // path: {
          //   //resolution: 1,
          //   // material: new PolylineGlowMaterialProperty({
          //   //   glowPower: 0.1,
          //   //   color: Color.YELLOW,
          //   // }),
          //   material: Color.MAGENTA,
          //   width: 2,
          //   show: showPath,
          // },
        });
        entity = airplaneEntity;

        {
          let trajectoryPrimitive: Primitive | undefined = undefined;
          altitudeOffsetStore.subscribe((i) => {
            // plot trajectory

            const positions = [];
            const length = data.messages["POS"].time_boot_ms.length;
            for (let j = 0; j < length; j++) {
              const point = Cartesian3.fromDegrees(
                data.messages["POS"].Lng[j] / 10000000,
                data.messages["POS"].Lat[j] / 10000000,
                data.messages["POS"].Alt[j] + i
              );
              positions.push(point);
            }

            const geometryInstances = [
              new GeometryInstance({
                geometry: new PolylineGeometry({
                  positions: positions,
                  width: 3.0,
                }),
                attributes: {
                  color: ColorGeometryInstanceAttribute.fromColor(
                    Color.MAGENTA
                  ),
                },
              }),
            ];

            if (trajectoryPrimitive != undefined) {
              viewer.scene.primitives.remove(trajectoryPrimitive);
            }
            trajectoryPrimitive = new Primitive({
              geometryInstances: geometryInstances,
              appearance: new PolylineColorAppearance(),
            });

            viewer.scene.primitives.add(trajectoryPrimitive);
            viewer.scene.primitives.raiseToTop(trajectoryPrimitive);
            viewer.scene.requestRender();
          });
        }

        velocityEntity = viewer.entities.add({
          position: sampledPositionPropertyWithAltOffset,
          show: false,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionPropertyWithAltOffset.getValue(t);
              const v = Cartesian3.multiplyByScalar(
                sampledVelocityProperty.getValue(t),
                scale,
                new Cartesian3()
              );
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

        accelerationEntity = viewer.entities.add({
          position: sampledPositionPropertyWithAltOffset,
          show: false,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionPropertyWithAltOffset.getValue(t);
              const v = Cartesian3.multiplyByScalar(
                sampledAccelerationProperty.getValue(t),
                scale,
                new Cartesian3()
              );
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

        orientationEntity = viewer.entities.add({
          position: sampledPositionPropertyWithAltOffset,
          show: false,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionPropertyWithAltOffset.getValue(t);
              const v = Cartesian3.multiplyByScalar(
                rotate(Cartesian3.fromElements(0, -20, 0), [
                  pitchOffsetOrientation.getValue(t),
                  velocityRotationFromDatum,
                ]),
                scale,
                new Cartesian3()
              );
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

        windEntity = viewer.entities.add({
          position: sampledPositionPropertyWithAltOffset,
          show: false,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionPropertyWithAltOffset.getValue(t);
              const v = Cartesian3.multiplyByScalar(
                sampledWindProperty.getValue(t),
                scale,
                new Cartesian3()
              );
              if (p && v) {
                const pPlusV = Cartesian3.add(
                  p,
                  Cartesian3.multiplyByScalar(
                    sampledVelocityProperty.getValue(t),
                    scale,
                    new Cartesian3()
                  ),
                  new Cartesian3()
                );
                return [
                  pPlusV,
                  Cartesian3.subtract(pPlusV, v, new Cartesian3()),
                ];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.AQUA,
          }),
        });
        interpolatedVectorEntities.push(windEntity);

        relativeWindEntity = viewer.entities.add({
          position: sampledPositionPropertyWithAltOffset,
          show: false,
          polyline: new PolylineGraphics({
            positions: new CallbackProperty((t) => {
              const p = sampledPositionPropertyWithAltOffset.getValue(t);
              const v = Cartesian3.multiplyByScalar(
                sampledWindProperty.getValue(t),
                scale,
                new Cartesian3()
              );
              if (p && v) {
                const pPlusV = Cartesian3.add(
                  p,
                  Cartesian3.multiplyByScalar(
                    sampledVelocityProperty.getValue(t),
                    scale,
                    new Cartesian3()
                  ),
                  new Cartesian3()
                );
                return [p, Cartesian3.subtract(pPlusV, v, new Cartesian3())];
              } else {
                return undefined;
              }
            }, false),
            width: 3,
            material: Color.ORANGE,
          }),
        });
        interpolatedVectorEntities.push(relativeWindEntity);

        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = stop.clone();
        viewer.clock.currentTime = start.clone();

        viewer.timeline.zoomTo(start, stop);
        viewer.clock.shouldAnimate = true;

        viewer.trackedEntity = airplaneEntity;

        viewer.clock.onTick.addEventListener((clock) => {
          const knotsPerMetersPerSecond = 1.944;

          const sv = sampledVelocityProperty.getValue(clock.currentTime);
          if (sv) {
            velocity = Cartesian3.magnitude(sv) * knotsPerMetersPerSecond;
          }

          const sg = sampledAccelerationProperty.getValue(clock.currentTime);
          if (sg) {
            g = Cartesian3.magnitude(sg);
          }

          const sw = sampledRawWindProperty.getValue(clock.currentTime);
          if (sw) {
            windSpeed = Cartesian2.magnitude(sw) * knotsPerMetersPerSecond;
            windDir = ((Math.atan(-sw.x / sw.y) * 180) / Math.PI + 270) % 360;
          }

          const so = sampledRawOrientationProperty.getValue(clock.currentTime);
          if (so) {
            heading = so.x;
            pitch = so.y;
            roll = so.z;
          }

          // aoa
          {
            // relative wind
            const relativeWind = Cartesian3.subtract(
              // add?
              sv,
              sampledWindProperty.getValue(clock.currentTime),
              new Cartesian3()
            );
            const planeBasisVectors: [Cartesian3, Cartesian3] = [
              // londitudinal axis
              Cartesian3.multiplyByScalar(
                rotate(Cartesian3.fromElements(0, -20, 0), [
                  pitchOffsetOrientation.getValue(clock.currentTime),
                  velocityRotationFromDatum,
                ]),
                scale,
                new Cartesian3()
              ),
              // normal axis
              Cartesian3.multiplyByScalar(
                rotate(Cartesian3.fromElements(0, -20, 0), [
                  pitchOffsetOrientation.getValue(clock.currentTime),
                  rotateHeadingAndPitch,
                ]),
                scale,
                new Cartesian3()
              ),
            ];
            const projectedRelativeWind = projectOntoPlane(
              relativeWind,
              planeBasisVectors
            );

            try {
              aoa =
                (Cartesian3.angleBetween(
                  projectedRelativeWind,
                  planeBasisVectors[0]
                ) *
                  180) /
                Math.PI;
            } catch (error) {
              //console.log("error calculating aoa", error);
            }
          }

          // incline / ball
          {
            const normalAxisBasis = rotate(Cartesian3.fromElements(0, -20, 0), [
              pitchOffsetOrientation.getValue(clock.currentTime),
              rotateHeadingAndPitch,
            ]);

            const lateralAxisBasis = rotate(
              Cartesian3.fromElements(-20, 0, 0),
              [
                pitchOffsetOrientation.getValue(clock.currentTime),
                rotateHeadingAndPitch,
              ]
            );

            const projectedAcceleration = projectOntoPlane(
              sampledAccelerationProperty.getValue(clock.currentTime),
              [normalAxisBasis, lateralAxisBasis]
            );

            const angleBetween = (a: Cartesian3, b: Cartesian3) => {
              const dotProduct = a.x * b.x + a.y * b.y + a.z * b.z;

              return Math.acos(
                dotProduct / (Cartesian3.magnitude(a) * Cartesian3.magnitude(b))
              );
            };

            incline =
              (angleBetween(projectedAcceleration, lateralAxisBasis) * 180) /
                Math.PI -
              90;
          }

          const ffa: Cartesian3 =
            sampledFixedFrameAccelerationProperty.getValue(clock.currentTime);
          ax = ffa.x;
          ay = ffa.y;
          az = ffa.z;

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

            // tas
            {
              const rw = Cartesian3.subtract(
                sampledVelocityProperty.getValue(clock.currentTime),
                sampledWindProperty.getValue(clock.currentTime),
                new Cartesian3()
              );
              tas = Cartesian3.magnitude(rw) * knotsPerMetersPerSecond;
            }
          } else {
            tas = undefined;
          }

          if (tas != undefined && g != undefined) {
            onUpdate(tas, g / 9.8, clock.currentTime);
          }
        });
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

    let p = new Quaternion(vector.x, vector.y, vector.z, 0);
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

  let samples = 0;
  let totalSamples = 0;
  let velocity = 0;
  let g = 0;
  let ax = 0;
  let ay = 0;
  let az = 0;

  let heading = 0;
  let pitch = 0;
  let roll = 0;

  let windDir = 360;
  let windSpeed = 0;
  let tas = 0;
  let aoa = 0;
  let incline = 0;

  let orientationEntity = undefined;
  let velocityEntity = undefined;
  let windEntity = undefined;
  let relativeWindEntity = undefined;
  let accelerationEntity = undefined;

  let showOrientation = false;
  let showVelocity = false;
  let showWind = false;
  let showRelativeWind = false;
  let showAcceleration = false;

  let viewer: Viewer;

  $: {
    windDir;
    windSpeed;
  }

  $: {
    if (entity) {
      entity.model.scale = scale;
    }
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

Samples: {samples} / {totalSamples}
<br />
<br />
<div style="width: 100%; display: inline-block; margin-bottom: 1em">
  <div style={"width: 50%;  float: left;"}>
    g (load factor): {(g / 9.8).toFixed(1)}
    <br />
    GS {velocity.toFixed(0)}KT
    <br />
    Wind {windDir.toFixed(0)}
    {windSpeed.toFixed(0)}KT
    <br />
    TAS {tas.toFixed(0)}KT
    <br />
    <br />
    ax (m/s^2): {ax.toFixed(1)}
    <br />
    ay (m/s^2): {ay.toFixed(1)}
    <br />
    az (m/s^2): {az.toFixed(1)}
    <br />
  </div>
  <div style={"margin-left: 50%;"}>
    Heading {heading.toFixed(0)}
    Pitch {(pitch + pitchOffset).toFixed(1)}
    Roll {roll.toFixed(0)}
    <br />
    Angle of attack {aoa.toFixed(1)}
    <br />
    Incline (ball) {incline.toFixed(1)}
    <br />
    <br />
    <label for="showPath">Show orientation</label>
    <input
      type="checkbox"
      bind:checked={showOrientation}
      on:change={(e) => {
        if (orientationEntity) {
          orientationEntity.show = showOrientation;
        }
      }}
    />
    <br />
    <label for="showPath">Show velocity</label>
    <input
      type="checkbox"
      bind:checked={showVelocity}
      on:change={(e) => {
        if (velocityEntity) {
          velocityEntity.show = showVelocity;
        }
      }}
    />
    <br />
    <label for="showPath">Show wind</label>
    <input
      type="checkbox"
      bind:checked={showWind}
      on:change={(e) => {
        if (windEntity) {
          windEntity.show = showWind;
        }
      }}
    />
    <br />
    <label for="showPath">Show relative wind</label>
    <input
      type="checkbox"
      id="showPath"
      name="showPath"
      bind:checked={showRelativeWind}
      on:change={(e) => {
        if (relativeWindEntity) {
          relativeWindEntity.show = showRelativeWind;
        }
      }}
    />
    <br />
    <label for="showPath">Show acceleration</label>
    <input
      type="checkbox"
      id="showPath"
      name="showPath"
      bind:checked={showAcceleration}
      on:change={(e) => {
        if (accelerationEntity) {
          accelerationEntity.show = showAcceleration;
        }
      }}
    />
    <br />
    <label for="showPath">Show samples</label>
    <input
      type="checkbox"
      id="showPath"
      name="showPath"
      bind:checked={showSamples}
      on:change={(e) => {
        sampleEntities.forEach((i) => {
          i.show = showSamples;
        });
      }}
    />
    <br />
  </div>
</div>
<br />
<div style="width: 100%;">
  Pitch offset
  <input type="range" min="-30" max="30" step="0.1" bind:value={pitchOffset} />
  {pitchOffset}
  <br />
  Altitude offset
  <input
    type="range"
    min="-200"
    max="200"
    step="0.1"
    bind:value={altitudeOffset}
  />
  {altitudeOffset}
  <br />
  Scale <input type="range" min="1" max="100" bind:value={scale} />
  <br />
  <h4>Sample Ardupilot bin files</h4>
  <a href="https://ardupilotvg.s3.ap-southeast-2.amazonaws.com/00000006.BIN"
    >00000006.BIN</a
  >
  <br />
  <a
    href="https://ardupilotvg.s3.ap-southeast-2.amazonaws.com/2024-06-02+16-18-30.bin"
    >2024-06-02 16-18-30.bin</a
  >
</div>
