(function () {
  var POSITIONS = [0, 0.32, 0.48, 0.68, 1];
  var PERIOD = 60000;

  function hexToLinear(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map(function (channel) {
      var c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
  }

  function linearToOklab(rgb) {
    var l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]);
    var m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]);
    var s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function oklabToRgb(lab) {
    var l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
    var m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
    var s = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2];
    l = l * l * l;
    m = m * m * m;
    s = s * s * s;
    var linear = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
    return linear.map(function (c) {
      var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      return Math.round(v * 255);
    });
  }

  function lerpLab(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  function evaluate(stops, position) {
    var i;
    for (i = 0; i < stops.length - 1; i++) {
      var start = stops[i];
      var end = stops[i + 1];
      if (position <= end[0]) {
        var span = end[0] - start[0];
        var t = span === 0 ? 0 : (position - start[0]) / span;
        return lerpLab(start[1], end[1], t);
      }
    }
    return stops[stops.length - 1][1];
  }

  function toStops(pairs) {
    return pairs.map(function (pair) {
      return [pair[0], linearToOklab(hexToLinear(pair[1]))];
    });
  }

  function samples(stops) {
    return POSITIONS.map(function (position) {
      return evaluate(stops, position);
    });
  }

  var day = samples(toStops([
    [0, "#91B2FE"],
    [1, "#BDD3FE"]
  ]));
  var sunset = samples(toStops([
    [0, "#5C6E96"],
    [0.32, "#896773"],
    [0.68, "#C8754E"],
    [1, "#E58B4E"]
  ]));
  var night = samples(toStops([
    [0, "#232247"],
    [0.48, "#5A6EA7"],
    [1, "#0E204E"]
  ]));

  function mixFrame(phase) {
    var third = 1 / 3;
    var from = day;
    var to = sunset;
    var t = phase / third;
    if (phase >= 2 * third) {
      from = night;
      to = day;
      t = (phase - 2 * third) / third;
    } else if (phase >= third) {
      from = sunset;
      to = night;
      t = (phase - third) / third;
    }
    return from.map(function (color, index) {
      return lerpLab(color, to[index], t);
    });
  }

  var canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var root = document.documentElement;
    var width = Math.max(1, Math.round(root.clientWidth * dpr));
    var height = Math.max(1, Math.round(root.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function paint() {
    if (!canvas.width || !canvas.height) return;
    var phase = (performance.now() % PERIOD) / PERIOD;
    var colors = mixFrame(phase);
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    for (var i = 0; i < POSITIONS.length; i++) {
      var rgb = oklabToRgb(colors[i]);
      gradient.addColorStop(POSITIONS[i], "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener("resize", function () {
    resize();
    paint();
  });

  function frame() {
    resize();
    paint();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
