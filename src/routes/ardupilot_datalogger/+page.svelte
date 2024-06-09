<h1>Drone autopilot flight logging</h1>
<h2 style="margin-top: -1em;">
  For aerobatic and loss of control training flights
</h2>
<p>
  A technical ecosystem and collective experience in the form of open source
  software and commodity hardware has developed around drones that we can tap
  into for relatively low cost yet precise aircraft flight path logging. <a
    href="https://ardupilot.org/">ArduPilot</a
  >
  is an example of such software which at its heart has an "<a
    href="https://ardupilot.org/copter/docs/common-apm-navigation-extended-kalman-filter-overview.html"
    >advanced sensor fusion algorithm</a
  >
  that can extend the GPS based positioning with inertial navigation to deliver a
  smooth and accurate flight path and attitude log with 15-25 points per second.
  This compares to 1-2 per second (with no attitude information) of a typical GPS
  only system."
  <a
    href="https://discuss.ardupilot.org/t/flight-coach-using-ardupilot-bin-files-as-an-interesting-way-of-viewing-aerobatic-flights/74134"
    >[1]</a
  >. <a href="https://docs.cubepilot.org/user-guides">CubePilot</a> is an example
  of commodity hardware that can host software such as ArduPilot.
</p>

<h2>ArduPilot Plane BlackBox Logger</h2>
<p>
  ArduPilot has <a
    href="https://ardupilot.org/plane/docs/common-blackboxlogger.html"
    >specific firmare*</a
  >
  designed for the BlackBox logger usecase. Note this is a build time option, but
  there is a
  <a href="https://ardupilot.org/plane/docs/common-blackboxlogger.html"
    >community build server</a
  > available for building.
</p>
<p>
  * In ArduPilot nomenclature 'firmware' means software that runs on the drone -
  as opposed to software that runs on the ground station.
</p>

<h2>CubePilot Hardware</h2>
A suggested configuration is the Cube Orange+, Mini Carrier Board, and Here4 GPS
(roughly $1000 AUD).

<h2>Aircraft Mounting</h2>
TODO

<h2>Analysing Logs</h2>
<p>
  The <a href="https://ardupilot.org/plane/docs/common-logs.html">logs</a>
  recorded by the autopilot are called Dataflash logs and can be identified by the
  '.bin' file extention. The easiest way to review ArduPilot logs is the web based
  <a href="https://plot.ardupilot.org/#/">UAV Log Viewer</a> application.
  Details of what is logged can be found in the
  <a href="https://ardupilot.org/plane/docs/logmessages.html"
    >ArduPilot documentaion</a
  >.
</p>
