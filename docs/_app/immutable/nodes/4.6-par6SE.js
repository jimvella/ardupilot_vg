import{s as F,n as L}from"../chunks/scheduler.CwdQ81Uq.js";import{S as I,i as N,e as o,s as x,t as V,c as n,g as l,a as v,b as $,d as E,f as a,h as i}from"../chunks/index.wZA6n5_d.js";function J(j){let s,M="Drone autopilot flight logging",C,r,k="For aerobatic and loss of control training flights",b,h,D=`A technical ecosystem and collective experience in the form of open source
  software and commodity hardware has developed around drones that we can tap
  into for relatively low cost yet precise aircraft flight path logging. <a href="https://ardupilot.org/">ArduPilot</a>
  is an example of such software which at its heart has an &quot;<a href="https://ardupilot.org/copter/docs/common-apm-navigation-extended-kalman-filter-overview.html">advanced sensor fusion algorithm</a>
  that can extend the GPS based positioning with inertial navigation to deliver a
  smooth and accurate flight path and attitude log with 15-25 points per second.
  This compares to 1-2 per second (with no attitude information) of a typical GPS
  only system.&quot;
  <a href="https://discuss.ardupilot.org/t/flight-coach-using-ardupilot-bin-files-as-an-interesting-way-of-viewing-aerobatic-flights/74134">[1]</a>. <a href="https://docs.cubepilot.org/user-guides">CubePilot</a> is an example
  of commodity hardware that can host software such as ArduPilot.`,w,u,q="ArduPilot Plane BlackBox Logger",y,d,B=`ArduPilot has <a href="https://ardupilot.org/plane/docs/common-blackboxlogger.html">specific firmare*</a>
  designed for the BlackBox logger usecase. Note this is a build time option, but
  there is a
  <a href="https://ardupilot.org/plane/docs/common-blackboxlogger.html">community build server</a> available for building.`,P,p,O=`* In ArduPilot nomenclature 'firmware' means software that runs on the drone -\r
  as opposed to software that runs on the ground station.`,_,f,S="CubePilot Hardware",A,c,G="Aircraft Mounting",H,m,z="Analysing Logs",T,g,U=`The <a href="https://ardupilot.org/plane/docs/common-logs.html">logs</a>
  recorded by the autopilot are called Dataflash logs and can be identified by the
  &#39;.bin&#39; file extention. The easiest way to review ArduPilot logs is the web based
  <a href="https://plot.ardupilot.org/#/">UAV Log Viewer</a> application.
  Details of what is logged can be found in the
  <a href="https://ardupilot.org/plane/docs/logmessages.html">ArduPilot documentaion</a>.`;return{c(){s=o("h1"),s.textContent=M,C=x(),r=o("h2"),r.textContent=k,b=x(),h=o("p"),h.innerHTML=D,w=x(),u=o("h2"),u.textContent=q,y=x(),d=o("p"),d.innerHTML=B,P=x(),p=o("p"),p.textContent=O,_=x(),f=o("h2"),f.textContent=S,A=V(`\r
A suggested configuration is the Cube Orange+, Mini Carrier Board, and Here4 GPS\r
(roughly $1000 AUD).\r
\r
`),c=o("h2"),c.textContent=G,H=V(`\r
TODO\r
\r
`),m=o("h2"),m.textContent=z,T=x(),g=o("p"),g.innerHTML=U,this.h()},l(t){s=n(t,"H1",{"data-svelte-h":!0}),l(s)!=="svelte-u9hmnc"&&(s.textContent=M),C=v(t),r=n(t,"H2",{style:!0,"data-svelte-h":!0}),l(r)!=="svelte-qzzjml"&&(r.textContent=k),b=v(t),h=n(t,"P",{"data-svelte-h":!0}),l(h)!=="svelte-1i5qsut"&&(h.innerHTML=D),w=v(t),u=n(t,"H2",{"data-svelte-h":!0}),l(u)!=="svelte-1thwg1m"&&(u.textContent=q),y=v(t),d=n(t,"P",{"data-svelte-h":!0}),l(d)!=="svelte-1lq45kt"&&(d.innerHTML=B),P=v(t),p=n(t,"P",{"data-svelte-h":!0}),l(p)!=="svelte-14wr4ku"&&(p.textContent=O),_=v(t),f=n(t,"H2",{"data-svelte-h":!0}),l(f)!=="svelte-ymxlht"&&(f.textContent=S),A=$(t,`\r
A suggested configuration is the Cube Orange+, Mini Carrier Board, and Here4 GPS\r
(roughly $1000 AUD).\r
\r
`),c=n(t,"H2",{"data-svelte-h":!0}),l(c)!=="svelte-8i2ghh"&&(c.textContent=G),H=$(t,`\r
TODO\r
\r
`),m=n(t,"H2",{"data-svelte-h":!0}),l(m)!=="svelte-1u1zftf"&&(m.textContent=z),T=v(t),g=n(t,"P",{"data-svelte-h":!0}),l(g)!=="svelte-1csnpts"&&(g.innerHTML=U),this.h()},h(){E(r,"margin-top","-1em")},m(t,e){a(t,s,e),a(t,C,e),a(t,r,e),a(t,b,e),a(t,h,e),a(t,w,e),a(t,u,e),a(t,y,e),a(t,d,e),a(t,P,e),a(t,p,e),a(t,_,e),a(t,f,e),a(t,A,e),a(t,c,e),a(t,H,e),a(t,m,e),a(t,T,e),a(t,g,e)},p:L,i:L,o:L,d(t){t&&(i(s),i(C),i(r),i(b),i(h),i(w),i(u),i(y),i(d),i(P),i(p),i(_),i(f),i(A),i(c),i(H),i(m),i(T),i(g))}}}class R extends I{constructor(s){super(),N(this,s,null,J,F,{})}}export{R as component};
