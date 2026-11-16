/*
# Third-party notices

The self-contained browser bundles include the following libraries.
No additional runtime scripts or CDN requests are required.

## @xmldom/xmldom 0.9.12

Copyright 2019 - present Christopher J. Brody and other contributors, as listed in: https://github.com/xmldom/xmldom/graphs/contributors
Copyright 2012 - 2017 @jindw <jindw@xidea.org> and other contributors, as listed in: https://github.com/jindw/xmldom/graphs/contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


## svgpath 2.6.0

(The MIT License)

Copyright (C) 2013-2015 by Vitaly Puzrin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.



*/
var arch = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/svgpath/lib/path_parse.js
  var require_path_parse = __commonJS({
    "node_modules/svgpath/lib/path_parse.js"(exports, module) {
      "use strict";
      var paramCounts = { a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0 };
      var SPECIAL_SPACES = [
        5760,
        6158,
        8192,
        8193,
        8194,
        8195,
        8196,
        8197,
        8198,
        8199,
        8200,
        8201,
        8202,
        8239,
        8287,
        12288,
        65279
      ];
      function isSpace(ch) {
        return ch === 10 || ch === 13 || ch === 8232 || ch === 8233 || // Line terminators
        // White spaces
        ch === 32 || ch === 9 || ch === 11 || ch === 12 || ch === 160 || ch >= 5760 && SPECIAL_SPACES.indexOf(ch) >= 0;
      }
      function isCommand(code) {
        switch (code | 32) {
          case 109:
          case 122:
          case 108:
          case 104:
          case 118:
          case 99:
          case 115:
          case 113:
          case 116:
          case 97:
          case 114:
            return true;
        }
        return false;
      }
      function isArc(code) {
        return (code | 32) === 97;
      }
      function isDigit(code) {
        return code >= 48 && code <= 57;
      }
      function isDigitStart(code) {
        return code >= 48 && code <= 57 || /* 0..9 */
        code === 43 || /* + */
        code === 45 || /* - */
        code === 46;
      }
      function State(path) {
        this.index = 0;
        this.path = path;
        this.max = path.length;
        this.result = [];
        this.param = 0;
        this.err = "";
        this.segmentStart = 0;
        this.data = [];
      }
      function skipSpaces(state) {
        while (state.index < state.max && isSpace(state.path.charCodeAt(state.index))) {
          state.index++;
        }
      }
      function scanFlag(state) {
        var ch = state.path.charCodeAt(state.index);
        if (ch === 48) {
          state.param = 0;
          state.index++;
          return;
        }
        if (ch === 49) {
          state.param = 1;
          state.index++;
          return;
        }
        state.err = "SvgPath: arc flag can be 0 or 1 only (at pos " + state.index + ")";
      }
      function scanParam(state) {
        var start = state.index, index = start, max = state.max, zeroFirst = false, hasCeiling = false, hasDecimal = false, hasDot = false, ch;
        if (index >= max) {
          state.err = "SvgPath: missed param (at pos " + index + ")";
          return;
        }
        ch = state.path.charCodeAt(index);
        if (ch === 43 || ch === 45) {
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (!isDigit(ch) && ch !== 46) {
          state.err = "SvgPath: param should start with 0..9 or `.` (at pos " + index + ")";
          return;
        }
        if (ch !== 46) {
          zeroFirst = ch === 48;
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
          if (zeroFirst && index < max) {
            if (ch && isDigit(ch)) {
              state.err = "SvgPath: numbers started with `0` such as `09` are illegal (at pos " + start + ")";
              return;
            }
          }
          while (index < max && isDigit(state.path.charCodeAt(index))) {
            index++;
            hasCeiling = true;
          }
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (ch === 46) {
          hasDot = true;
          index++;
          while (isDigit(state.path.charCodeAt(index))) {
            index++;
            hasDecimal = true;
          }
          ch = index < max ? state.path.charCodeAt(index) : 0;
        }
        if (ch === 101 || ch === 69) {
          if (hasDot && !hasCeiling && !hasDecimal) {
            state.err = "SvgPath: invalid float exponent (at pos " + index + ")";
            return;
          }
          index++;
          ch = index < max ? state.path.charCodeAt(index) : 0;
          if (ch === 43 || ch === 45) {
            index++;
          }
          if (index < max && isDigit(state.path.charCodeAt(index))) {
            while (index < max && isDigit(state.path.charCodeAt(index))) {
              index++;
            }
          } else {
            state.err = "SvgPath: invalid float exponent (at pos " + index + ")";
            return;
          }
        }
        state.index = index;
        state.param = parseFloat(state.path.slice(start, index)) + 0;
      }
      function finalizeSegment(state) {
        var cmd, cmdLC;
        cmd = state.path[state.segmentStart];
        cmdLC = cmd.toLowerCase();
        var params = state.data;
        if (cmdLC === "m" && params.length > 2) {
          state.result.push([cmd, params[0], params[1]]);
          params = params.slice(2);
          cmdLC = "l";
          cmd = cmd === "m" ? "l" : "L";
        }
        if (cmdLC === "r") {
          state.result.push([cmd].concat(params));
        } else {
          while (params.length >= paramCounts[cmdLC]) {
            state.result.push([cmd].concat(params.splice(0, paramCounts[cmdLC])));
            if (!paramCounts[cmdLC]) {
              break;
            }
          }
        }
      }
      function scanSegment(state) {
        var max = state.max, cmdCode, is_arc, comma_found, need_params, i;
        state.segmentStart = state.index;
        cmdCode = state.path.charCodeAt(state.index);
        is_arc = isArc(cmdCode);
        if (!isCommand(cmdCode)) {
          state.err = "SvgPath: bad command " + state.path[state.index] + " (at pos " + state.index + ")";
          return;
        }
        need_params = paramCounts[state.path[state.index].toLowerCase()];
        state.index++;
        skipSpaces(state);
        state.data = [];
        if (!need_params) {
          finalizeSegment(state);
          return;
        }
        comma_found = false;
        for (; ; ) {
          for (i = need_params; i > 0; i--) {
            if (is_arc && (i === 3 || i === 4)) scanFlag(state);
            else scanParam(state);
            if (state.err.length) {
              finalizeSegment(state);
              return;
            }
            state.data.push(state.param);
            skipSpaces(state);
            comma_found = false;
            if (state.index < max && state.path.charCodeAt(state.index) === 44) {
              state.index++;
              skipSpaces(state);
              comma_found = true;
            }
          }
          if (comma_found) {
            continue;
          }
          if (state.index >= state.max) {
            break;
          }
          if (!isDigitStart(state.path.charCodeAt(state.index))) {
            break;
          }
        }
        finalizeSegment(state);
      }
      module.exports = function pathParse(svgPath) {
        var state = new State(svgPath);
        var max = state.max;
        skipSpaces(state);
        while (state.index < max && !state.err.length) {
          scanSegment(state);
        }
        if (state.result.length) {
          if ("mM".indexOf(state.result[0][0]) < 0) {
            state.err = "SvgPath: string should start with `M` or `m`";
            state.result = [];
          } else {
            state.result[0][0] = "M";
          }
        }
        return {
          err: state.err,
          segments: state.result
        };
      };
    }
  });

  // node_modules/svgpath/lib/matrix.js
  var require_matrix = __commonJS({
    "node_modules/svgpath/lib/matrix.js"(exports, module) {
      "use strict";
      function combine(m1, m2) {
        return [
          m1[0] * m2[0] + m1[2] * m2[1],
          m1[1] * m2[0] + m1[3] * m2[1],
          m1[0] * m2[2] + m1[2] * m2[3],
          m1[1] * m2[2] + m1[3] * m2[3],
          m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
          m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
        ];
      }
      function Matrix() {
        if (!(this instanceof Matrix)) {
          return new Matrix();
        }
        this.queue = [];
        this.cache = null;
      }
      Matrix.prototype.matrix = function(m) {
        if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) {
          return this;
        }
        this.cache = null;
        this.queue.push(m);
        return this;
      };
      Matrix.prototype.translate = function(tx, ty) {
        if (tx !== 0 || ty !== 0) {
          this.cache = null;
          this.queue.push([1, 0, 0, 1, tx, ty]);
        }
        return this;
      };
      Matrix.prototype.scale = function(sx, sy) {
        if (sx !== 1 || sy !== 1) {
          this.cache = null;
          this.queue.push([sx, 0, 0, sy, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.rotate = function(angle, rx, ry) {
        var rad, cos, sin;
        if (angle !== 0) {
          this.translate(rx, ry);
          rad = angle * Math.PI / 180;
          cos = Math.cos(rad);
          sin = Math.sin(rad);
          this.queue.push([cos, sin, -sin, cos, 0, 0]);
          this.cache = null;
          this.translate(-rx, -ry);
        }
        return this;
      };
      Matrix.prototype.skewX = function(angle) {
        if (angle !== 0) {
          this.cache = null;
          this.queue.push([1, 0, Math.tan(angle * Math.PI / 180), 1, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.skewY = function(angle) {
        if (angle !== 0) {
          this.cache = null;
          this.queue.push([1, Math.tan(angle * Math.PI / 180), 0, 1, 0, 0]);
        }
        return this;
      };
      Matrix.prototype.toArray = function() {
        if (this.cache) {
          return this.cache;
        }
        if (!this.queue.length) {
          this.cache = [1, 0, 0, 1, 0, 0];
          return this.cache;
        }
        this.cache = this.queue[0];
        if (this.queue.length === 1) {
          return this.cache;
        }
        for (var i = 1; i < this.queue.length; i++) {
          this.cache = combine(this.cache, this.queue[i]);
        }
        return this.cache;
      };
      Matrix.prototype.calc = function(x, y, isRelative) {
        var m;
        if (!this.queue.length) {
          return [x, y];
        }
        if (!this.cache) {
          this.cache = this.toArray();
        }
        m = this.cache;
        return [
          x * m[0] + y * m[2] + (isRelative ? 0 : m[4]),
          x * m[1] + y * m[3] + (isRelative ? 0 : m[5])
        ];
      };
      module.exports = Matrix;
    }
  });

  // node_modules/svgpath/lib/transform_parse.js
  var require_transform_parse = __commonJS({
    "node_modules/svgpath/lib/transform_parse.js"(exports, module) {
      "use strict";
      var Matrix = require_matrix();
      var operations = {
        matrix: true,
        scale: true,
        rotate: true,
        translate: true,
        skewX: true,
        skewY: true
      };
      var CMD_SPLIT_RE = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
      var PARAMS_SPLIT_RE = /[\s,]+/;
      module.exports = function transformParse(transformString) {
        var matrix = new Matrix();
        var cmd, params;
        transformString.split(CMD_SPLIT_RE).forEach(function(item) {
          if (!item.length) {
            return;
          }
          if (typeof operations[item] !== "undefined") {
            cmd = item;
            return;
          }
          params = item.split(PARAMS_SPLIT_RE).map(function(i) {
            return +i || 0;
          });
          switch (cmd) {
            case "matrix":
              if (params.length === 6) {
                matrix.matrix(params);
              }
              return;
            case "scale":
              if (params.length === 1) {
                matrix.scale(params[0], params[0]);
              } else if (params.length === 2) {
                matrix.scale(params[0], params[1]);
              }
              return;
            case "rotate":
              if (params.length === 1) {
                matrix.rotate(params[0], 0, 0);
              } else if (params.length === 3) {
                matrix.rotate(params[0], params[1], params[2]);
              }
              return;
            case "translate":
              if (params.length === 1) {
                matrix.translate(params[0], 0);
              } else if (params.length === 2) {
                matrix.translate(params[0], params[1]);
              }
              return;
            case "skewX":
              if (params.length === 1) {
                matrix.skewX(params[0]);
              }
              return;
            case "skewY":
              if (params.length === 1) {
                matrix.skewY(params[0]);
              }
              return;
          }
        });
        return matrix;
      };
    }
  });

  // node_modules/svgpath/lib/a2c.js
  var require_a2c = __commonJS({
    "node_modules/svgpath/lib/a2c.js"(exports, module) {
      "use strict";
      var TAU = Math.PI * 2;
      function unit_vector_angle(ux, uy, vx, vy) {
        var sign = ux * vy - uy * vx < 0 ? -1 : 1;
        var dot = ux * vx + uy * vy;
        if (dot > 1) {
          dot = 1;
        }
        if (dot < -1) {
          dot = -1;
        }
        return sign * Math.acos(dot);
      }
      function get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi) {
        var x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        var y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;
        var rx_sq = rx * rx;
        var ry_sq = ry * ry;
        var x1p_sq = x1p * x1p;
        var y1p_sq = y1p * y1p;
        var radicant = rx_sq * ry_sq - rx_sq * y1p_sq - ry_sq * x1p_sq;
        if (radicant < 0) {
          radicant = 0;
        }
        radicant /= rx_sq * y1p_sq + ry_sq * x1p_sq;
        radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);
        var cxp = radicant * rx / ry * y1p;
        var cyp = radicant * -ry / rx * x1p;
        var cx = cos_phi * cxp - sin_phi * cyp + (x1 + x2) / 2;
        var cy = sin_phi * cxp + cos_phi * cyp + (y1 + y2) / 2;
        var v1x = (x1p - cxp) / rx;
        var v1y = (y1p - cyp) / ry;
        var v2x = (-x1p - cxp) / rx;
        var v2y = (-y1p - cyp) / ry;
        var theta1 = unit_vector_angle(1, 0, v1x, v1y);
        var delta_theta = unit_vector_angle(v1x, v1y, v2x, v2y);
        if (fs === 0 && delta_theta > 0) {
          delta_theta -= TAU;
        }
        if (fs === 1 && delta_theta < 0) {
          delta_theta += TAU;
        }
        return [cx, cy, theta1, delta_theta];
      }
      function approximate_unit_arc(theta1, delta_theta) {
        var alpha = 4 / 3 * Math.tan(delta_theta / 4);
        var x1 = Math.cos(theta1);
        var y1 = Math.sin(theta1);
        var x2 = Math.cos(theta1 + delta_theta);
        var y2 = Math.sin(theta1 + delta_theta);
        return [x1, y1, x1 - y1 * alpha, y1 + x1 * alpha, x2 + y2 * alpha, y2 - x2 * alpha, x2, y2];
      }
      module.exports = function a2c(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
        var sin_phi = Math.sin(phi * TAU / 360);
        var cos_phi = Math.cos(phi * TAU / 360);
        var x1p = cos_phi * (x1 - x2) / 2 + sin_phi * (y1 - y2) / 2;
        var y1p = -sin_phi * (x1 - x2) / 2 + cos_phi * (y1 - y2) / 2;
        if (x1p === 0 && y1p === 0) {
          return [];
        }
        if (rx === 0 || ry === 0) {
          return [];
        }
        rx = Math.abs(rx);
        ry = Math.abs(ry);
        var lambda = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
        if (lambda > 1) {
          rx *= Math.sqrt(lambda);
          ry *= Math.sqrt(lambda);
        }
        var cc = get_arc_center(x1, y1, x2, y2, fa, fs, rx, ry, sin_phi, cos_phi);
        var result = [];
        var theta1 = cc[2];
        var delta_theta = cc[3];
        var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);
        delta_theta /= segments;
        for (var i = 0; i < segments; i++) {
          result.push(approximate_unit_arc(theta1, delta_theta));
          theta1 += delta_theta;
        }
        return result.map(function(curve) {
          for (var i2 = 0; i2 < curve.length; i2 += 2) {
            var x = curve[i2 + 0];
            var y = curve[i2 + 1];
            x *= rx;
            y *= ry;
            var xp = cos_phi * x - sin_phi * y;
            var yp = sin_phi * x + cos_phi * y;
            curve[i2 + 0] = xp + cc[0];
            curve[i2 + 1] = yp + cc[1];
          }
          return curve;
        });
      };
    }
  });

  // node_modules/svgpath/lib/ellipse.js
  var require_ellipse = __commonJS({
    "node_modules/svgpath/lib/ellipse.js"(exports, module) {
      "use strict";
      var epsilon = 1e-10;
      var torad = Math.PI / 180;
      function Ellipse(rx, ry, ax) {
        if (!(this instanceof Ellipse)) {
          return new Ellipse(rx, ry, ax);
        }
        this.rx = rx;
        this.ry = ry;
        this.ax = ax;
      }
      Ellipse.prototype.transform = function(m) {
        var c = Math.cos(this.ax * torad), s = Math.sin(this.ax * torad);
        var ma = [
          this.rx * (m[0] * c + m[2] * s),
          this.rx * (m[1] * c + m[3] * s),
          this.ry * (-m[0] * s + m[2] * c),
          this.ry * (-m[1] * s + m[3] * c)
        ];
        var J = ma[0] * ma[0] + ma[2] * ma[2], K = ma[1] * ma[1] + ma[3] * ma[3];
        var D = ((ma[0] - ma[3]) * (ma[0] - ma[3]) + (ma[2] + ma[1]) * (ma[2] + ma[1])) * ((ma[0] + ma[3]) * (ma[0] + ma[3]) + (ma[2] - ma[1]) * (ma[2] - ma[1]));
        var JK = (J + K) / 2;
        if (D < epsilon * JK) {
          this.rx = this.ry = Math.sqrt(JK);
          this.ax = 0;
          return this;
        }
        var L = ma[0] * ma[1] + ma[2] * ma[3];
        D = Math.sqrt(D);
        var l1 = JK + D / 2, l2 = JK - D / 2;
        this.ax = Math.abs(L) < epsilon && Math.abs(l1 - K) < epsilon ? 90 : Math.atan(
          Math.abs(L) > Math.abs(l1 - K) ? (l1 - J) / L : L / (l1 - K)
        ) * 180 / Math.PI;
        if (this.ax >= 0) {
          this.rx = Math.sqrt(l1);
          this.ry = Math.sqrt(l2);
        } else {
          this.ax += 90;
          this.rx = Math.sqrt(l2);
          this.ry = Math.sqrt(l1);
        }
        return this;
      };
      Ellipse.prototype.isDegenerate = function() {
        return this.rx < epsilon * this.ry || this.ry < epsilon * this.rx;
      };
      module.exports = Ellipse;
    }
  });

  // node_modules/svgpath/lib/svgpath.js
  var require_svgpath = __commonJS({
    "node_modules/svgpath/lib/svgpath.js"(exports, module) {
      "use strict";
      var pathParse = require_path_parse();
      var transformParse = require_transform_parse();
      var matrix = require_matrix();
      var a2c = require_a2c();
      var ellipse = require_ellipse();
      function SvgPath(path) {
        if (!(this instanceof SvgPath)) {
          return new SvgPath(path);
        }
        var pstate = pathParse(path);
        this.segments = pstate.segments;
        this.err = pstate.err;
        this.__stack = [];
      }
      SvgPath.from = function(src) {
        if (typeof src === "string") return new SvgPath(src);
        if (src instanceof SvgPath) {
          var s = new SvgPath("");
          s.err = src.err;
          s.segments = src.segments.map(function(sgm) {
            return sgm.slice();
          });
          s.__stack = src.__stack.map(function(m) {
            return matrix().matrix(m.toArray());
          });
          return s;
        }
        throw new Error("SvgPath.from: invalid param type " + src);
      };
      SvgPath.prototype.__matrix = function(m) {
        var self = this, i;
        if (!m.queue.length) {
          return;
        }
        this.iterate(function(s, index, x, y) {
          var p, result, name, isRelative;
          switch (s[0]) {
            // Process 'assymetric' commands separately
            case "v":
              p = m.calc(0, s[1], true);
              result = p[0] === 0 ? ["v", p[1]] : ["l", p[0], p[1]];
              break;
            case "V":
              p = m.calc(x, s[1], false);
              result = p[0] === m.calc(x, y, false)[0] ? ["V", p[1]] : ["L", p[0], p[1]];
              break;
            case "h":
              p = m.calc(s[1], 0, true);
              result = p[1] === 0 ? ["h", p[0]] : ["l", p[0], p[1]];
              break;
            case "H":
              p = m.calc(s[1], y, false);
              result = p[1] === m.calc(x, y, false)[1] ? ["H", p[0]] : ["L", p[0], p[1]];
              break;
            case "a":
            case "A":
              var ma = m.toArray();
              var e = ellipse(s[1], s[2], s[3]).transform(ma);
              if (ma[0] * ma[3] - ma[1] * ma[2] < 0) {
                s[5] = s[5] ? "0" : "1";
              }
              p = m.calc(s[6], s[7], s[0] === "a");
              if (s[0] === "A" && s[6] === x && s[7] === y || s[0] === "a" && s[6] === 0 && s[7] === 0) {
                result = [s[0] === "a" ? "l" : "L", p[0], p[1]];
                break;
              }
              if (e.isDegenerate()) {
                result = [s[0] === "a" ? "l" : "L", p[0], p[1]];
              } else {
                result = [s[0], e.rx, e.ry, e.ax, s[4], s[5], p[0], p[1]];
              }
              break;
            case "m":
              isRelative = index > 0;
              p = m.calc(s[1], s[2], isRelative);
              result = ["m", p[0], p[1]];
              break;
            default:
              name = s[0];
              result = [name];
              isRelative = name.toLowerCase() === name;
              for (i = 1; i < s.length; i += 2) {
                p = m.calc(s[i], s[i + 1], isRelative);
                result.push(p[0], p[1]);
              }
          }
          self.segments[index] = result;
        }, true);
      };
      SvgPath.prototype.__evaluateStack = function() {
        var m, i;
        if (!this.__stack.length) {
          return;
        }
        if (this.__stack.length === 1) {
          this.__matrix(this.__stack[0]);
          this.__stack = [];
          return;
        }
        m = matrix();
        i = this.__stack.length;
        while (--i >= 0) {
          m.matrix(this.__stack[i].toArray());
        }
        this.__matrix(m);
        this.__stack = [];
      };
      SvgPath.prototype.toString = function() {
        var result = "", prevCmd = "", cmdSkipped = false;
        this.__evaluateStack();
        for (var i = 0, len = this.segments.length; i < len; i++) {
          var segment = this.segments[i];
          var cmd = segment[0];
          if (cmd !== prevCmd || cmd === "m" || cmd === "M") {
            if (cmd === "m" && prevCmd === "z") result += " ";
            result += cmd;
            cmdSkipped = false;
          } else {
            cmdSkipped = true;
          }
          for (var pos = 1; pos < segment.length; pos++) {
            var val = segment[pos];
            if (pos === 1) {
              if (cmdSkipped && val >= 0) result += " ";
            } else if (val >= 0) result += " ";
            result += val;
          }
          prevCmd = cmd;
        }
        return result;
      };
      SvgPath.prototype.translate = function(x, y) {
        this.__stack.push(matrix().translate(x, y || 0));
        return this;
      };
      SvgPath.prototype.scale = function(sx, sy) {
        this.__stack.push(matrix().scale(sx, !sy && sy !== 0 ? sx : sy));
        return this;
      };
      SvgPath.prototype.rotate = function(angle, rx, ry) {
        this.__stack.push(matrix().rotate(angle, rx || 0, ry || 0));
        return this;
      };
      SvgPath.prototype.skewX = function(degrees) {
        this.__stack.push(matrix().skewX(degrees));
        return this;
      };
      SvgPath.prototype.skewY = function(degrees) {
        this.__stack.push(matrix().skewY(degrees));
        return this;
      };
      SvgPath.prototype.matrix = function(m) {
        this.__stack.push(matrix().matrix(m));
        return this;
      };
      SvgPath.prototype.transform = function(transformString) {
        if (!transformString.trim()) {
          return this;
        }
        this.__stack.push(transformParse(transformString));
        return this;
      };
      SvgPath.prototype.round = function(d) {
        var contourStartDeltaX = 0, contourStartDeltaY = 0, deltaX = 0, deltaY = 0, l;
        d = d || 0;
        this.__evaluateStack();
        this.segments.forEach(function(s) {
          var isRelative = s[0].toLowerCase() === s[0];
          switch (s[0]) {
            case "H":
            case "h":
              if (isRelative) {
                s[1] += deltaX;
              }
              deltaX = s[1] - s[1].toFixed(d);
              s[1] = +s[1].toFixed(d);
              return;
            case "V":
            case "v":
              if (isRelative) {
                s[1] += deltaY;
              }
              deltaY = s[1] - s[1].toFixed(d);
              s[1] = +s[1].toFixed(d);
              return;
            case "Z":
            case "z":
              deltaX = contourStartDeltaX;
              deltaY = contourStartDeltaY;
              return;
            case "M":
            case "m":
              if (isRelative) {
                s[1] += deltaX;
                s[2] += deltaY;
              }
              deltaX = s[1] - s[1].toFixed(d);
              deltaY = s[2] - s[2].toFixed(d);
              contourStartDeltaX = deltaX;
              contourStartDeltaY = deltaY;
              s[1] = +s[1].toFixed(d);
              s[2] = +s[2].toFixed(d);
              return;
            case "A":
            case "a":
              if (isRelative) {
                s[6] += deltaX;
                s[7] += deltaY;
              }
              deltaX = s[6] - s[6].toFixed(d);
              deltaY = s[7] - s[7].toFixed(d);
              s[1] = +s[1].toFixed(d);
              s[2] = +s[2].toFixed(d);
              s[3] = +s[3].toFixed(d + 2);
              s[6] = +s[6].toFixed(d);
              s[7] = +s[7].toFixed(d);
              return;
            default:
              l = s.length;
              if (isRelative) {
                s[l - 2] += deltaX;
                s[l - 1] += deltaY;
              }
              deltaX = s[l - 2] - s[l - 2].toFixed(d);
              deltaY = s[l - 1] - s[l - 1].toFixed(d);
              s.forEach(function(val, i) {
                if (!i) {
                  return;
                }
                s[i] = +s[i].toFixed(d);
              });
              return;
          }
        });
        return this;
      };
      SvgPath.prototype.iterate = function(iterator, keepLazyStack) {
        var segments = this.segments, replacements = {}, needReplace = false, lastX = 0, lastY = 0, countourStartX = 0, countourStartY = 0;
        var i, j, newSegments;
        if (!keepLazyStack) {
          this.__evaluateStack();
        }
        segments.forEach(function(s, index) {
          var res = iterator(s, index, lastX, lastY);
          if (Array.isArray(res)) {
            replacements[index] = res;
            needReplace = true;
          }
          var isRelative = s[0] === s[0].toLowerCase();
          switch (s[0]) {
            case "m":
            case "M":
              lastX = s[1] + (isRelative ? lastX : 0);
              lastY = s[2] + (isRelative ? lastY : 0);
              countourStartX = lastX;
              countourStartY = lastY;
              return;
            case "h":
            case "H":
              lastX = s[1] + (isRelative ? lastX : 0);
              return;
            case "v":
            case "V":
              lastY = s[1] + (isRelative ? lastY : 0);
              return;
            case "z":
            case "Z":
              lastX = countourStartX;
              lastY = countourStartY;
              return;
            default:
              lastX = s[s.length - 2] + (isRelative ? lastX : 0);
              lastY = s[s.length - 1] + (isRelative ? lastY : 0);
          }
        });
        if (!needReplace) {
          return this;
        }
        newSegments = [];
        for (i = 0; i < segments.length; i++) {
          if (typeof replacements[i] !== "undefined") {
            for (j = 0; j < replacements[i].length; j++) {
              newSegments.push(replacements[i][j]);
            }
          } else {
            newSegments.push(segments[i]);
          }
        }
        this.segments = newSegments;
        return this;
      };
      SvgPath.prototype.abs = function() {
        this.iterate(function(s, index, x, y) {
          var name = s[0], nameUC = name.toUpperCase(), i;
          if (name === nameUC) {
            return;
          }
          s[0] = nameUC;
          switch (name) {
            case "v":
              s[1] += y;
              return;
            case "a":
              s[6] += x;
              s[7] += y;
              return;
            default:
              for (i = 1; i < s.length; i++) {
                s[i] += i % 2 ? x : y;
              }
          }
        }, true);
        return this;
      };
      SvgPath.prototype.rel = function() {
        this.iterate(function(s, index, x, y) {
          var name = s[0], nameLC = name.toLowerCase(), i;
          if (name === nameLC) {
            return;
          }
          if (index === 0 && name === "M") {
            return;
          }
          s[0] = nameLC;
          switch (name) {
            case "V":
              s[1] -= y;
              return;
            case "A":
              s[6] -= x;
              s[7] -= y;
              return;
            default:
              for (i = 1; i < s.length; i++) {
                s[i] -= i % 2 ? x : y;
              }
          }
        }, true);
        return this;
      };
      SvgPath.prototype.unarc = function() {
        this.iterate(function(s, index, x, y) {
          var new_segments, nextX, nextY, result = [], name = s[0];
          if (name !== "A" && name !== "a") {
            return null;
          }
          if (name === "a") {
            nextX = x + s[6];
            nextY = y + s[7];
          } else {
            nextX = s[6];
            nextY = s[7];
          }
          new_segments = a2c(x, y, nextX, nextY, s[4], s[5], s[1], s[2], s[3]);
          if (new_segments.length === 0) {
            return [[s[0] === "a" ? "l" : "L", s[6], s[7]]];
          }
          new_segments.forEach(function(s2) {
            result.push(["C", s2[2], s2[3], s2[4], s2[5], s2[6], s2[7]]);
          });
          return result;
        });
        return this;
      };
      SvgPath.prototype.unshort = function() {
        var segments = this.segments;
        var prevControlX, prevControlY, prevSegment;
        var curControlX, curControlY;
        this.iterate(function(s, idx, x, y) {
          var name = s[0], nameUC = name.toUpperCase(), isRelative;
          if (!idx) {
            return;
          }
          if (nameUC === "T") {
            isRelative = name === "t";
            prevSegment = segments[idx - 1];
            if (prevSegment[0] === "Q") {
              prevControlX = prevSegment[1] - x;
              prevControlY = prevSegment[2] - y;
            } else if (prevSegment[0] === "q") {
              prevControlX = prevSegment[1] - prevSegment[3];
              prevControlY = prevSegment[2] - prevSegment[4];
            } else {
              prevControlX = 0;
              prevControlY = 0;
            }
            curControlX = -prevControlX;
            curControlY = -prevControlY;
            if (!isRelative) {
              curControlX += x;
              curControlY += y;
            }
            segments[idx] = [
              isRelative ? "q" : "Q",
              curControlX,
              curControlY,
              s[1],
              s[2]
            ];
          } else if (nameUC === "S") {
            isRelative = name === "s";
            prevSegment = segments[idx - 1];
            if (prevSegment[0] === "C") {
              prevControlX = prevSegment[3] - x;
              prevControlY = prevSegment[4] - y;
            } else if (prevSegment[0] === "c") {
              prevControlX = prevSegment[3] - prevSegment[5];
              prevControlY = prevSegment[4] - prevSegment[6];
            } else {
              prevControlX = 0;
              prevControlY = 0;
            }
            curControlX = -prevControlX;
            curControlY = -prevControlY;
            if (!isRelative) {
              curControlX += x;
              curControlY += y;
            }
            segments[idx] = [
              isRelative ? "c" : "C",
              curControlX,
              curControlY,
              s[1],
              s[2],
              s[3],
              s[4]
            ];
          }
        });
        return this;
      };
      module.exports = SvgPath;
    }
  });

  // node_modules/svgpath/index.js
  var require_svgpath2 = __commonJS({
    "node_modules/svgpath/index.js"(exports, module) {
      "use strict";
      module.exports = require_svgpath();
    }
  });

  // node_modules/@xmldom/xmldom/lib/conventions.js
  var require_conventions = __commonJS({
    "node_modules/@xmldom/xmldom/lib/conventions.js"(exports) {
      "use strict";
      function find(list2, predicate, ac) {
        if (ac === void 0) {
          ac = Array.prototype;
        }
        if (list2 && typeof ac.find === "function") {
          return ac.find.call(list2, predicate);
        }
        for (var i = 0; i < list2.length; i++) {
          if (hasOwn(list2, i)) {
            var item = list2[i];
            if (predicate.call(void 0, item, i, list2)) {
              return item;
            }
          }
        }
      }
      function freeze3(object, oc) {
        if (oc === void 0) {
          oc = Object;
        }
        if (oc && typeof oc.getOwnPropertyDescriptors === "function") {
          object = oc.create(null, oc.getOwnPropertyDescriptors(object));
        }
        return oc && typeof oc.freeze === "function" ? oc.freeze(object) : object;
      }
      function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      }
      function assign(target, source) {
        if (target === null || typeof target !== "object") {
          throw new TypeError("target is not an object");
        }
        for (var key in source) {
          if (hasOwn(source, key)) {
            target[key] = source[key];
          }
        }
        return target;
      }
      var HTML_BOOLEAN_ATTRIBUTES = freeze3({
        allowfullscreen: true,
        async: true,
        autofocus: true,
        autoplay: true,
        checked: true,
        controls: true,
        default: true,
        defer: true,
        disabled: true,
        formnovalidate: true,
        hidden: true,
        ismap: true,
        itemscope: true,
        loop: true,
        multiple: true,
        muted: true,
        nomodule: true,
        novalidate: true,
        open: true,
        playsinline: true,
        readonly: true,
        required: true,
        reversed: true,
        selected: true
      });
      function isHTMLBooleanAttribute(name) {
        return hasOwn(HTML_BOOLEAN_ATTRIBUTES, name.toLowerCase());
      }
      var HTML_VOID_ELEMENTS = freeze3({
        area: true,
        base: true,
        br: true,
        col: true,
        embed: true,
        hr: true,
        img: true,
        input: true,
        link: true,
        meta: true,
        param: true,
        source: true,
        track: true,
        wbr: true
      });
      function isHTMLVoidElement(tagName) {
        return hasOwn(HTML_VOID_ELEMENTS, tagName.toLowerCase());
      }
      var HTML_RAW_TEXT_ELEMENTS = freeze3({
        script: false,
        style: false,
        textarea: true,
        title: true
      });
      function isHTMLRawTextElement(tagName) {
        var key = tagName.toLowerCase();
        return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && !HTML_RAW_TEXT_ELEMENTS[key];
      }
      function isHTMLEscapableRawTextElement(tagName) {
        var key = tagName.toLowerCase();
        return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && HTML_RAW_TEXT_ELEMENTS[key];
      }
      function isHTMLMimeType(mimeType) {
        return mimeType === MIME_TYPE.HTML;
      }
      function hasDefaultHTMLNamespace(mimeType) {
        return isHTMLMimeType(mimeType) || mimeType === MIME_TYPE.XML_XHTML_APPLICATION;
      }
      var MIME_TYPE = freeze3({
        /**
         * `text/html`, the only mime type that triggers treating an XML document as HTML.
         *
         * @see https://www.iana.org/assignments/media-types/text/html IANA MimeType registration
         * @see https://en.wikipedia.org/wiki/HTML Wikipedia
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString MDN
         * @see https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-domparser-parsefromstring
         *      WHATWG HTML Spec
         */
        HTML: "text/html",
        /**
         * `application/xml`, the standard mime type for XML documents.
         *
         * @see https://www.iana.org/assignments/media-types/application/xml IANA MimeType
         *      registration
         * @see https://tools.ietf.org/html/rfc7303#section-9.1 RFC 7303
         * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
         */
        XML_APPLICATION: "application/xml",
        /**
         * `text/xml`, an alias for `application/xml`.
         *
         * @see https://tools.ietf.org/html/rfc7303#section-9.2 RFC 7303
         * @see https://www.iana.org/assignments/media-types/text/xml IANA MimeType registration
         * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
         */
        XML_TEXT: "text/xml",
        /**
         * `application/xhtml+xml`, indicates an XML document that has the default HTML namespace,
         * but is parsed as an XML document.
         *
         * @see https://www.iana.org/assignments/media-types/application/xhtml+xml IANA MimeType
         *      registration
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument WHATWG DOM Spec
         * @see https://en.wikipedia.org/wiki/XHTML Wikipedia
         */
        XML_XHTML_APPLICATION: "application/xhtml+xml",
        /**
         * `image/svg+xml`,
         *
         * @see https://www.iana.org/assignments/media-types/image/svg+xml IANA MimeType registration
         * @see https://www.w3.org/TR/SVG11/ W3C SVG 1.1
         * @see https://en.wikipedia.org/wiki/Scalable_Vector_Graphics Wikipedia
         */
        XML_SVG_IMAGE: "image/svg+xml"
      });
      var _MIME_TYPES = Object.keys(MIME_TYPE).map(function(key) {
        return MIME_TYPE[key];
      });
      function isValidMimeType(mimeType) {
        return _MIME_TYPES.indexOf(mimeType) > -1;
      }
      var NAMESPACE = freeze3({
        /**
         * The XHTML namespace.
         *
         * @see http://www.w3.org/1999/xhtml
         */
        HTML: "http://www.w3.org/1999/xhtml",
        /**
         * The SVG namespace.
         *
         * @see http://www.w3.org/2000/svg
         */
        SVG: "http://www.w3.org/2000/svg",
        /**
         * The `xml:` namespace.
         *
         * @see http://www.w3.org/XML/1998/namespace
         */
        XML: "http://www.w3.org/XML/1998/namespace",
        /**
         * The `xmlns:` namespace.
         *
         * @see https://www.w3.org/2000/xmlns/
         */
        XMLNS: "http://www.w3.org/2000/xmlns/"
      });
      exports.assign = assign;
      exports.find = find;
      exports.freeze = freeze3;
      exports.HTML_BOOLEAN_ATTRIBUTES = HTML_BOOLEAN_ATTRIBUTES;
      exports.HTML_RAW_TEXT_ELEMENTS = HTML_RAW_TEXT_ELEMENTS;
      exports.HTML_VOID_ELEMENTS = HTML_VOID_ELEMENTS;
      exports.hasDefaultHTMLNamespace = hasDefaultHTMLNamespace;
      exports.hasOwn = hasOwn;
      exports.isHTMLBooleanAttribute = isHTMLBooleanAttribute;
      exports.isHTMLRawTextElement = isHTMLRawTextElement;
      exports.isHTMLEscapableRawTextElement = isHTMLEscapableRawTextElement;
      exports.isHTMLMimeType = isHTMLMimeType;
      exports.isHTMLVoidElement = isHTMLVoidElement;
      exports.isValidMimeType = isValidMimeType;
      exports.MIME_TYPE = MIME_TYPE;
      exports.NAMESPACE = NAMESPACE;
    }
  });

  // node_modules/@xmldom/xmldom/lib/errors.js
  var require_errors = __commonJS({
    "node_modules/@xmldom/xmldom/lib/errors.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      function extendError(constructor, writableName) {
        constructor.prototype = Object.create(Error.prototype, {
          constructor: { value: constructor },
          name: { value: constructor.name, enumerable: true, writable: writableName }
        });
      }
      var DOMExceptionName = conventions.freeze({
        /**
         * the default value as defined by the spec
         */
        Error: "Error",
        /**
         * @deprecated
         * Use RangeError instead.
         */
        IndexSizeError: "IndexSizeError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        DomstringSizeError: "DomstringSizeError",
        HierarchyRequestError: "HierarchyRequestError",
        WrongDocumentError: "WrongDocumentError",
        InvalidCharacterError: "InvalidCharacterError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        NoDataAllowedError: "NoDataAllowedError",
        NoModificationAllowedError: "NoModificationAllowedError",
        NotFoundError: "NotFoundError",
        NotSupportedError: "NotSupportedError",
        InUseAttributeError: "InUseAttributeError",
        InvalidStateError: "InvalidStateError",
        SyntaxError: "SyntaxError",
        InvalidModificationError: "InvalidModificationError",
        NamespaceError: "NamespaceError",
        /**
         * @deprecated
         * Use TypeError for invalid arguments,
         * "NotSupportedError" DOMException for unsupported operations,
         * and "NotAllowedError" DOMException for denied requests instead.
         */
        InvalidAccessError: "InvalidAccessError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        ValidationError: "ValidationError",
        /**
         * @deprecated
         * Use TypeError instead.
         */
        TypeMismatchError: "TypeMismatchError",
        SecurityError: "SecurityError",
        NetworkError: "NetworkError",
        AbortError: "AbortError",
        /**
         * @deprecated
         * Just to match the related static code, not part of the spec.
         */
        URLMismatchError: "URLMismatchError",
        QuotaExceededError: "QuotaExceededError",
        TimeoutError: "TimeoutError",
        InvalidNodeTypeError: "InvalidNodeTypeError",
        DataCloneError: "DataCloneError",
        EncodingError: "EncodingError",
        NotReadableError: "NotReadableError",
        UnknownError: "UnknownError",
        ConstraintError: "ConstraintError",
        DataError: "DataError",
        TransactionInactiveError: "TransactionInactiveError",
        ReadOnlyError: "ReadOnlyError",
        VersionError: "VersionError",
        OperationError: "OperationError",
        NotAllowedError: "NotAllowedError",
        OptOutError: "OptOutError"
      });
      var DOMExceptionNames = Object.keys(DOMExceptionName);
      function isValidDomExceptionCode(value2) {
        return typeof value2 === "number" && value2 >= 1 && value2 <= 25;
      }
      function endsWithError(value2) {
        return typeof value2 === "string" && value2.substring(value2.length - DOMExceptionName.Error.length) === DOMExceptionName.Error;
      }
      function DOMException(messageOrCode, nameOrMessage) {
        if (isValidDomExceptionCode(messageOrCode)) {
          this.name = DOMExceptionNames[messageOrCode];
          this.message = nameOrMessage || "";
        } else {
          this.message = messageOrCode;
          this.name = endsWithError(nameOrMessage) ? nameOrMessage : DOMExceptionName.Error;
        }
        if (Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
      }
      extendError(DOMException, true);
      Object.defineProperties(DOMException.prototype, {
        code: {
          enumerable: true,
          get: function() {
            var code = DOMExceptionNames.indexOf(this.name);
            if (isValidDomExceptionCode(code)) return code;
            return 0;
          }
        }
      });
      var ExceptionCode = {
        INDEX_SIZE_ERR: 1,
        DOMSTRING_SIZE_ERR: 2,
        HIERARCHY_REQUEST_ERR: 3,
        WRONG_DOCUMENT_ERR: 4,
        INVALID_CHARACTER_ERR: 5,
        NO_DATA_ALLOWED_ERR: 6,
        NO_MODIFICATION_ALLOWED_ERR: 7,
        NOT_FOUND_ERR: 8,
        NOT_SUPPORTED_ERR: 9,
        INUSE_ATTRIBUTE_ERR: 10,
        INVALID_STATE_ERR: 11,
        SYNTAX_ERR: 12,
        INVALID_MODIFICATION_ERR: 13,
        NAMESPACE_ERR: 14,
        INVALID_ACCESS_ERR: 15,
        VALIDATION_ERR: 16,
        TYPE_MISMATCH_ERR: 17,
        SECURITY_ERR: 18,
        NETWORK_ERR: 19,
        ABORT_ERR: 20,
        URL_MISMATCH_ERR: 21,
        QUOTA_EXCEEDED_ERR: 22,
        TIMEOUT_ERR: 23,
        INVALID_NODE_TYPE_ERR: 24,
        DATA_CLONE_ERR: 25
      };
      var entries = Object.entries(ExceptionCode);
      for (i = 0; i < entries.length; i++) {
        key = entries[i][0];
        DOMException[key] = entries[i][1];
      }
      var key;
      var i;
      function ParseError(message, locator, cause) {
        this.message = message;
        this.locator = locator;
        this.cause = cause;
        if (Error.captureStackTrace) Error.captureStackTrace(this, ParseError);
      }
      extendError(ParseError);
      exports.DOMException = DOMException;
      exports.DOMExceptionName = DOMExceptionName;
      exports.ExceptionCode = ExceptionCode;
      exports.ParseError = ParseError;
    }
  });

  // node_modules/@xmldom/xmldom/lib/grammar.js
  var require_grammar = __commonJS({
    "node_modules/@xmldom/xmldom/lib/grammar.js"(exports) {
      "use strict";
      function detectUnicodeSupport(RegExpImpl) {
        try {
          if (typeof RegExpImpl !== "function") {
            RegExpImpl = RegExp;
          }
          var match = new RegExpImpl("𝌆", "u").exec("𝌆");
          return !!match && match[0].length === 2;
        } catch (error) {
        }
        return false;
      }
      var UNICODE_SUPPORT = detectUnicodeSupport();
      function chars(regexp) {
        if (regexp.source[0] !== "[") {
          throw new Error(regexp + " can not be used with chars");
        }
        return regexp.source.slice(1, regexp.source.lastIndexOf("]"));
      }
      function chars_without(regexp, search) {
        if (regexp.source[0] !== "[") {
          throw new Error("/" + regexp.source + "/ can not be used with chars_without");
        }
        if (!search || typeof search !== "string") {
          throw new Error(JSON.stringify(search) + " is not a valid search");
        }
        if (regexp.source.indexOf(search) === -1) {
          throw new Error('"' + search + '" is not is /' + regexp.source + "/");
        }
        if (search === "-" && regexp.source.indexOf(search) !== 1) {
          throw new Error('"' + search + '" is not at the first postion of /' + regexp.source + "/");
        }
        return new RegExp(regexp.source.replace(search, ""), UNICODE_SUPPORT ? "u" : "");
      }
      function reg(args) {
        var self = this;
        return new RegExp(
          Array.prototype.slice.call(arguments).map(function(part) {
            var isStr = typeof part === "string";
            if (isStr && self === void 0 && part === "|") {
              throw new Error("use regg instead of reg to wrap expressions with `|`!");
            }
            return isStr ? part : part.source;
          }).join(""),
          UNICODE_SUPPORT ? "u" : ""
        );
      }
      function regg(args) {
        if (arguments.length === 0) {
          throw new Error("no parameters provided");
        }
        return reg.apply(regg, ["(?:"].concat(Array.prototype.slice.call(arguments), [")"]));
      }
      var UNICODE_REPLACEMENT_CHARACTER = "�";
      var Char = /[-\x09\x0A\x0D\x20-\x2C\x2E-\uD7FF\uE000-\uFFFD]/;
      if (UNICODE_SUPPORT) {
        Char = reg("[", chars(Char), "\\u{10000}-\\u{10FFFF}", "]");
      }
      var InvalidChar = new RegExp("[^" + chars(Char) + "]", UNICODE_SUPPORT ? "u" : "");
      var _SChar = /[\x20\x09\x0D\x0A]/;
      var SChar_s = chars(_SChar);
      var S = reg(_SChar, "+");
      var S_OPT = reg(_SChar, "*");
      var NameStartChar = /[:_a-zA-Z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      if (UNICODE_SUPPORT) {
        NameStartChar = reg("[", chars(NameStartChar), "\\u{10000}-\\u{10FFFF}", "]");
      }
      var NameStartChar_s = chars(NameStartChar);
      var NameChar = reg("[", NameStartChar_s, chars(/[-.0-9\xB7]/), chars(/[\u0300-\u036F\u203F-\u2040]/), "]");
      var Name = reg(NameStartChar, NameChar, "*");
      var Name_exact = reg("^", Name, "$");
      var Nmtoken = reg(NameChar, "+");
      var EntityRef = reg("&", Name, ";");
      var CharRef = regg(/&#[0-9]+;|&#x[0-9a-fA-F]+;/);
      var Reference = regg(EntityRef, "|", CharRef);
      var PEReference = reg("%", Name, ";");
      var EntityValue = regg(
        reg('"', regg(/[^%&"]/, "|", PEReference, "|", Reference), "*", '"'),
        "|",
        reg("'", regg(/[^%&']/, "|", PEReference, "|", Reference), "*", "'")
      );
      var AttValue = regg('"', regg(/[^<&"]/, "|", Reference), "*", '"', "|", "'", regg(/[^<&']/, "|", Reference), "*", "'");
      var NCNameStartChar = chars_without(NameStartChar, ":");
      var NCNameChar = chars_without(NameChar, ":");
      var NCName = reg(NCNameStartChar, NCNameChar, "*");
      var NCName_exact = reg("^", NCName, "$");
      var QName = reg(NCName, regg(":", NCName), "?");
      var QName_exact = reg("^", QName, "$");
      var QName_group = reg("(", QName, ")");
      var SystemLiteral = regg(/"[^"]*"|'[^']*'/);
      var PI = reg(/^<\?/, "(", Name, ")", regg(S, "(?!", _SChar, ")(", Char, "*?)"), "?", /\?>/);
      var PubidChar = /[\x20\x0D\x0Aa-zA-Z0-9-'()+,./:=?;!*#@$_%]/;
      var PubidLiteral = regg('"', PubidChar, '*"', "|", "'", chars_without(PubidChar, "'"), "*'");
      var COMMENT_START = "<!--";
      var COMMENT_END = "-->";
      var Comment = reg(COMMENT_START, regg(chars_without(Char, "-"), "|", reg("-", chars_without(Char, "-"))), "*", COMMENT_END);
      var PCDATA = "#PCDATA";
      var Mixed = regg(
        reg(/\(/, S_OPT, PCDATA, regg(S_OPT, /\|/, S_OPT, QName), "*", S_OPT, /\)\*/),
        "|",
        reg(/\(/, S_OPT, PCDATA, S_OPT, /\)/)
      );
      var _children_quantity = /[?*+]?/;
      var children = reg(
        /\([^>]+\)/,
        _children_quantity
        /*regg(choice, '|', seq), _children_quantity*/
      );
      var contentspec = regg("EMPTY", "|", "ANY", "|", Mixed, "|", children);
      var ELEMENTDECL_START = "<!ELEMENT";
      var elementdecl = reg(ELEMENTDECL_START, S, regg(QName, "|", PEReference), S, regg(contentspec, "|", PEReference), S_OPT, ">");
      var NotationType = reg("NOTATION", S, /\(/, S_OPT, Name, regg(S_OPT, /\|/, S_OPT, Name), "*", S_OPT, /\)/);
      var Enumeration = reg(/\(/, S_OPT, Nmtoken, regg(S_OPT, /\|/, S_OPT, Nmtoken), "*", S_OPT, /\)/);
      var EnumeratedType = regg(NotationType, "|", Enumeration);
      var AttType = regg(/CDATA|ID|IDREF|IDREFS|ENTITY|ENTITIES|NMTOKEN|NMTOKENS/, "|", EnumeratedType);
      var DefaultDecl = regg(/#REQUIRED|#IMPLIED/, "|", regg(regg("#FIXED", S), "?", AttValue));
      var AttDef = regg(S, Name, S, AttType, S, DefaultDecl);
      var ATTLIST_DECL_START = "<!ATTLIST";
      var AttlistDecl = reg(ATTLIST_DECL_START, S, Name, AttDef, "*", S_OPT, ">");
      var ABOUT_LEGACY_COMPAT = "about:legacy-compat";
      var ABOUT_LEGACY_COMPAT_SystemLiteral = regg('"' + ABOUT_LEGACY_COMPAT + '"', "|", "'" + ABOUT_LEGACY_COMPAT + "'");
      var SYSTEM = "SYSTEM";
      var PUBLIC = "PUBLIC";
      var ExternalID = regg(regg(SYSTEM, S, SystemLiteral), "|", regg(PUBLIC, S, PubidLiteral, S, SystemLiteral));
      var ExternalID_match = reg(
        "^",
        regg(
          regg(SYSTEM, S, "(?<SystemLiteralOnly>", SystemLiteral, ")"),
          "|",
          regg(PUBLIC, S, "(?<PubidLiteral>", PubidLiteral, ")", S, "(?<SystemLiteral>", SystemLiteral, ")")
        )
      );
      var PubidLiteral_match = reg("^", PubidLiteral, "$");
      var SystemLiteral_match = reg("^", SystemLiteral, "$");
      var NDataDecl = regg(S, "NDATA", S, Name);
      var EntityDef = regg(EntityValue, "|", regg(ExternalID, NDataDecl, "?"));
      var ENTITY_DECL_START = "<!ENTITY";
      var GEDecl = reg(ENTITY_DECL_START, S, Name, S, EntityDef, S_OPT, ">");
      var PEDef = regg(EntityValue, "|", ExternalID);
      var PEDecl = reg(ENTITY_DECL_START, S, "%", S, Name, S, PEDef, S_OPT, ">");
      var EntityDecl = regg(GEDecl, "|", PEDecl);
      var PublicID = reg(PUBLIC, S, PubidLiteral);
      var NotationDecl = reg("<!NOTATION", S, Name, S, regg(ExternalID, "|", PublicID), S_OPT, ">");
      var Eq = reg(S_OPT, "=", S_OPT);
      var VersionNum = /1[.]\d+/;
      var VersionInfo = reg(S, "version", Eq, regg("'", VersionNum, "'", "|", '"', VersionNum, '"'));
      var EncName = /[A-Za-z][-A-Za-z0-9._]*/;
      var EncodingDecl = regg(S, "encoding", Eq, regg('"', EncName, '"', "|", "'", EncName, "'"));
      var SDDecl = regg(S, "standalone", Eq, regg("'", regg("yes", "|", "no"), "'", "|", '"', regg("yes", "|", "no"), '"'));
      var XMLDecl = reg(/^<\?xml/, VersionInfo, EncodingDecl, "?", SDDecl, "?", S_OPT, /\?>/);
      var DOCTYPE_DECL_START = "<!DOCTYPE";
      var CDATA_START = "<![CDATA[";
      var CDATA_END = "]]>";
      var CDStart = /<!\[CDATA\[/;
      var CDEnd = /\]\]>/;
      var CData = reg(Char, "*?", CDEnd);
      var CDSect = reg(CDStart, CData);
      exports.chars = chars;
      exports.chars_without = chars_without;
      exports.detectUnicodeSupport = detectUnicodeSupport;
      exports.reg = reg;
      exports.regg = regg;
      exports.ABOUT_LEGACY_COMPAT = ABOUT_LEGACY_COMPAT;
      exports.ABOUT_LEGACY_COMPAT_SystemLiteral = ABOUT_LEGACY_COMPAT_SystemLiteral;
      exports.AttlistDecl = AttlistDecl;
      exports.CDATA_START = CDATA_START;
      exports.CDATA_END = CDATA_END;
      exports.CDSect = CDSect;
      exports.Char = Char;
      exports.Comment = Comment;
      exports.COMMENT_START = COMMENT_START;
      exports.COMMENT_END = COMMENT_END;
      exports.DOCTYPE_DECL_START = DOCTYPE_DECL_START;
      exports.elementdecl = elementdecl;
      exports.EntityDecl = EntityDecl;
      exports.EntityValue = EntityValue;
      exports.ExternalID = ExternalID;
      exports.ExternalID_match = ExternalID_match;
      exports.Name = Name;
      exports.Name_exact = Name_exact;
      exports.NCName_exact = NCName_exact;
      exports.NotationDecl = NotationDecl;
      exports.Reference = Reference;
      exports.PEReference = PEReference;
      exports.PI = PI;
      exports.PUBLIC = PUBLIC;
      exports.PubidLiteral = PubidLiteral;
      exports.PubidLiteral_match = PubidLiteral_match;
      exports.QName = QName;
      exports.QName_exact = QName_exact;
      exports.QName_group = QName_group;
      exports.S = S;
      exports.SChar_s = SChar_s;
      exports.S_OPT = S_OPT;
      exports.SYSTEM = SYSTEM;
      exports.SystemLiteral = SystemLiteral;
      exports.SystemLiteral_match = SystemLiteral_match;
      exports.InvalidChar = InvalidChar;
      exports.UNICODE_REPLACEMENT_CHARACTER = UNICODE_REPLACEMENT_CHARACTER;
      exports.UNICODE_SUPPORT = UNICODE_SUPPORT;
      exports.XMLDecl = XMLDecl;
    }
  });

  // node_modules/@xmldom/xmldom/lib/dom.js
  var require_dom = __commonJS({
    "node_modules/@xmldom/xmldom/lib/dom.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var find = conventions.find;
      var hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      var hasOwn = conventions.hasOwn;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isHTMLRawTextElement = conventions.isHTMLRawTextElement;
      var isHTMLVoidElement = conventions.isHTMLVoidElement;
      var MIME_TYPE = conventions.MIME_TYPE;
      var NAMESPACE = conventions.NAMESPACE;
      var PDC = /* @__PURE__ */ Symbol();
      var errors = require_errors();
      var DOMException = errors.DOMException;
      var DOMExceptionName = errors.DOMExceptionName;
      var g = require_grammar();
      function checkSymbol(symbol) {
        if (symbol !== PDC) {
          throw new TypeError("Illegal constructor");
        }
      }
      function notEmptyString(input) {
        return input !== "";
      }
      function splitOnASCIIWhitespace(input) {
        return input ? input.split(/[\t\n\f\r ]+/).filter(notEmptyString) : [];
      }
      function orderedSetReducer(current, element) {
        if (!hasOwn(current, element)) {
          current[element] = true;
        }
        return current;
      }
      function toOrderedSet(input) {
        if (!input) return [];
        var list2 = splitOnASCIIWhitespace(input);
        return Object.keys(list2.reduce(orderedSetReducer, {}));
      }
      function arrayIncludes(list2) {
        return function(element) {
          return list2 && list2.indexOf(element) !== -1;
        };
      }
      function validateQualifiedName(qualifiedName) {
        if (!g.QName_exact.test(qualifiedName)) {
          throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in qualified name "' + qualifiedName + '"');
        }
      }
      function validateAndExtract(namespace, qualifiedName) {
        validateQualifiedName(qualifiedName);
        namespace = namespace || null;
        var prefix = null;
        var localName = qualifiedName;
        if (qualifiedName.indexOf(":") >= 0) {
          var splitResult = qualifiedName.split(":");
          prefix = splitResult[0];
          localName = splitResult[1];
        }
        if (prefix !== null && namespace === null) {
          throw new DOMException(DOMException.NAMESPACE_ERR, "prefix is non-null and namespace is null");
        }
        if (prefix === "xml" && namespace !== conventions.NAMESPACE.XML) {
          throw new DOMException(DOMException.NAMESPACE_ERR, 'prefix is "xml" and namespace is not the XML namespace');
        }
        if ((prefix === "xmlns" || qualifiedName === "xmlns") && namespace !== conventions.NAMESPACE.XMLNS) {
          throw new DOMException(
            DOMException.NAMESPACE_ERR,
            'either qualifiedName or prefix is "xmlns" and namespace is not the XMLNS namespace'
          );
        }
        if (namespace === conventions.NAMESPACE.XMLNS && prefix !== "xmlns" && qualifiedName !== "xmlns") {
          throw new DOMException(
            DOMException.NAMESPACE_ERR,
            'namespace is the XMLNS namespace and neither qualifiedName nor prefix is "xmlns"'
          );
        }
        return [namespace, prefix, localName];
      }
      function copy3(src, dest) {
        for (var p in src) {
          if (hasOwn(src, p)) {
            dest[p] = src[p];
          }
        }
      }
      function _extends(Class, Super) {
        var pt2 = Class.prototype;
        if (!(pt2 instanceof Super)) {
          let t = function() {
          };
          t.prototype = Super.prototype;
          t = new t();
          copy3(pt2, t);
          Class.prototype = pt2 = t;
        }
        if (pt2.constructor != Class) {
          if (typeof Class != "function") {
            console.error("unknown Class:" + Class);
          }
          pt2.constructor = Class;
        }
      }
      var NodeType = {};
      var ELEMENT_NODE = NodeType.ELEMENT_NODE = 1;
      var ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE = 2;
      var TEXT_NODE = NodeType.TEXT_NODE = 3;
      var CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE = 4;
      var ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE = 5;
      var ENTITY_NODE = NodeType.ENTITY_NODE = 6;
      var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
      var COMMENT_NODE = NodeType.COMMENT_NODE = 8;
      var DOCUMENT_NODE = NodeType.DOCUMENT_NODE = 9;
      var DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE = 10;
      var DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE = 11;
      var NOTATION_NODE = NodeType.NOTATION_NODE = 12;
      var DocumentPosition = conventions.freeze({
        DOCUMENT_POSITION_DISCONNECTED: 1,
        DOCUMENT_POSITION_PRECEDING: 2,
        DOCUMENT_POSITION_FOLLOWING: 4,
        DOCUMENT_POSITION_CONTAINS: 8,
        DOCUMENT_POSITION_CONTAINED_BY: 16,
        DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32
      });
      function commonAncestor(a, b) {
        if (b.length < a.length) return commonAncestor(b, a);
        var c = null;
        for (var n in a) {
          if (a[n] !== b[n]) return c;
          c = a[n];
        }
        return c;
      }
      function docGUID(doc) {
        if (!doc.guid) doc.guid = Math.random();
        return doc.guid;
      }
      function NodeList() {
      }
      NodeList.prototype = {
        /**
         * The number of nodes in the list. The range of valid child node indices is 0 to length-1
         * inclusive.
         *
         * @type {number}
         */
        length: 0,
        /**
         * Returns the item at `index`. If index is greater than or equal to the number of nodes in
         * the list, this returns null.
         *
         * @param index
         * Unsigned long Index into the collection.
         * @returns {Node | null}
         * The node at position `index` in the NodeList,
         * or null if that is not a valid index.
         */
        item: function(index) {
          return index >= 0 && index < this.length ? this[index] : null;
        },
        /**
         * Returns a string representation of the NodeList.
         *
         * Accepts the same `options` object as `XMLSerializer.prototype.serializeToString`
         * (`requireWellFormed`, `splitCDATASections`, `nodeFilter`). Passing a function is treated as
         * a legacy `nodeFilter` for backward compatibility.
         *
         * @param {Object | function} [options]
         * @param {boolean} [options.requireWellFormed=false]
         * @param {boolean} [options.splitCDATASections=true]
         * @param {function} [options.nodeFilter]
         * @returns {string}
         */
        toString: function(options) {
          var opts;
          if (typeof options === "function") {
            opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
          } else if (!!options) {
            opts = {
              requireWellFormed: !!options.requireWellFormed,
              splitCDATASections: options.splitCDATASections !== false,
              nodeFilter: options.nodeFilter || null
            };
          } else {
            opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
          }
          for (var buf = [], i = 0; i < this.length; i++) {
            serializeToString(this[i], buf, null, opts);
          }
          return buf.join("");
        },
        /**
         * Filters the NodeList based on a predicate.
         *
         * @param {function(Node): boolean} predicate
         * - A predicate function to filter the NodeList.
         * @returns {Node[]}
         * An array of nodes that satisfy the predicate.
         * @private
         */
        filter: function(predicate) {
          return Array.prototype.filter.call(this, predicate);
        },
        /**
         * Returns the first index at which a given node can be found in the NodeList, or -1 if it is
         * not present.
         *
         * @param {Node} item
         * - The Node item to locate in the NodeList.
         * @returns {number}
         * The first index of the node in the NodeList; -1 if not found.
         * @private
         */
        indexOf: function(item) {
          return Array.prototype.indexOf.call(this, item);
        }
      };
      NodeList.prototype[Symbol.iterator] = function() {
        var me = this;
        var index = 0;
        return {
          next: function() {
            if (index < me.length) {
              return {
                value: me[index++],
                done: false
              };
            } else {
              return {
                done: true
              };
            }
          },
          return: function() {
            return {
              done: true
            };
          }
        };
      };
      function LiveNodeList(node, refresh) {
        this._node = node;
        this._refresh = refresh;
        _updateLiveList(this);
      }
      function _updateLiveList(list2) {
        var inc = list2._node._inc || list2._node.ownerDocument._inc;
        if (list2._inc !== inc) {
          var ls = list2._refresh(list2._node);
          __set__(list2, "length", ls.length);
          if (!list2.$$length || ls.length < list2.$$length) {
            for (var i = ls.length; i in list2; i++) {
              if (hasOwn(list2, i)) {
                delete list2[i];
              }
            }
          }
          copy3(ls, list2);
          list2._inc = inc;
        }
      }
      LiveNodeList.prototype.item = function(i) {
        _updateLiveList(this);
        return this[i] || null;
      };
      _extends(LiveNodeList, NodeList);
      function NamedNodeMap() {
        this._nsIndex = /* @__PURE__ */ Object.create(null);
        this._noNsIndex = /* @__PURE__ */ Object.create(null);
      }
      function _findNodeIndex(list2, node) {
        var i = 0;
        while (i < list2.length) {
          if (list2[i] === node) {
            return i;
          }
          i++;
        }
      }
      function _nnmBucket(map, namespaceURI, create) {
        if (!namespaceURI) {
          return map._noNsIndex;
        }
        var bucket = map._nsIndex[namespaceURI];
        if (!bucket && create) {
          bucket = map._nsIndex[namespaceURI] = /* @__PURE__ */ Object.create(null);
        }
        return bucket;
      }
      function _nnmIndexFind(map, namespaceURI, localName) {
        var bucket = _nnmBucket(map, namespaceURI, false);
        var found = bucket && bucket[localName];
        return found ? found : null;
      }
      function _nnmIndexAdd(map, attr) {
        _nnmBucket(map, attr.namespaceURI, true)[attr.localName] = attr;
      }
      function _nnmIndexRemove(map, attr) {
        var bucket = _nnmBucket(map, attr.namespaceURI, false);
        if (bucket) {
          delete bucket[attr.localName];
        }
      }
      function _addNamedNode(el, list2, newAttr, oldAttr) {
        if (oldAttr) {
          list2[_findNodeIndex(list2, oldAttr)] = newAttr;
        } else {
          list2[list2.length] = newAttr;
          list2.length++;
        }
        _nnmIndexAdd(list2, newAttr);
        if (el) {
          newAttr.ownerElement = el;
          var doc = el.ownerDocument;
          if (doc) {
            oldAttr && _onRemoveAttribute(doc, el, oldAttr);
            _onAddAttribute(doc, el, newAttr);
          }
        }
      }
      function _removeNamedNode(el, list2, attr) {
        var i = _findNodeIndex(list2, attr);
        if (i >= 0) {
          var lastIndex = list2.length - 1;
          while (i <= lastIndex) {
            list2[i] = list2[++i];
          }
          list2.length = lastIndex;
          _nnmIndexRemove(list2, attr);
          if (el) {
            var doc = el.ownerDocument;
            if (doc) {
              _onRemoveAttribute(doc, el, attr);
            }
            attr.ownerElement = null;
          }
        }
      }
      NamedNodeMap.prototype = {
        length: 0,
        item: NodeList.prototype.item,
        /**
         * Get an attribute by name. Note: Name is in lower case in case of HTML namespace and
         * document.
         *
         * @param {string} localName
         * The local name of the attribute.
         * @returns {Attr | null}
         * The attribute with the given local name, or null if no such attribute exists.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-name
         */
        getNamedItem: function(localName) {
          if (this._ownerElement && this._ownerElement._isInHTMLDocumentAndNamespace()) {
            localName = localName.toLowerCase();
          }
          var i = 0;
          while (i < this.length) {
            var attr = this[i];
            if (attr.nodeName === localName) {
              return attr;
            }
            i++;
          }
          return null;
        },
        /**
         * Set an attribute.
         *
         * @param {Attr} attr
         * The attribute to set.
         * @returns {Attr | null}
         * The old attribute with the same local name and namespace URI as the new one, or null if no
         * such attribute exists.
         * @throws {DOMException}
         * With code:
         * - {@link INUSE_ATTRIBUTE_ERR} - If the attribute is already an attribute of another
         * element.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
         */
        setNamedItem: function(attr) {
          var el = attr.ownerElement;
          if (el && el !== this._ownerElement) {
            throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
          }
          var oldAttr = _nnmIndexFind(this, attr.namespaceURI, attr.localName);
          if (oldAttr === attr) {
            return attr;
          }
          _addNamedNode(this._ownerElement, this, attr, oldAttr);
          return oldAttr;
        },
        /**
         * Set an attribute, replacing an existing attribute with the same local name and namespace
         * URI if one exists.
         *
         * @param {Attr} attr
         * The attribute to set.
         * @returns {Attr | null}
         * The old attribute with the same local name and namespace URI as the new one, or null if no
         * such attribute exists.
         * @throws {DOMException}
         * Throws a DOMException with the name "InUseAttributeError" if the attribute is already an
         * attribute of another element.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
         */
        setNamedItemNS: function(attr) {
          return this.setNamedItem(attr);
        },
        /**
         * Removes an attribute specified by the local name.
         *
         * @param {string} localName
         * The local name of the attribute to be removed.
         * @returns {Attr}
         * The attribute node that was removed.
         * @throws {DOMException}
         * With code:
         * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given name is found.
         * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditem
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-name
         */
        removeNamedItem: function(localName) {
          var attr = this.getNamedItem(localName);
          if (!attr) {
            throw new DOMException(DOMException.NOT_FOUND_ERR, localName);
          }
          _removeNamedNode(this._ownerElement, this, attr);
          return attr;
        },
        /**
         * Removes an attribute specified by the namespace and local name.
         *
         * @param {string | null} namespaceURI
         * The namespace URI of the attribute to be removed.
         * @param {string} localName
         * The local name of the attribute to be removed.
         * @returns {Attr}
         * The attribute node that was removed.
         * @throws {DOMException}
         * With code:
         * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given namespace URI and local
         * name is found.
         * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditemns
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-namespace
         */
        removeNamedItemNS: function(namespaceURI, localName) {
          var attr = this.getNamedItemNS(namespaceURI, localName);
          if (!attr) {
            throw new DOMException(DOMException.NOT_FOUND_ERR, namespaceURI ? namespaceURI + " : " + localName : localName);
          }
          _removeNamedNode(this._ownerElement, this, attr);
          return attr;
        },
        /**
         * Get an attribute by namespace and local name.
         *
         * @param {string | null} namespaceURI
         * The namespace URI of the attribute.
         * @param {string} localName
         * The local name of the attribute.
         * @returns {Attr | null}
         * The attribute with the given namespace URI and local name, or null if no such attribute
         * exists.
         * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-namespace
         */
        getNamedItemNS: function(namespaceURI, localName) {
          if (!namespaceURI) {
            namespaceURI = null;
          }
          var i = 0;
          while (i < this.length) {
            var node = this[i];
            if (node.localName === localName && node.namespaceURI === namespaceURI) {
              return node;
            }
            i++;
          }
          return null;
        }
      };
      NamedNodeMap.prototype[Symbol.iterator] = function() {
        var me = this;
        var index = 0;
        return {
          next: function() {
            if (index < me.length) {
              return {
                value: me[index++],
                done: false
              };
            } else {
              return {
                done: true
              };
            }
          },
          return: function() {
            return {
              done: true
            };
          }
        };
      };
      function DOMImplementation() {
      }
      DOMImplementation.prototype = {
        /**
         * Test if the DOM implementation implements a specific feature and version, as specified in
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/core.html#DOMFeatures DOM Features}.
         *
         * The DOMImplementation.hasFeature() method returns a Boolean flag indicating if a given
         * feature is supported. The different implementations fairly diverged in what kind of
         * features were reported. The latest version of the spec settled to force this method to
         * always return true, where the functionality was accurate and in use.
         *
         * @deprecated
         * It is deprecated and modern browsers return true in all cases.
         * @function DOMImplementation#hasFeature
         * @param {string} feature
         * The name of the feature to test.
         * @param {string} [version]
         * This is the version number of the feature to test.
         * @returns {boolean}
         * Always returns true.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/hasFeature MDN
         * @see https://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-5CED94D7 DOM Level 1 Core
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-hasfeature DOM Living Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-5CED94D7 DOM Level 3 Core
         */
        hasFeature: function(feature, version2) {
          return true;
        },
        /**
         * Creates a DOM Document object of the specified type with its document element. Note that
         * based on the {@link DocumentType}
         * given to create the document, the implementation may instantiate specialized
         * {@link Document} objects that support additional features than the "Core", such as "HTML"
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML}.
         * On the other hand, setting the {@link DocumentType} after the document was created makes
         * this very unlikely to happen. Alternatively, specialized {@link Document} creation methods,
         * such as createHTMLDocument
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML},
         * can be used to obtain specific types of {@link Document} objects.
         *
         * __It behaves slightly different from the description in the living standard__:
         * - There is no interface/class `XMLDocument`, it returns a `Document`
         * instance (with it's `type` set to `'xml'`).
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         *
         * @function DOMImplementation.createDocument
         * @param {string | null} namespaceURI
         * The
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-namespaceURI namespace URI}
         * of the document element to create or null.
         * @param {string | null} qualifiedName
         * The
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified name}
         * of the document element to be created or null.
         * @param {DocumentType | null} [doctype=null]
         * The type of document to be created or null. When doctype is not null, its
         * {@link Node#ownerDocument} attribute is set to the document being created. Default is
         * `null`
         * @returns {Document}
         * A new {@link Document} object with its document element. If the NamespaceURI,
         * qualifiedName, and doctype are null, the returned {@link Document} is empty with no
         * document element.
         * @throws {DOMException}
         * With code:
         *
         * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
         * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
         * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed, if the qualifiedName has a
         * prefix and the namespaceURI is null, or if the qualifiedName is null and the namespaceURI
         * is different from null, or if the qualifiedName has a prefix that is "xml" and the
         * namespaceURI is different from "{@link http://www.w3.org/XML/1998/namespace}"
         * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#Namespaces XML Namespaces},
         * or if the DOM implementation does not support the "XML" feature but a non-null namespace
         * URI was provided, since namespaces were defined by XML.
         * - `WRONG_DOCUMENT_ERR`: Raised if doctype has already been used with a different document
         * or was created from a different implementation.
         * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
         * "XML" and the language exposed through the Document does not support XML Namespaces (such
         * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
         * @since DOM Level 2.
         * @see {@link #createHTMLDocument}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocument MDN
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument DOM Living Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-2-Core-DOM-createDocument DOM
         *      Level 3 Core
         * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocument DOM
         *      Level 2 Core (initial)
         */
        createDocument: function(namespaceURI, qualifiedName, doctype) {
          var contentType = MIME_TYPE.XML_APPLICATION;
          if (namespaceURI === NAMESPACE.HTML) {
            contentType = MIME_TYPE.XML_XHTML_APPLICATION;
          } else if (namespaceURI === NAMESPACE.SVG) {
            contentType = MIME_TYPE.XML_SVG_IMAGE;
          }
          var doc = new Document(PDC, { contentType });
          doc.implementation = this;
          doc.childNodes = new NodeList();
          doc.doctype = doctype || null;
          if (doctype) {
            doc.appendChild(doctype);
          }
          if (qualifiedName) {
            var root = doc.createElementNS(namespaceURI, qualifiedName);
            doc.appendChild(root);
          }
          return doc;
        },
        /**
         * Creates an empty DocumentType node. Entity declarations and notations are not made
         * available. Entity reference expansions and default attribute additions do not occur.
         *
         * **This behavior is slightly different from the one in the specs**:
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         * - `publicId` and `systemId` contain the raw data including any possible quotes,
         *   so they can always be serialized back to the original value
         * - `internalSubset` contains the raw string between `[` and `]` if present,
         *   but is not parsed or validated in any form.
         *
         * @function DOMImplementation#createDocumentType
         * @param {string} qualifiedName
         * The {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified
         * name} of the document type to be created.
         * @param {string} [publicId]
         * The external subset public identifier. Stored verbatim including surrounding quotes.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value is non-empty and does not match the XML `PubidLiteral` production
         * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [12]). Creation-time validation is not
         * enforced — deferred to a future breaking release.
         * @param {string} [systemId]
         * The external subset system identifier. Stored verbatim including surrounding quotes.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value is non-empty and does not match the XML `SystemLiteral` production
         * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [11]). Creation-time validation is not
         * enforced — deferred to a future breaking release.
         * @param {string} [internalSubset]
         * The internal subset or an empty string if it is not present. Stored verbatim.
         * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         * if the value contains `"]>"`. Creation-time validation is not enforced.
         * @returns {DocumentType}
         * A new {@link DocumentType} node with {@link Node#ownerDocument} set to null.
         * @throws {DOMException}
         * With code:
         *
         * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
         * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
         * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed.
         * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
         * "XML" and the language exposed through the Document does not support XML Namespaces (such
         * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
         * @since DOM Level 2.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocumentType
         *      MDN
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocumenttype DOM Living
         *      Standard
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-3-Core-DOM-createDocType DOM
         *      Level 3 Core
         * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocType DOM
         *      Level 2 Core
         * @see https://github.com/xmldom/xmldom/blob/master/CHANGELOG.md#050
         * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-Core-DocType-internalSubset
         * @prettierignore
         */
        createDocumentType: function(qualifiedName, publicId, systemId, internalSubset) {
          validateQualifiedName(qualifiedName);
          var node = new DocumentType(PDC);
          node.name = qualifiedName;
          node.nodeName = qualifiedName;
          node.publicId = publicId || "";
          node.systemId = systemId || "";
          node.internalSubset = internalSubset || "";
          node.childNodes = new NodeList();
          return node;
        },
        /**
         * Returns an HTML document, that might already have a basic DOM structure.
         *
         * __It behaves slightly different from the description in the living standard__:
         * - If the first argument is `false` no initial nodes are added (steps 3-7 in the specs are
         * omitted)
         * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
         *
         * @param {string | false} [title]
         * A string containing the title to give the new HTML document.
         * @returns {Document}
         * The HTML document.
         * @since WHATWG Living Standard.
         * @see {@link #createDocument}
         * @see https://dom.spec.whatwg.org/#dom-domimplementation-createhtmldocument
         * @see https://dom.spec.whatwg.org/#html-document
         */
        createHTMLDocument: function(title) {
          var doc = new Document(PDC, { contentType: MIME_TYPE.HTML });
          doc.implementation = this;
          doc.childNodes = new NodeList();
          if (title !== false) {
            doc.doctype = this.createDocumentType("html");
            doc.doctype.ownerDocument = doc;
            doc.appendChild(doc.doctype);
            var htmlNode = doc.createElement("html");
            doc.appendChild(htmlNode);
            var headNode = doc.createElement("head");
            htmlNode.appendChild(headNode);
            if (typeof title === "string") {
              var titleNode = doc.createElement("title");
              titleNode.appendChild(doc.createTextNode(title));
              headNode.appendChild(titleNode);
            }
            htmlNode.appendChild(doc.createElement("body"));
          }
          return doc;
        }
      };
      function Node(symbol) {
        checkSymbol(symbol);
      }
      Node.prototype = {
        /**
         * The first child of this node.
         *
         * @type {Node | null}
         */
        firstChild: null,
        /**
         * The last child of this node.
         *
         * @type {Node | null}
         */
        lastChild: null,
        /**
         * The previous sibling of this node.
         *
         * @type {Node | null}
         */
        previousSibling: null,
        /**
         * The next sibling of this node.
         *
         * @type {Node | null}
         */
        nextSibling: null,
        /**
         * The parent node of this node.
         *
         * @type {Node | null}
         */
        parentNode: null,
        /**
         * The parent element of this node.
         *
         * @type {Element | null}
         */
        get parentElement() {
          return this.parentNode && this.parentNode.nodeType === this.ELEMENT_NODE ? this.parentNode : null;
        },
        /**
         * The child nodes of this node.
         *
         * @type {NodeList}
         */
        childNodes: null,
        /**
         * The document object associated with this node.
         *
         * @type {Document | null}
         */
        ownerDocument: null,
        /**
         * The value of this node.
         *
         * @type {string | null}
         */
        nodeValue: null,
        /**
         * The namespace URI of this node.
         *
         * @type {string | null}
         */
        namespaceURI: null,
        /**
         * The prefix of the namespace for this node.
         *
         * @type {string | null}
         */
        prefix: null,
        /**
         * The local part of the qualified name of this node.
         *
         * @type {string | null}
         */
        localName: null,
        /**
         * The baseURI is currently always `about:blank`,
         * since that's what happens when you create a document from scratch.
         *
         * @type {'about:blank'}
         */
        baseURI: "about:blank",
        /**
         * Is true if this node is part of a document.
         *
         * @type {boolean}
         */
        get isConnected() {
          var rootNode = this.getRootNode();
          return rootNode && rootNode.nodeType === rootNode.DOCUMENT_NODE;
        },
        /**
         * Checks whether `other` is an inclusive descendant of this node.
         *
         * @param {Node | null | undefined} other
         * The node to check.
         * @returns {boolean}
         * True if `other` is an inclusive descendant of this node; false otherwise.
         * @see https://dom.spec.whatwg.org/#dom-node-contains
         */
        contains: function(other) {
          if (!other) return false;
          var parent = other;
          do {
            if (this === parent) return true;
            parent = parent.parentNode;
          } while (parent);
          return false;
        },
        /**
         * @typedef GetRootNodeOptions
         * @property {boolean} [composed=false]
         */
        /**
         * Searches for the root node of this node.
         *
         * **This behavior is slightly different from the in the specs**:
         * - ignores `options.composed`, since `ShadowRoot`s are unsupported, always returns root.
         *
         * @param {GetRootNodeOptions} [options]
         * @returns {Node}
         * Root node.
         * @see https://dom.spec.whatwg.org/#dom-node-getrootnode
         * @see https://dom.spec.whatwg.org/#concept-shadow-including-root
         */
        getRootNode: function(options) {
          var parent = this;
          do {
            if (!parent.parentNode) {
              return parent;
            }
            parent = parent.parentNode;
          } while (parent);
        },
        /**
         * Checks whether the given node is equal to this node.
         *
         * Two nodes are equal when they have the same type, defining characteristics (for the type),
         * and the same childNodes. The comparison is iterative to avoid stack overflows on
         * deeply-nested trees. Attribute nodes of each Element pair are also pushed onto the stack
         * and compared the same way.
         *
         * @param {Node} [otherNode]
         * @returns {boolean}
         * @see https://dom.spec.whatwg.org/#concept-node-equals
         * @see ../docs/walk-dom.md.
         */
        isEqualNode: function(otherNode) {
          if (!otherNode) return false;
          var stack = [{ node: this, other: otherNode }];
          while (stack.length > 0) {
            var pair = stack.pop();
            var node = pair.node;
            var other = pair.other;
            if (node.nodeType !== other.nodeType) return false;
            switch (node.nodeType) {
              case node.DOCUMENT_TYPE_NODE:
                if (node.name !== other.name) return false;
                if (node.publicId !== other.publicId) return false;
                if (node.systemId !== other.systemId) return false;
                break;
              case node.ELEMENT_NODE:
                if (node.namespaceURI !== other.namespaceURI) return false;
                if (node.prefix !== other.prefix) return false;
                if (node.localName !== other.localName) return false;
                if (node.attributes.length !== other.attributes.length) return false;
                for (var i = 0; i < node.attributes.length; i++) {
                  var attr = node.attributes.item(i);
                  var otherAttr = other.getAttributeNodeNS(attr.namespaceURI, attr.localName);
                  if (!otherAttr) return false;
                  stack.push({ node: attr, other: otherAttr });
                }
                break;
              case node.ATTRIBUTE_NODE:
                if (node.namespaceURI !== other.namespaceURI) return false;
                if (node.localName !== other.localName) return false;
                if (node.value !== other.value) return false;
                break;
              case node.PROCESSING_INSTRUCTION_NODE:
                if (node.target !== other.target || node.data !== other.data) return false;
                break;
              case node.TEXT_NODE:
              case node.CDATA_SECTION_NODE:
              case node.COMMENT_NODE:
                if (node.data !== other.data) return false;
                break;
            }
            if (node.childNodes.length !== other.childNodes.length) return false;
            for (var i = node.childNodes.length - 1; i >= 0; i--) {
              stack.push({ node: node.childNodes[i], other: other.childNodes[i] });
            }
          }
          return true;
        },
        /**
         * Checks whether or not the given node is this node.
         *
         * @param {Node} [otherNode]
         */
        isSameNode: function(otherNode) {
          return this === otherNode;
        },
        /**
         * Inserts a node before a reference node as a child of this node.
         *
         * @param {Node} newChild
         * The new child node to be inserted.
         * @param {Node | null} refChild
         * The reference node before which newChild will be inserted.
         * @returns {Node}
         * The new child node successfully inserted.
         * @throws {DOMException}
         * Throws a DOMException if inserting the node would result in a DOM tree that is not
         * well-formed, or if `child` is provided but is not a child of `parent`.
         * See {@link _insertBefore} for more details.
         * @since Modified in DOM L2
         */
        insertBefore: function(newChild, refChild) {
          return _insertBefore(this, newChild, refChild);
        },
        /**
         * Replaces an old child node with a new child node within this node.
         *
         * @param {Node} newChild
         * The new node that is to replace the old node.
         * If it already exists in the DOM, it is removed from its original position.
         * @param {Node} oldChild
         * The existing child node to be replaced.
         * @returns {Node}
         * Returns the replaced child node.
         * @throws {DOMException}
         * Throws a DOMException if replacing the node would result in a DOM tree that is not
         * well-formed, or if `oldChild` is not a child of `this`.
         * This can also occur if the pre-replacement validity assertion fails.
         * See {@link _insertBefore}, {@link Node.removeChild}, and
         * {@link assertPreReplacementValidityInDocument} for more details.
         * @see https://dom.spec.whatwg.org/#concept-node-replace
         */
        replaceChild: function(newChild, oldChild) {
          _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
          if (oldChild) {
            this.removeChild(oldChild);
          }
        },
        /**
         * Removes an existing child node from this node.
         *
         * @param {Node} oldChild
         * The child node to be removed.
         * @returns {Node}
         * Returns the removed child node.
         * @throws {DOMException}
         * Throws a DOMException if `oldChild` is not a child of `this`.
         * See {@link _removeChild} for more details.
         */
        removeChild: function(oldChild) {
          return _removeChild(this, oldChild);
        },
        /**
         * Appends a child node to this node.
         *
         * @param {Node} newChild
         * The child node to be appended to this node.
         * If it already exists in the DOM, it is removed from its original position.
         * @returns {Node}
         * Returns the appended child node.
         * @throws {DOMException}
         * Throws a DOMException if appending the node would result in a DOM tree that is not
         * well-formed, or if `newChild` is not a valid Node.
         * See {@link insertBefore} for more details.
         */
        appendChild: function(newChild) {
          return this.insertBefore(newChild, null);
        },
        /**
         * Determines whether this node has any child nodes.
         *
         * @returns {boolean}
         * Returns true if this node has any child nodes, and false otherwise.
         */
        hasChildNodes: function() {
          return this.firstChild != null;
        },
        /**
         * Creates a copy of the calling node.
         *
         * @param {boolean} deep
         * If true, the contents of the node are recursively copied.
         * If false, only the node itself (and its attributes, if it is an element) are copied.
         * @returns {Node}
         * Returns the newly created copy of the node.
         * @throws {DOMException}
         * May throw a DOMException if operations within {@link Element#setAttributeNode} or
         * {@link Node#appendChild} (which are potentially invoked in this method) do not meet their
         * specific constraints.
         * @see {@link cloneNode}
         */
        cloneNode: function(deep) {
          return cloneNode(this.ownerDocument || this, this, deep);
        },
        /**
         * Puts the specified node and all of its subtree into a "normalized" form. In a normalized
         * subtree, no text nodes in the subtree are empty and there are no adjacent text nodes.
         *
         * Specifically, this method merges any adjacent text nodes (i.e., nodes for which `nodeType`
         * is `TEXT_NODE`) into a single node with the combined data. It also removes any empty text
         * nodes.
         *
         * This method iterativly traverses all child nodes to normalize all descendent nodes within
         * the subtree.
         *
         * @throws {DOMException}
         * May throw a DOMException if operations within removeChild or appendData (which are
         * potentially invoked in this method) do not meet their specific constraints.
         * @since Modified in DOM Level 2
         * @see {@link Node.removeChild}
         * @see {@link CharacterData.appendData}
         * @see ../docs/walk-dom.md.
         */
        normalize: function() {
          walkDOM(this, null, {
            enter: function(node) {
              var child2 = node.firstChild;
              while (child2) {
                var next = child2.nextSibling;
                if (next !== null && next.nodeType === TEXT_NODE && child2.nodeType === TEXT_NODE) {
                  var tail = [];
                  var sibling = next;
                  while (sibling !== null && sibling.nodeType === TEXT_NODE) {
                    tail.push(sibling.data);
                    sibling = sibling.nextSibling;
                  }
                  var removed = child2.nextSibling;
                  while (removed !== sibling) {
                    var following = removed.nextSibling;
                    removed.parentNode = null;
                    removed.previousSibling = null;
                    removed.nextSibling = null;
                    removed = following;
                  }
                  child2.nextSibling = sibling;
                  if (sibling !== null) {
                    sibling.previousSibling = child2;
                  } else {
                    node.lastChild = child2;
                  }
                  child2.appendData(tail.join(""));
                  _onUpdateChild(node.ownerDocument, node);
                  child2 = sibling;
                } else {
                  child2 = next;
                }
              }
              return true;
            }
          });
        },
        /**
         * Checks whether the DOM implementation implements a specific feature and its version.
         *
         * @deprecated
         * Since `DOMImplementation.hasFeature` is deprecated and always returns true.
         * @param {string} feature
         * The package name of the feature to test. This is the same name that can be passed to the
         * method `hasFeature` on `DOMImplementation`.
         * @param {string} version
         * This is the version number of the package name to test.
         * @returns {boolean}
         * Returns true in all cases in the current implementation.
         * @since Introduced in DOM Level 2
         * @see {@link DOMImplementation.hasFeature}
         */
        isSupported: function(feature, version2) {
          return this.ownerDocument.implementation.hasFeature(feature, version2);
        },
        /**
         * Look up the prefix associated to the given namespace URI, starting from this node.
         * **The default namespace declarations are ignored by this method.**
         * See Namespace Prefix Lookup for details on the algorithm used by this method.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} namespaceURI
         * The namespace URI for which to find the associated prefix.
         * @returns {string | null}
         * The associated prefix, if found; otherwise, null.
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespacePrefix
         * @see https://www.w3.org/TR/DOM-Level-3-Core/namespaces-algorithms.html#lookupNamespacePrefixAlgo
         * @see https://dom.spec.whatwg.org/#dom-node-lookupprefix
         * @see https://github.com/xmldom/xmldom/issues/322
         * @prettierignore
         */
        lookupPrefix: function(namespaceURI) {
          var el = this;
          while (el) {
            var map = el._nsMap;
            if (map) {
              for (var n in map) {
                if (hasOwn(map, n) && map[n] === namespaceURI) {
                  return n;
                }
              }
            }
            el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
          }
          return null;
        },
        /**
         * This function is used to look up the namespace URI associated with the given prefix,
         * starting from this node.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} prefix
         * The prefix for which to find the associated namespace URI.
         * @returns {string | null}
         * The associated namespace URI, if found; otherwise, null.
         * @since DOM Level 3
         * @see https://dom.spec.whatwg.org/#dom-node-lookupnamespaceuri
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespaceURI
         * @prettierignore
         */
        lookupNamespaceURI: function(prefix) {
          var el = this;
          while (el) {
            var map = el._nsMap;
            if (map) {
              if (hasOwn(map, prefix)) {
                return map[prefix];
              }
            }
            el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
          }
          return null;
        },
        /**
         * Determines whether the given namespace URI is the default namespace.
         *
         * The function works by looking up the prefix associated with the given namespace URI. If no
         * prefix is found (i.e., the namespace URI is not registered in the namespace map of this
         * node or any of its ancestors), it returns `true`, implying the namespace URI is considered
         * the default.
         *
         * **This behavior is different from the in the specs**:
         * - no node type specific handling
         * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
         *
         * @param {string | null} namespaceURI
         * The namespace URI to be checked.
         * @returns {boolean}
         * Returns true if the given namespace URI is the default namespace, false otherwise.
         * @since DOM Level 3
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-isDefaultNamespace
         * @see https://dom.spec.whatwg.org/#dom-node-isdefaultnamespace
         * @prettierignore
         */
        isDefaultNamespace: function(namespaceURI) {
          var prefix = this.lookupPrefix(namespaceURI);
          return prefix == null;
        },
        /**
         * Compares the reference node with a node with regard to their position in the document and
         * according to the document order.
         *
         * @param {Node} other
         * The node to compare the reference node to.
         * @returns {number}
         * Returns how the node is positioned relatively to the reference node according to the
         * bitmask. 0 if reference node and given node are the same.
         * @since DOM Level 3
         * @see https://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/core.html#Node3-compare
         * @see https://dom.spec.whatwg.org/#dom-node-comparedocumentposition
         */
        compareDocumentPosition: function(other) {
          if (this === other) return 0;
          var node1 = other;
          var node2 = this;
          var attr1 = null;
          var attr2 = null;
          if (node1 instanceof Attr) {
            attr1 = node1;
            node1 = attr1.ownerElement;
          }
          if (node2 instanceof Attr) {
            attr2 = node2;
            node2 = attr2.ownerElement;
            if (attr1 && node1 && node2 === node1) {
              for (var i = 0, attr; attr = node2.attributes[i]; i++) {
                if (attr === attr1)
                  return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
                if (attr === attr2)
                  return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
              }
            }
          }
          if (!node1 || !node2 || node2.ownerDocument !== node1.ownerDocument) {
            return DocumentPosition.DOCUMENT_POSITION_DISCONNECTED + DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + (docGUID(node2.ownerDocument) > docGUID(node1.ownerDocument) ? DocumentPosition.DOCUMENT_POSITION_FOLLOWING : DocumentPosition.DOCUMENT_POSITION_PRECEDING);
          }
          if (attr2 && node1 === node2) {
            return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
          }
          if (attr1 && node1 === node2) {
            return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
          }
          var chain1 = [];
          var ancestor1 = node1.parentNode;
          while (ancestor1) {
            if (!attr2 && ancestor1 === node2) {
              return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            }
            chain1.push(ancestor1);
            ancestor1 = ancestor1.parentNode;
          }
          chain1.reverse();
          var chain2 = [];
          var ancestor2 = node2.parentNode;
          while (ancestor2) {
            if (!attr1 && ancestor2 === node1) {
              return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
            }
            chain2.push(ancestor2);
            ancestor2 = ancestor2.parentNode;
          }
          chain2.reverse();
          var ca = commonAncestor(chain1, chain2);
          for (var n in ca.childNodes) {
            var child2 = ca.childNodes[n];
            if (child2 === node2) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            if (child2 === node1) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
            if (chain2.indexOf(child2) >= 0) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
            if (chain1.indexOf(child2) >= 0) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
          }
          return 0;
        }
      };
      function _xmlEncoder(c) {
        return c == "<" && "&lt;" || c == ">" && "&gt;" || c == "&" && "&amp;" || c == '"' && "&quot;" || "&#" + c.charCodeAt() + ";";
      }
      copy3(NodeType, Node);
      copy3(NodeType, Node.prototype);
      copy3(DocumentPosition, Node);
      copy3(DocumentPosition, Node.prototype);
      function _visitNode(node, callback) {
        walkDOM(node, null, {
          enter: function(n) {
            return callback(n) ? walkDOM.STOP : true;
          }
        });
      }
      function walkDOM(node, context, callbacks) {
        var stack = [{ node, context, phase: walkDOM.ENTER }];
        while (stack.length > 0) {
          var frame = stack.pop();
          if (frame.phase === walkDOM.ENTER) {
            var childContext = callbacks.enter(frame.node, frame.context);
            if (childContext === walkDOM.STOP) {
              return walkDOM.STOP;
            }
            stack.push({ node: frame.node, context: childContext, phase: walkDOM.EXIT });
            if (childContext === null || childContext === void 0) {
              continue;
            }
            var child2 = frame.node.lastChild;
            while (child2) {
              stack.push({ node: child2, context: childContext, phase: walkDOM.ENTER });
              child2 = child2.previousSibling;
            }
          } else {
            if (callbacks.exit) {
              callbacks.exit(frame.node, frame.context);
            }
          }
        }
      }
      walkDOM.STOP = /* @__PURE__ */ Symbol("walkDOM.STOP");
      walkDOM.ENTER = 0;
      walkDOM.EXIT = 1;
      function Document(symbol, options) {
        checkSymbol(symbol);
        var opt = options || {};
        this.ownerDocument = this;
        this.contentType = opt.contentType || MIME_TYPE.XML_APPLICATION;
        this.type = isHTMLMimeType(this.contentType) ? "html" : "xml";
      }
      function _onAddAttribute(doc, el, newAttr) {
        doc && doc._inc++;
        var ns = newAttr.namespaceURI;
        if (ns === NAMESPACE.XMLNS) {
          el._nsMap[newAttr.prefix ? newAttr.localName : ""] = newAttr.value;
        }
      }
      function _onRemoveAttribute(doc, el, newAttr, remove) {
        doc && doc._inc++;
        var ns = newAttr.namespaceURI;
        if (ns === NAMESPACE.XMLNS) {
          delete el._nsMap[newAttr.prefix ? newAttr.localName : ""];
        }
      }
      function _onUpdateChild(doc, parent, newChild) {
        if (doc && doc._inc) {
          doc._inc++;
          var childNodes = parent.childNodes;
          if (newChild && !newChild.nextSibling) {
            childNodes[childNodes.length++] = newChild;
          } else {
            var child2 = parent.firstChild;
            var i = 0;
            while (child2) {
              childNodes[i++] = child2;
              child2 = child2.nextSibling;
            }
            childNodes.length = i;
            delete childNodes[childNodes.length];
          }
        }
      }
      function _removeChild(parentNode, child2) {
        if (parentNode !== child2.parentNode) {
          throw new DOMException(DOMException.NOT_FOUND_ERR, "child's parent is not parent");
        }
        var oldPreviousSibling = child2.previousSibling;
        var oldNextSibling = child2.nextSibling;
        if (oldPreviousSibling) {
          oldPreviousSibling.nextSibling = oldNextSibling;
        } else {
          parentNode.firstChild = oldNextSibling;
        }
        if (oldNextSibling) {
          oldNextSibling.previousSibling = oldPreviousSibling;
        } else {
          parentNode.lastChild = oldPreviousSibling;
        }
        _onUpdateChild(parentNode.ownerDocument, parentNode);
        child2.parentNode = null;
        child2.previousSibling = null;
        child2.nextSibling = null;
        return child2;
      }
      function hasValidParentNodeType(node) {
        return node && (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.ELEMENT_NODE);
      }
      function hasInsertableNodeType(node) {
        return node && (node.nodeType === Node.CDATA_SECTION_NODE || node.nodeType === Node.COMMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_TYPE_NODE || node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE || node.nodeType === Node.TEXT_NODE);
      }
      function isDocTypeNode(node) {
        return node && node.nodeType === Node.DOCUMENT_TYPE_NODE;
      }
      function isElementNode(node) {
        return node && node.nodeType === Node.ELEMENT_NODE;
      }
      function isTextNode(node) {
        return node && node.nodeType === Node.TEXT_NODE;
      }
      function isElementInsertionPossible(doc, child2) {
        var parentChildNodes = doc.childNodes || [];
        if (find(parentChildNodes, isElementNode) || isDocTypeNode(child2)) {
          return false;
        }
        var docTypeNode = find(parentChildNodes, isDocTypeNode);
        return !(child2 && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child2));
      }
      function isElementReplacementPossible(doc, child2) {
        var parentChildNodes = doc.childNodes || [];
        function hasElementChildThatIsNotChild(node) {
          return isElementNode(node) && node !== child2;
        }
        if (find(parentChildNodes, hasElementChildThatIsNotChild)) {
          return false;
        }
        var docTypeNode = find(parentChildNodes, isDocTypeNode);
        return !(child2 && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child2));
      }
      function assertPreInsertionValidity1to5(parent, node, child2) {
        if (!hasValidParentNodeType(parent)) {
          throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Unexpected parent node type " + parent.nodeType);
        }
        if (child2 && child2.parentNode !== parent) {
          throw new DOMException(DOMException.NOT_FOUND_ERR, "child not in parent");
        }
        if (
          // 4. If `node` is not a DocumentFragment, DocumentType, Element, or CharacterData node, then throw a "HierarchyRequestError" DOMException.
          !hasInsertableNodeType(node) || // 5. If either `node` is a Text node and `parent` is a document,
          // the sax parser currently adds top level text nodes, this will be fixed in 0.9.0
          // || (node.nodeType === Node.TEXT_NODE && parent.nodeType === Node.DOCUMENT_NODE)
          // or `node` is a doctype and `parent` is not a document, then throw a "HierarchyRequestError" DOMException.
          isDocTypeNode(node) && parent.nodeType !== Node.DOCUMENT_NODE
        ) {
          throw new DOMException(
            DOMException.HIERARCHY_REQUEST_ERR,
            "Unexpected node type " + node.nodeType + " for parent node type " + parent.nodeType
          );
        }
      }
      function assertPreInsertionValidityInDocument(parent, node, child2) {
        var parentChildNodes = parent.childNodes || [];
        var nodeChildNodes = node.childNodes || [];
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var nodeChildElements = nodeChildNodes.filter(isElementNode);
          if (nodeChildElements.length > 1 || find(nodeChildNodes, isTextNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
          }
          if (nodeChildElements.length === 1 && !isElementInsertionPossible(parent, child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
          }
        }
        if (isElementNode(node)) {
          if (!isElementInsertionPossible(parent, child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
          }
        }
        if (isDocTypeNode(node)) {
          if (find(parentChildNodes, isDocTypeNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
          }
          var parentElementChild = find(parentChildNodes, isElementNode);
          if (child2 && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
          }
          if (!child2 && parentElementChild) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can not be appended since element is present");
          }
        }
      }
      function assertPreReplacementValidityInDocument(parent, node, child2) {
        var parentChildNodes = parent.childNodes || [];
        var nodeChildNodes = node.childNodes || [];
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var nodeChildElements = nodeChildNodes.filter(isElementNode);
          if (nodeChildElements.length > 1 || find(nodeChildNodes, isTextNode)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
          }
          if (nodeChildElements.length === 1 && !isElementReplacementPossible(parent, child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
          }
        }
        if (isElementNode(node)) {
          if (!isElementReplacementPossible(parent, child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
          }
        }
        if (isDocTypeNode(node)) {
          let hasDoctypeChildThatIsNotChild = function(node2) {
            return isDocTypeNode(node2) && node2 !== child2;
          };
          if (find(parentChildNodes, hasDoctypeChildThatIsNotChild)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
          }
          var parentElementChild = find(parentChildNodes, isElementNode);
          if (child2 && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child2)) {
            throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
          }
        }
      }
      function _insertBefore(parent, node, child2, _inDocumentAssertion) {
        assertPreInsertionValidity1to5(parent, node, child2);
        if (parent.nodeType === Node.DOCUMENT_NODE) {
          (_inDocumentAssertion || assertPreInsertionValidityInDocument)(parent, node, child2);
        }
        var cp = node.parentNode;
        if (cp) {
          cp.removeChild(node);
        }
        if (node.nodeType === DOCUMENT_FRAGMENT_NODE) {
          var newFirst = node.firstChild;
          if (newFirst == null) {
            return node;
          }
          var newLast = node.lastChild;
        } else {
          newFirst = newLast = node;
        }
        var pre = child2 ? child2.previousSibling : parent.lastChild;
        newFirst.previousSibling = pre;
        newLast.nextSibling = child2;
        if (pre) {
          pre.nextSibling = newFirst;
        } else {
          parent.firstChild = newFirst;
        }
        if (child2 == null) {
          parent.lastChild = newLast;
        } else {
          child2.previousSibling = newLast;
        }
        do {
          newFirst.parentNode = parent;
        } while (newFirst !== newLast && (newFirst = newFirst.nextSibling));
        _onUpdateChild(parent.ownerDocument || parent, parent, node);
        if (node.nodeType == DOCUMENT_FRAGMENT_NODE) {
          node.firstChild = node.lastChild = null;
        }
        return node;
      }
      Document.prototype = {
        /**
         * The implementation that created this document.
         *
         * @type DOMImplementation
         * @readonly
         */
        implementation: null,
        nodeName: "#document",
        nodeType: DOCUMENT_NODE,
        /**
         * The DocumentType node of the document.
         *
         * @type DocumentType
         * @readonly
         */
        doctype: null,
        documentElement: null,
        _inc: 1,
        insertBefore: function(newChild, refChild) {
          if (newChild.nodeType === DOCUMENT_FRAGMENT_NODE) {
            var child2 = newChild.firstChild;
            while (child2) {
              var next = child2.nextSibling;
              this.insertBefore(child2, refChild);
              child2 = next;
            }
            return newChild;
          }
          _insertBefore(this, newChild, refChild);
          newChild.ownerDocument = this;
          if (this.documentElement === null && newChild.nodeType === ELEMENT_NODE) {
            this.documentElement = newChild;
          }
          return newChild;
        },
        removeChild: function(oldChild) {
          var removed = _removeChild(this, oldChild);
          if (removed === this.documentElement) {
            this.documentElement = null;
          }
          return removed;
        },
        replaceChild: function(newChild, oldChild) {
          _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
          newChild.ownerDocument = this;
          if (oldChild) {
            this.removeChild(oldChild);
          }
          if (isElementNode(newChild)) {
            this.documentElement = newChild;
          }
        },
        /**
         * Imports a node from another document into this document, creating a new copy owned by this
         * document. The source node and its subtree are not modified.
         *
         * @param {Node} importedNode
         * The node to import.
         * @param {boolean} deep
         * If true, the contents of the node are recursively imported.
         * If false, only the node itself (and its attributes, if it is an element) are imported.
         * @returns {Node}
         * Returns the newly created import of the node.
         * @see {@link importNode}
         * @see {@link https://dom.spec.whatwg.org/#dom-document-importnode}
         */
        importNode: function(importedNode, deep) {
          return importNode(this, importedNode, deep);
        },
        // Introduced in DOM Level 2:
        getElementById: function(id) {
          var rtv = null;
          _visitNode(this.documentElement, function(node) {
            if (node.nodeType == ELEMENT_NODE) {
              if (node.getAttribute("id") == id) {
                rtv = node;
                return true;
              }
            }
          });
          return rtv;
        },
        /**
         * Creates a new `Element` that is owned by this `Document`.
         * In HTML Documents `localName` is the lower cased `tagName`,
         * otherwise no transformation is being applied.
         * When `contentType` implies the HTML namespace, it will be set as `namespaceURI`.
         *
         * __This implementation differs from the specification:__ - The provided name is not checked
         * against the `Name` production,
         * so no related error will be thrown.
         * - There is no interface `HTMLElement`, it is always an `Element`.
         * - There is no support for a second argument to indicate using custom elements.
         *
         * @param {string} tagName
         * @returns {Element}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
         * @see https://dom.spec.whatwg.org/#dom-document-createelement
         * @see https://dom.spec.whatwg.org/#concept-create-element
         */
        createElement: function(tagName) {
          var node = new Element(PDC);
          node.ownerDocument = this;
          if (this.type === "html") {
            tagName = tagName.toLowerCase();
          }
          if (hasDefaultHTMLNamespace(this.contentType)) {
            node.namespaceURI = NAMESPACE.HTML;
          }
          node.nodeName = tagName;
          node.tagName = tagName;
          node.localName = tagName;
          node.childNodes = new NodeList();
          var attrs = node.attributes = new NamedNodeMap();
          attrs._ownerElement = node;
          return node;
        },
        /**
         * @returns {DocumentFragment}
         */
        createDocumentFragment: function() {
          var node = new DocumentFragment(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          return node;
        },
        /**
         * @param {string} data
         * @returns {Text}
         */
        createTextNode: function(data) {
          var node = new Text(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * @param {string} data
         * @returns {Comment}
         * @see https://dom.spec.whatwg.org/#dom-document-createcomment
         * @see https://www.w3.org/TR/xml/#NT-Comment XML 1.0 production [15]
         * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.3
         *
         *      Note: no validation is performed at creation time. When the resulting document is
         *      serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
         *      if the comment data contains `--` anywhere, ends with `-`, or contains characters
         *      outside the XML Char production (W3C DOM Parsing §3.2.1.3). Without that option the
         *      data is emitted verbatim.
         */
        createComment: function(data) {
          var node = new Comment(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * Returns a new CDATASection node whose data is `data`.
         *
         * __This implementation differs from the specification:__ - calling this method on an HTML
         * document does not throw `NotSupportedError`.
         *
         * @param {string} data
         * @returns {CDATASection}
         * @throws {DOMException}
         * With code `INVALID_CHARACTER_ERR` if `data` contains `"]]>"`.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createCDATASection
         * @see https://dom.spec.whatwg.org/#dom-document-createcdatasection
         */
        createCDATASection: function(data) {
          if (data.indexOf("]]>") !== -1) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'data contains "]]>"');
          }
          var node = new CDATASection(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.appendData(data);
          return node;
        },
        /**
         * Returns a ProcessingInstruction node whose target is target and data is data.
         *
         * __This behavior is slightly different from the in the specs__:
         * - it does not do any input validation on the arguments and doesn't throw
         * "InvalidCharacterError".
         *
         * Note: When the resulting document is serialized with `requireWellFormed: true`, the
         * serializer throws `InvalidStateError` if `.target` is not a valid XML `NCName` (a `Name`
         * with no colon) or is an ASCII case-insensitive match for `"xml"`, or if `.data` contains
         * `?>` or characters outside the XML Char production (W3C DOM Parsing §3.2.1.7). Without that
         * option the target and data are emitted verbatim.
         *
         * @param {string} target
         * @param {string} data
         * @returns {ProcessingInstruction}
         * @see https://developer.mozilla.org/docs/Web/API/Document/createProcessingInstruction
         * @see https://dom.spec.whatwg.org/#dom-document-createprocessinginstruction
         * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.7
         */
        createProcessingInstruction: function(target, data) {
          var node = new ProcessingInstruction(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = node.target = target;
          node.nodeValue = node.data = data;
          return node;
        },
        /**
         * Creates an `Attr` node that is owned by this document.
         * In HTML Documents `localName` is the lower cased `name`,
         * otherwise no transformation is being applied.
         *
         * __This implementation differs from the specification:__ - The provided name is not checked
         * against the `Name` production,
         * so no related error will be thrown.
         *
         * @param {string} name
         * @returns {Attr}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createAttribute
         * @see https://dom.spec.whatwg.org/#dom-document-createattribute
         */
        createAttribute: function(name) {
          if (!g.QName_exact.test(name)) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in name "' + name + '"');
          }
          if (this.type === "html") {
            name = name.toLowerCase();
          }
          return this._createAttribute(name);
        },
        _createAttribute: function(name) {
          var node = new Attr(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.name = name;
          node.nodeName = name;
          node.localName = name;
          node.specified = true;
          return node;
        },
        /**
         * Creates an EntityReference object.
         * The current implementation does not fill the `childNodes` with those of the corresponding
         * `Entity`
         *
         * The `name` is validated against the XML `Name` production at creation time; an invalid name
         * throws `InvalidCharacterError`. When the resulting node is serialized with
         * `requireWellFormed: true`, the serializer re-validates `nodeName` against the XML `Name`
         * production and throws `InvalidStateError` if a later `nodeName` mutation made it invalid;
         * without that option the name is emitted verbatim.
         *
         * __This implementation differs from the specification:__ xmldom does not expand entities —
         * the parser resolves entity references inline and never constructs `EntityReference` nodes,
         * so this method is the only producer.
         *
         * @deprecated
         * In DOM Level 4.
         * @param {string} name
         * The name of the entity to reference. No namespace well-formedness checks are performed.
         * @returns {EntityReference}
         * @throws {DOMException}
         * With code `INVALID_CHARACTER_ERR` when `name` is not a valid XML `Name`.
         * @throws {DOMException}
         * with code `NOT_SUPPORTED_ERR` when the document is of type `html`
         * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-392B75AE
         */
        createEntityReference: function(name) {
          if (!g.Name_exact.test(name)) {
            throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'not a valid xml name "' + name + '"');
          }
          if (this.type === "html") {
            throw new DOMException("document is an html document", DOMExceptionName.NotSupportedError);
          }
          var node = new EntityReference(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = name;
          return node;
        },
        // Introduced in DOM Level 2:
        /**
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @returns {Element}
         */
        createElementNS: function(namespaceURI, qualifiedName) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var node = new Element(PDC);
          var attrs = node.attributes = new NamedNodeMap();
          node.childNodes = new NodeList();
          node.ownerDocument = this;
          node.nodeName = qualifiedName;
          node.tagName = qualifiedName;
          node.namespaceURI = validated[0];
          node.prefix = validated[1];
          node.localName = validated[2];
          attrs._ownerElement = node;
          return node;
        },
        // Introduced in DOM Level 2:
        /**
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @returns {Attr}
         */
        createAttributeNS: function(namespaceURI, qualifiedName) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var node = new Attr(PDC);
          node.ownerDocument = this;
          node.childNodes = new NodeList();
          node.nodeName = qualifiedName;
          node.name = qualifiedName;
          node.specified = true;
          node.namespaceURI = validated[0];
          node.prefix = validated[1];
          node.localName = validated[2];
          return node;
        }
      };
      _extends(Document, Node);
      function Element(symbol) {
        checkSymbol(symbol);
        this._nsMap = /* @__PURE__ */ Object.create(null);
      }
      Element.prototype = {
        nodeType: ELEMENT_NODE,
        /**
         * The attributes of this element.
         *
         * @type {NamedNodeMap | null}
         */
        attributes: null,
        getQualifiedName: function() {
          return this.prefix ? this.prefix + ":" + this.localName : this.localName;
        },
        _isInHTMLDocumentAndNamespace: function() {
          return this.ownerDocument.type === "html" && this.namespaceURI === NAMESPACE.HTML;
        },
        /**
         * Implementaton of Level2 Core function hasAttributes.
         *
         * @returns {boolean}
         * True if attribute list is not empty.
         * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-NodeHasAttrs
         */
        hasAttributes: function() {
          return !!(this.attributes && this.attributes.length);
        },
        hasAttribute: function(name) {
          return !!this.getAttributeNode(name);
        },
        /**
         * Returns element’s first attribute whose qualified name is `name`, and `null`
         * if there is no such attribute.
         *
         * @param {string} name
         * @returns {string | null}
         */
        getAttribute: function(name) {
          var attr = this.getAttributeNode(name);
          return attr ? attr.value : null;
        },
        getAttributeNode: function(name) {
          if (this._isInHTMLDocumentAndNamespace()) {
            name = name.toLowerCase();
          }
          return this.attributes.getNamedItem(name);
        },
        /**
         * Sets the value of element’s first attribute whose qualified name is qualifiedName to value.
         *
         * @param {string} name
         * @param {string} value
         */
        setAttribute: function(name, value2) {
          if (this._isInHTMLDocumentAndNamespace()) {
            name = name.toLowerCase();
          }
          var attr = this.getAttributeNode(name);
          if (attr) {
            attr.value = attr.nodeValue = "" + value2;
          } else {
            attr = this.ownerDocument._createAttribute(name);
            attr.value = attr.nodeValue = "" + value2;
            this.setAttributeNode(attr);
          }
        },
        removeAttribute: function(name) {
          var attr = this.getAttributeNode(name);
          attr && this.removeAttributeNode(attr);
        },
        setAttributeNode: function(newAttr) {
          return this.attributes.setNamedItem(newAttr);
        },
        setAttributeNodeNS: function(newAttr) {
          return this.attributes.setNamedItemNS(newAttr);
        },
        removeAttributeNode: function(oldAttr) {
          return this.attributes.removeNamedItem(oldAttr.nodeName);
        },
        //get real attribute name,and remove it by removeAttributeNode
        removeAttributeNS: function(namespaceURI, localName) {
          var old = this.getAttributeNodeNS(namespaceURI, localName);
          old && this.removeAttributeNode(old);
        },
        hasAttributeNS: function(namespaceURI, localName) {
          return this.getAttributeNodeNS(namespaceURI, localName) != null;
        },
        /**
         * Returns element’s attribute whose namespace is `namespaceURI` and local name is
         * `localName`,
         * or `null` if there is no such attribute.
         *
         * @param {string} namespaceURI
         * @param {string} localName
         * @returns {string | null}
         */
        getAttributeNS: function(namespaceURI, localName) {
          var attr = this.getAttributeNodeNS(namespaceURI, localName);
          return attr ? attr.value : null;
        },
        /**
         * Sets the value of element’s attribute whose namespace is `namespaceURI` and local name is
         * `localName` to value.
         *
         * @param {string} namespaceURI
         * @param {string} qualifiedName
         * @param {string} value
         * @see https://dom.spec.whatwg.org/#dom-element-setattributens
         */
        setAttributeNS: function(namespaceURI, qualifiedName, value2) {
          var validated = validateAndExtract(namespaceURI, qualifiedName);
          var localName = validated[2];
          var attr = this.getAttributeNodeNS(namespaceURI, localName);
          if (attr) {
            attr.value = attr.nodeValue = "" + value2;
          } else {
            attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
            attr.value = attr.nodeValue = "" + value2;
            this.setAttributeNode(attr);
          }
        },
        getAttributeNodeNS: function(namespaceURI, localName) {
          return this.attributes.getNamedItemNS(namespaceURI, localName);
        },
        /**
         * Returns a LiveNodeList of all child elements which have **all** of the given class name(s).
         *
         * Returns an empty list if `classNames` is an empty string or only contains HTML white space
         * characters.
         *
         * Warning: This returns a live LiveNodeList.
         * Changes in the DOM will reflect in the array as the changes occur.
         * If an element selected by this array no longer qualifies for the selector,
         * it will automatically be removed. Be aware of this for iteration purposes.
         *
         * @param {string} classNames
         * Is a string representing the class name(s) to match; multiple class names are separated by
         * (ASCII-)whitespace.
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByClassName
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementsByClassName
         * @see https://dom.spec.whatwg.org/#concept-getelementsbyclassname
         */
        getElementsByClassName: function(classNames) {
          var classNamesSet = toOrderedSet(classNames);
          return new LiveNodeList(this, function(base) {
            var ls = [];
            if (classNamesSet.length > 0) {
              _visitNode(base, function(node) {
                if (node !== base && node.nodeType === ELEMENT_NODE) {
                  var nodeClassNames = node.getAttribute("class");
                  if (nodeClassNames) {
                    var matches2 = classNames === nodeClassNames;
                    if (!matches2) {
                      var nodeClassNamesSet = toOrderedSet(nodeClassNames);
                      matches2 = classNamesSet.every(arrayIncludes(nodeClassNamesSet));
                    }
                    if (matches2) {
                      ls.push(node);
                    }
                  }
                }
              });
            }
            return ls;
          });
        },
        /**
         * Returns a LiveNodeList of elements with the given qualifiedName.
         * Searching for all descendants can be done by passing `*` as `qualifiedName`.
         *
         * All descendants of the specified element are searched, but not the element itself.
         * The returned list is live, which means it updates itself with the DOM tree automatically.
         * Therefore, there is no need to call `Element.getElementsByTagName()`
         * with the same element and arguments repeatedly if the DOM changes in between calls.
         *
         * When called on an HTML element in an HTML document,
         * `getElementsByTagName` lower-cases the argument before searching for it.
         * This is undesirable when trying to match camel-cased SVG elements (such as
         * `<linearGradient>`) in an HTML document.
         * Instead, use `Element.getElementsByTagNameNS()`,
         * which preserves the capitalization of the tag name.
         *
         * `Element.getElementsByTagName` is similar to `Document.getElementsByTagName()`,
         * except that it only searches for elements that are descendants of the specified element.
         *
         * @param {string} qualifiedName
         * @returns {LiveNodeList}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByTagName
         * @see https://dom.spec.whatwg.org/#concept-getelementsbytagname
         */
        getElementsByTagName: function(qualifiedName) {
          var isHTMLDocument = (this.nodeType === DOCUMENT_NODE ? this : this.ownerDocument).type === "html";
          var lowerQualifiedName = qualifiedName.toLowerCase();
          return new LiveNodeList(this, function(base) {
            var ls = [];
            _visitNode(base, function(node) {
              if (node === base || node.nodeType !== ELEMENT_NODE) {
                return;
              }
              if (qualifiedName === "*") {
                ls.push(node);
              } else {
                var nodeQualifiedName = node.getQualifiedName();
                var matchingQName = isHTMLDocument && node.namespaceURI === NAMESPACE.HTML ? lowerQualifiedName : qualifiedName;
                if (nodeQualifiedName === matchingQName) {
                  ls.push(node);
                }
              }
            });
            return ls;
          });
        },
        getElementsByTagNameNS: function(namespaceURI, localName) {
          return new LiveNodeList(this, function(base) {
            var ls = [];
            _visitNode(base, function(node) {
              if (node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === "*" || node.namespaceURI === namespaceURI) && (localName === "*" || node.localName == localName)) {
                ls.push(node);
              }
            });
            return ls;
          });
        }
      };
      Document.prototype.getElementsByClassName = Element.prototype.getElementsByClassName;
      Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
      Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;
      _extends(Element, Node);
      function Attr(symbol) {
        checkSymbol(symbol);
        this.namespaceURI = null;
        this.prefix = null;
        this.ownerElement = null;
      }
      Attr.prototype.nodeType = ATTRIBUTE_NODE;
      _extends(Attr, Node);
      function CharacterData(symbol) {
        checkSymbol(symbol);
      }
      CharacterData.prototype = {
        data: "",
        substringData: function(offset, count) {
          return this.data.substring(offset, offset + count);
        },
        appendData: function(text) {
          text = this.data + text;
          this.nodeValue = this.data = text;
          this.length = text.length;
        },
        insertData: function(offset, text) {
          this.replaceData(offset, 0, text);
        },
        deleteData: function(offset, count) {
          this.replaceData(offset, count, "");
        },
        replaceData: function(offset, count, text) {
          var start = this.data.substring(0, offset);
          var end = this.data.substring(offset + count);
          text = start + text + end;
          this.nodeValue = this.data = text;
          this.length = text.length;
        }
      };
      _extends(CharacterData, Node);
      function Text(symbol) {
        checkSymbol(symbol);
      }
      Text.prototype = {
        nodeName: "#text",
        nodeType: TEXT_NODE,
        splitText: function(offset) {
          var text = this.data;
          var newText = text.substring(offset);
          text = text.substring(0, offset);
          this.data = this.nodeValue = text;
          this.length = text.length;
          var newNode = this.ownerDocument.createTextNode(newText);
          if (this.parentNode) {
            this.parentNode.insertBefore(newNode, this.nextSibling);
          }
          return newNode;
        }
      };
      _extends(Text, CharacterData);
      function Comment(symbol) {
        checkSymbol(symbol);
      }
      Comment.prototype = {
        nodeName: "#comment",
        nodeType: COMMENT_NODE
      };
      _extends(Comment, CharacterData);
      function CDATASection(symbol) {
        checkSymbol(symbol);
      }
      CDATASection.prototype = {
        nodeName: "#cdata-section",
        nodeType: CDATA_SECTION_NODE
      };
      _extends(CDATASection, Text);
      function DocumentType(symbol) {
        checkSymbol(symbol);
      }
      DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
      _extends(DocumentType, Node);
      function Notation(symbol) {
        checkSymbol(symbol);
      }
      Notation.prototype.nodeType = NOTATION_NODE;
      _extends(Notation, Node);
      function Entity(symbol) {
        checkSymbol(symbol);
      }
      Entity.prototype.nodeType = ENTITY_NODE;
      _extends(Entity, Node);
      function EntityReference(symbol) {
        checkSymbol(symbol);
      }
      EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
      _extends(EntityReference, Node);
      function DocumentFragment(symbol) {
        checkSymbol(symbol);
      }
      DocumentFragment.prototype.nodeName = "#document-fragment";
      DocumentFragment.prototype.nodeType = DOCUMENT_FRAGMENT_NODE;
      _extends(DocumentFragment, Node);
      function ProcessingInstruction(symbol) {
        checkSymbol(symbol);
      }
      ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
      _extends(ProcessingInstruction, CharacterData);
      function XMLSerializer() {
      }
      XMLSerializer.prototype.serializeToString = function(node, options) {
        return nodeSerializeToString.call(node, options);
      };
      Node.prototype.toString = nodeSerializeToString;
      function nodeSerializeToString(options) {
        var opts;
        if (typeof options === "function") {
          opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
        } else if (options != null) {
          opts = {
            requireWellFormed: !!options.requireWellFormed,
            splitCDATASections: options.splitCDATASections !== false,
            nodeFilter: options.nodeFilter || null
          };
        } else {
          opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
        }
        var buf = [];
        var refNode = this.nodeType === DOCUMENT_NODE && this.documentElement || this;
        var prefix = refNode.prefix;
        var uri = refNode.namespaceURI;
        if (uri && prefix == null) {
          var prefix = refNode.lookupPrefix(uri);
          if (prefix == null) {
            var visibleNamespaces = [
              { namespace: uri, prefix: null }
              //{namespace:uri,prefix:''}
            ];
          }
        }
        serializeToString(this, buf, visibleNamespaces, opts);
        return buf.join("");
      }
      function needNamespaceDefine(node, isHTML, visibleNamespaces) {
        var prefix = node.prefix || "";
        var uri = node.namespaceURI;
        if (!uri) {
          return false;
        }
        if (prefix === "xml" && uri === NAMESPACE.XML || uri === NAMESPACE.XMLNS) {
          return false;
        }
        var i = visibleNamespaces.length;
        while (i--) {
          var ns = visibleNamespaces[i];
          if (ns.prefix === prefix) {
            return ns.namespace !== uri;
          }
        }
        return true;
      }
      function addSerializedAttribute(buf, qualifiedName, value2, requireWellFormed) {
        if (requireWellFormed && !g.QName_exact.test(qualifiedName)) {
          throw new DOMException(
            'The attribute name "' + qualifiedName + '" is not a valid XML QName',
            DOMExceptionName.InvalidStateError
          );
        }
        buf.push(" ", qualifiedName, '="', value2.replace(/[<>&"\t\n\r]/g, _xmlEncoder), '"');
      }
      function serializeToString(node, buf, visibleNamespaces, opts) {
        if (!visibleNamespaces) {
          visibleNamespaces = [];
        }
        var nodeFilter = opts.nodeFilter;
        var requireWellFormed = opts.requireWellFormed;
        var splitCDATASections = opts.splitCDATASections;
        var doc = node.nodeType === DOCUMENT_NODE ? node : node.ownerDocument;
        var isHTML = doc.type === "html";
        walkDOM(
          node,
          { ns: visibleNamespaces },
          {
            enter: function(n, ctx) {
              var namespaces = ctx.ns;
              if (nodeFilter) {
                n = nodeFilter(n);
                if (n) {
                  if (typeof n == "string") {
                    buf.push(n);
                    return null;
                  }
                } else {
                  return null;
                }
              }
              switch (n.nodeType) {
                case ELEMENT_NODE:
                  var attrs = n.attributes;
                  var len = attrs.length;
                  var nodeName = n.tagName;
                  var prefixedNodeName = nodeName;
                  if (!isHTML && !n.prefix && n.namespaceURI) {
                    var defaultNS;
                    for (var ai = 0; ai < attrs.length; ai++) {
                      if (attrs.item(ai).name === "xmlns") {
                        defaultNS = attrs.item(ai).value;
                        break;
                      }
                    }
                    if (!defaultNS) {
                      for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                        var nsEntry = namespaces[nsi];
                        if (nsEntry.prefix === "" && nsEntry.namespace === n.namespaceURI) {
                          defaultNS = nsEntry.namespace;
                          break;
                        }
                      }
                    }
                    if (defaultNS !== n.namespaceURI) {
                      for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                        var nsEntry = namespaces[nsi];
                        if (nsEntry.namespace === n.namespaceURI) {
                          if (nsEntry.prefix) {
                            prefixedNodeName = nsEntry.prefix + ":" + nodeName;
                          }
                          break;
                        }
                      }
                    }
                  }
                  if (requireWellFormed && !g.QName_exact.test(prefixedNodeName)) {
                    throw new DOMException(
                      'The element name "' + prefixedNodeName + '" is not a valid XML QName',
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push("<", prefixedNodeName);
                  var childNamespaces = namespaces.slice();
                  for (var i = 0; i < len; i++) {
                    var attr = attrs.item(i);
                    if (attr.prefix == "xmlns") {
                      childNamespaces.push({
                        prefix: attr.localName,
                        namespace: attr.value
                      });
                    } else if (attr.nodeName == "xmlns") {
                      childNamespaces.push({ prefix: "", namespace: attr.value });
                    }
                  }
                  for (var i = 0; i < len; i++) {
                    var attr = attrs.item(i);
                    if (needNamespaceDefine(attr, isHTML, childNamespaces)) {
                      var attrPrefix = attr.prefix || "";
                      var uri = attr.namespaceURI;
                      addSerializedAttribute(buf, attrPrefix ? "xmlns:" + attrPrefix : "xmlns", uri, requireWellFormed);
                      childNamespaces.push({ prefix: attrPrefix, namespace: uri });
                    }
                    var filteredAttr = nodeFilter ? nodeFilter(attr) : attr;
                    if (filteredAttr) {
                      if (typeof filteredAttr === "string") {
                        buf.push(filteredAttr);
                      } else {
                        addSerializedAttribute(buf, filteredAttr.name, filteredAttr.value, requireWellFormed);
                      }
                    }
                  }
                  if (nodeName === prefixedNodeName && needNamespaceDefine(n, isHTML, childNamespaces)) {
                    var nodePrefix = n.prefix || "";
                    var uri = n.namespaceURI;
                    addSerializedAttribute(buf, nodePrefix ? "xmlns:" + nodePrefix : "xmlns", uri, requireWellFormed);
                    childNamespaces.push({ prefix: nodePrefix, namespace: uri });
                  }
                  var canCloseTag = !n.firstChild;
                  if (canCloseTag && (isHTML || n.namespaceURI === NAMESPACE.HTML)) {
                    canCloseTag = isHTMLVoidElement(nodeName);
                  }
                  if (canCloseTag) {
                    buf.push("/>");
                    return null;
                  }
                  buf.push(">");
                  if (isHTML && isHTMLRawTextElement(nodeName)) {
                    var child2 = n.firstChild;
                    while (child2) {
                      if (child2.data) {
                        buf.push(child2.data);
                      } else {
                        serializeToString(child2, buf, childNamespaces.slice(), opts);
                      }
                      child2 = child2.nextSibling;
                    }
                    buf.push("</", prefixedNodeName, ">");
                    return null;
                  }
                  return { ns: childNamespaces, tag: prefixedNodeName };
                case DOCUMENT_NODE:
                case DOCUMENT_FRAGMENT_NODE:
                  if (requireWellFormed && n.nodeType === DOCUMENT_NODE && n.documentElement == null) {
                    throw new DOMException("The Document has no documentElement", DOMExceptionName.InvalidStateError);
                  }
                  return { ns: namespaces };
                case ATTRIBUTE_NODE:
                  addSerializedAttribute(buf, n.name, n.value, requireWellFormed);
                  return null;
                case TEXT_NODE:
                  if (requireWellFormed && g.InvalidChar.test(n.data)) {
                    throw new DOMException(
                      "The Text node data contains characters outside the XML Char production",
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push(n.data.replace(/[<&>]/g, _xmlEncoder));
                  return null;
                case CDATA_SECTION_NODE:
                  if (requireWellFormed && n.data.indexOf("]]>") !== -1) {
                    throw new DOMException('The CDATASection data contains "]]>"', DOMExceptionName.InvalidStateError);
                  }
                  if (splitCDATASections) {
                    buf.push(g.CDATA_START, n.data.replace(/]]>/g, "]]]]><![CDATA[>"), g.CDATA_END);
                  } else {
                    buf.push(g.CDATA_START, n.data, g.CDATA_END);
                  }
                  return null;
                case COMMENT_NODE:
                  if (requireWellFormed) {
                    if (g.InvalidChar.test(n.data)) {
                      throw new DOMException(
                        "The comment node data contains characters outside the XML Char production",
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (n.data.indexOf("--") !== -1 || n.data[n.data.length - 1] === "-") {
                      throw new DOMException(
                        'The comment node data contains "--" or ends with "-"',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                  }
                  buf.push(g.COMMENT_START, n.data, g.COMMENT_END);
                  return null;
                case DOCUMENT_TYPE_NODE:
                  var pubid = n.publicId;
                  var sysid = n.systemId;
                  if (requireWellFormed) {
                    if (!g.Name_exact.test(n.name)) {
                      throw new DOMException(
                        'The doctype name "' + n.name + '" is not a valid XML Name',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (pubid && !g.PubidLiteral_match.test(pubid)) {
                      throw new DOMException("DocumentType publicId is not a valid PubidLiteral", DOMExceptionName.InvalidStateError);
                    }
                    if (sysid && sysid !== "." && !g.SystemLiteral_match.test(sysid)) {
                      throw new DOMException("DocumentType systemId is not a valid SystemLiteral", DOMExceptionName.InvalidStateError);
                    }
                    if (n.internalSubset && n.internalSubset.indexOf("]>") !== -1) {
                      throw new DOMException('DocumentType internalSubset contains "]>"', DOMExceptionName.InvalidStateError);
                    }
                  }
                  buf.push(g.DOCTYPE_DECL_START, " ", n.name);
                  if (pubid) {
                    buf.push(" ", g.PUBLIC, " ", pubid);
                    if (sysid && sysid !== ".") {
                      buf.push(" ", sysid);
                    }
                  } else if (sysid && sysid !== ".") {
                    buf.push(" ", g.SYSTEM, " ", sysid);
                  }
                  if (n.internalSubset) {
                    buf.push(" [", n.internalSubset, "]");
                  }
                  buf.push(">");
                  return null;
                case PROCESSING_INSTRUCTION_NODE:
                  if (requireWellFormed) {
                    if (!g.NCName_exact.test(n.target) || n.target.toLowerCase() === "xml") {
                      throw new DOMException(
                        'The processing instruction target "' + n.target + '" is not a valid XML NCName or is reserved',
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (g.InvalidChar.test(n.data)) {
                      throw new DOMException(
                        "The ProcessingInstruction data contains characters outside the XML Char production",
                        DOMExceptionName.InvalidStateError
                      );
                    }
                    if (n.data.indexOf("?>") !== -1) {
                      throw new DOMException('The ProcessingInstruction data contains "?>"', DOMExceptionName.InvalidStateError);
                    }
                  }
                  buf.push("<?", n.target, " ", n.data, "?>");
                  return null;
                case ENTITY_REFERENCE_NODE:
                  if (requireWellFormed && !g.Name_exact.test(n.nodeName)) {
                    throw new DOMException(
                      'The entity reference name "' + n.nodeName + '" is not a valid XML Name',
                      DOMExceptionName.InvalidStateError
                    );
                  }
                  buf.push("&", n.nodeName, ";");
                  return null;
                //case ENTITY_NODE:
                //case NOTATION_NODE:
                default:
                  buf.push("??", n.nodeName);
                  return null;
              }
            },
            exit: function(n, childCtx) {
              if (childCtx && childCtx.tag) {
                buf.push("</", childCtx.tag, ">");
              }
            }
          }
        );
      }
      function importNode(doc, node, deep) {
        var destRoot;
        walkDOM(node, null, {
          enter: function(srcNode, destParent) {
            var destNode = srcNode.cloneNode(false);
            destNode.ownerDocument = doc;
            destNode.parentNode = null;
            if (destParent === null) {
              destRoot = destNode;
            } else {
              destParent.appendChild(destNode);
            }
            var shouldDeep = srcNode.nodeType === ATTRIBUTE_NODE || deep;
            return shouldDeep ? destNode : null;
          }
        });
        return destRoot;
      }
      function cloneNode(doc, node, deep) {
        var destRoot;
        walkDOM(node, null, {
          enter: function(srcNode, destParent) {
            var destNode = new srcNode.constructor(PDC);
            for (var n in srcNode) {
              if (hasOwn(srcNode, n)) {
                var v = srcNode[n];
                if (typeof v != "object") {
                  if (v != destNode[n]) {
                    destNode[n] = v;
                  }
                }
              }
            }
            if (srcNode.childNodes) {
              destNode.childNodes = new NodeList();
            }
            destNode.ownerDocument = doc;
            var shouldDeep = deep;
            switch (destNode.nodeType) {
              case ELEMENT_NODE:
                var attrs = srcNode.attributes;
                var attrs2 = destNode.attributes = new NamedNodeMap();
                var len = attrs.length;
                attrs2._ownerElement = destNode;
                for (var i = 0; i < len; i++) {
                  destNode.setAttributeNode(cloneNode(doc, attrs.item(i), true));
                }
                break;
              case ATTRIBUTE_NODE:
                shouldDeep = true;
            }
            if (destParent !== null) {
              destParent.appendChild(destNode);
            } else {
              destRoot = destNode;
            }
            return shouldDeep ? destNode : null;
          }
        });
        return destRoot;
      }
      function __set__(object, key, value2) {
        object[key] = value2;
      }
      function childrenRefresh(node) {
        var ls = [];
        var child2 = node.firstChild;
        while (child2) {
          if (child2.nodeType === ELEMENT_NODE) {
            ls.push(child2);
          }
          child2 = child2.nextSibling;
        }
        return ls;
      }
      try {
        if (Object.defineProperty) {
          Object.defineProperty(LiveNodeList.prototype, "length", {
            get: function() {
              _updateLiveList(this);
              return this.$$length;
            }
          });
          Object.defineProperty(Node.prototype, "textContent", {
            get: function() {
              if (this.nodeType === ELEMENT_NODE || this.nodeType === DOCUMENT_FRAGMENT_NODE) {
                var buf = [];
                walkDOM(this, null, {
                  enter: function(n) {
                    if (n.nodeType === ELEMENT_NODE || n.nodeType === DOCUMENT_FRAGMENT_NODE) {
                      return true;
                    }
                    if (n.nodeType === PROCESSING_INSTRUCTION_NODE || n.nodeType === COMMENT_NODE) {
                      return null;
                    }
                    buf.push(n.nodeValue);
                  }
                });
                return buf.join("");
              }
              return this.nodeValue;
            },
            set: function(data) {
              switch (this.nodeType) {
                case ELEMENT_NODE:
                case DOCUMENT_FRAGMENT_NODE:
                  while (this.firstChild) {
                    this.removeChild(this.firstChild);
                  }
                  if (data || String(data)) {
                    this.appendChild(this.ownerDocument.createTextNode(data));
                  }
                  break;
                default:
                  this.data = data;
                  this.value = data;
                  this.nodeValue = data;
              }
            }
          });
          Object.defineProperty(CharacterData.prototype, "data", {
            get: function() {
              return this._data != null ? this._data : "";
            },
            set: function(v) {
              this._data = v;
              this.length = typeof v === "string" ? v.length : 0;
            }
          });
          Object.defineProperty(CharacterData.prototype, "nodeValue", {
            get: function() {
              return this.data;
            },
            set: function(v) {
              this.data = v;
            },
            enumerable: true,
            configurable: true
          });
          Object.defineProperty(Element.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          Object.defineProperty(Document.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          Object.defineProperty(DocumentFragment.prototype, "children", {
            get: function() {
              return new LiveNodeList(this, childrenRefresh);
            }
          });
          __set__ = function(object, key, value2) {
            object["$$" + key] = value2;
          };
        }
      } catch (e) {
      }
      exports._updateLiveList = _updateLiveList;
      exports.Attr = Attr;
      exports.CDATASection = CDATASection;
      exports.CharacterData = CharacterData;
      exports.Comment = Comment;
      exports.Document = Document;
      exports.DocumentFragment = DocumentFragment;
      exports.DocumentType = DocumentType;
      exports.DOMImplementation = DOMImplementation;
      exports.Element = Element;
      exports.Entity = Entity;
      exports.EntityReference = EntityReference;
      exports.LiveNodeList = LiveNodeList;
      exports.NamedNodeMap = NamedNodeMap;
      exports.Node = Node;
      exports.NodeList = NodeList;
      exports.Notation = Notation;
      exports.Text = Text;
      exports.ProcessingInstruction = ProcessingInstruction;
      exports.walkDOM = walkDOM;
      exports.XMLSerializer = XMLSerializer;
    }
  });

  // node_modules/@xmldom/xmldom/lib/entities.js
  var require_entities = __commonJS({
    "node_modules/@xmldom/xmldom/lib/entities.js"(exports) {
      "use strict";
      var freeze3 = require_conventions().freeze;
      exports.XML_ENTITIES = freeze3({
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        quot: '"'
      });
      exports.HTML_ENTITIES = freeze3({
        Aacute: "Á",
        aacute: "á",
        Abreve: "Ă",
        abreve: "ă",
        ac: "∾",
        acd: "∿",
        acE: "∾̳",
        Acirc: "Â",
        acirc: "â",
        acute: "´",
        Acy: "А",
        acy: "а",
        AElig: "Æ",
        aelig: "æ",
        af: "⁡",
        Afr: "𝔄",
        afr: "𝔞",
        Agrave: "À",
        agrave: "à",
        alefsym: "ℵ",
        aleph: "ℵ",
        Alpha: "Α",
        alpha: "α",
        Amacr: "Ā",
        amacr: "ā",
        amalg: "⨿",
        AMP: "&",
        amp: "&",
        And: "⩓",
        and: "∧",
        andand: "⩕",
        andd: "⩜",
        andslope: "⩘",
        andv: "⩚",
        ang: "∠",
        ange: "⦤",
        angle: "∠",
        angmsd: "∡",
        angmsdaa: "⦨",
        angmsdab: "⦩",
        angmsdac: "⦪",
        angmsdad: "⦫",
        angmsdae: "⦬",
        angmsdaf: "⦭",
        angmsdag: "⦮",
        angmsdah: "⦯",
        angrt: "∟",
        angrtvb: "⊾",
        angrtvbd: "⦝",
        angsph: "∢",
        angst: "Å",
        angzarr: "⍼",
        Aogon: "Ą",
        aogon: "ą",
        Aopf: "𝔸",
        aopf: "𝕒",
        ap: "≈",
        apacir: "⩯",
        apE: "⩰",
        ape: "≊",
        apid: "≋",
        apos: "'",
        ApplyFunction: "⁡",
        approx: "≈",
        approxeq: "≊",
        Aring: "Å",
        aring: "å",
        Ascr: "𝒜",
        ascr: "𝒶",
        Assign: "≔",
        ast: "*",
        asymp: "≈",
        asympeq: "≍",
        Atilde: "Ã",
        atilde: "ã",
        Auml: "Ä",
        auml: "ä",
        awconint: "∳",
        awint: "⨑",
        backcong: "≌",
        backepsilon: "϶",
        backprime: "‵",
        backsim: "∽",
        backsimeq: "⋍",
        Backslash: "∖",
        Barv: "⫧",
        barvee: "⊽",
        Barwed: "⌆",
        barwed: "⌅",
        barwedge: "⌅",
        bbrk: "⎵",
        bbrktbrk: "⎶",
        bcong: "≌",
        Bcy: "Б",
        bcy: "б",
        bdquo: "„",
        becaus: "∵",
        Because: "∵",
        because: "∵",
        bemptyv: "⦰",
        bepsi: "϶",
        bernou: "ℬ",
        Bernoullis: "ℬ",
        Beta: "Β",
        beta: "β",
        beth: "ℶ",
        between: "≬",
        Bfr: "𝔅",
        bfr: "𝔟",
        bigcap: "⋂",
        bigcirc: "◯",
        bigcup: "⋃",
        bigodot: "⨀",
        bigoplus: "⨁",
        bigotimes: "⨂",
        bigsqcup: "⨆",
        bigstar: "★",
        bigtriangledown: "▽",
        bigtriangleup: "△",
        biguplus: "⨄",
        bigvee: "⋁",
        bigwedge: "⋀",
        bkarow: "⤍",
        blacklozenge: "⧫",
        blacksquare: "▪",
        blacktriangle: "▴",
        blacktriangledown: "▾",
        blacktriangleleft: "◂",
        blacktriangleright: "▸",
        blank: "␣",
        blk12: "▒",
        blk14: "░",
        blk34: "▓",
        block: "█",
        bne: "=⃥",
        bnequiv: "≡⃥",
        bNot: "⫭",
        bnot: "⌐",
        Bopf: "𝔹",
        bopf: "𝕓",
        bot: "⊥",
        bottom: "⊥",
        bowtie: "⋈",
        boxbox: "⧉",
        boxDL: "╗",
        boxDl: "╖",
        boxdL: "╕",
        boxdl: "┐",
        boxDR: "╔",
        boxDr: "╓",
        boxdR: "╒",
        boxdr: "┌",
        boxH: "═",
        boxh: "─",
        boxHD: "╦",
        boxHd: "╤",
        boxhD: "╥",
        boxhd: "┬",
        boxHU: "╩",
        boxHu: "╧",
        boxhU: "╨",
        boxhu: "┴",
        boxminus: "⊟",
        boxplus: "⊞",
        boxtimes: "⊠",
        boxUL: "╝",
        boxUl: "╜",
        boxuL: "╛",
        boxul: "┘",
        boxUR: "╚",
        boxUr: "╙",
        boxuR: "╘",
        boxur: "└",
        boxV: "║",
        boxv: "│",
        boxVH: "╬",
        boxVh: "╫",
        boxvH: "╪",
        boxvh: "┼",
        boxVL: "╣",
        boxVl: "╢",
        boxvL: "╡",
        boxvl: "┤",
        boxVR: "╠",
        boxVr: "╟",
        boxvR: "╞",
        boxvr: "├",
        bprime: "‵",
        Breve: "˘",
        breve: "˘",
        brvbar: "¦",
        Bscr: "ℬ",
        bscr: "𝒷",
        bsemi: "⁏",
        bsim: "∽",
        bsime: "⋍",
        bsol: "\\",
        bsolb: "⧅",
        bsolhsub: "⟈",
        bull: "•",
        bullet: "•",
        bump: "≎",
        bumpE: "⪮",
        bumpe: "≏",
        Bumpeq: "≎",
        bumpeq: "≏",
        Cacute: "Ć",
        cacute: "ć",
        Cap: "⋒",
        cap: "∩",
        capand: "⩄",
        capbrcup: "⩉",
        capcap: "⩋",
        capcup: "⩇",
        capdot: "⩀",
        CapitalDifferentialD: "ⅅ",
        caps: "∩︀",
        caret: "⁁",
        caron: "ˇ",
        Cayleys: "ℭ",
        ccaps: "⩍",
        Ccaron: "Č",
        ccaron: "č",
        Ccedil: "Ç",
        ccedil: "ç",
        Ccirc: "Ĉ",
        ccirc: "ĉ",
        Cconint: "∰",
        ccups: "⩌",
        ccupssm: "⩐",
        Cdot: "Ċ",
        cdot: "ċ",
        cedil: "¸",
        Cedilla: "¸",
        cemptyv: "⦲",
        cent: "¢",
        CenterDot: "·",
        centerdot: "·",
        Cfr: "ℭ",
        cfr: "𝔠",
        CHcy: "Ч",
        chcy: "ч",
        check: "✓",
        checkmark: "✓",
        Chi: "Χ",
        chi: "χ",
        cir: "○",
        circ: "ˆ",
        circeq: "≗",
        circlearrowleft: "↺",
        circlearrowright: "↻",
        circledast: "⊛",
        circledcirc: "⊚",
        circleddash: "⊝",
        CircleDot: "⊙",
        circledR: "®",
        circledS: "Ⓢ",
        CircleMinus: "⊖",
        CirclePlus: "⊕",
        CircleTimes: "⊗",
        cirE: "⧃",
        cire: "≗",
        cirfnint: "⨐",
        cirmid: "⫯",
        cirscir: "⧂",
        ClockwiseContourIntegral: "∲",
        CloseCurlyDoubleQuote: "”",
        CloseCurlyQuote: "’",
        clubs: "♣",
        clubsuit: "♣",
        Colon: "∷",
        colon: ":",
        Colone: "⩴",
        colone: "≔",
        coloneq: "≔",
        comma: ",",
        commat: "@",
        comp: "∁",
        compfn: "∘",
        complement: "∁",
        complexes: "ℂ",
        cong: "≅",
        congdot: "⩭",
        Congruent: "≡",
        Conint: "∯",
        conint: "∮",
        ContourIntegral: "∮",
        Copf: "ℂ",
        copf: "𝕔",
        coprod: "∐",
        Coproduct: "∐",
        COPY: "©",
        copy: "©",
        copysr: "℗",
        CounterClockwiseContourIntegral: "∳",
        crarr: "↵",
        Cross: "⨯",
        cross: "✗",
        Cscr: "𝒞",
        cscr: "𝒸",
        csub: "⫏",
        csube: "⫑",
        csup: "⫐",
        csupe: "⫒",
        ctdot: "⋯",
        cudarrl: "⤸",
        cudarrr: "⤵",
        cuepr: "⋞",
        cuesc: "⋟",
        cularr: "↶",
        cularrp: "⤽",
        Cup: "⋓",
        cup: "∪",
        cupbrcap: "⩈",
        CupCap: "≍",
        cupcap: "⩆",
        cupcup: "⩊",
        cupdot: "⊍",
        cupor: "⩅",
        cups: "∪︀",
        curarr: "↷",
        curarrm: "⤼",
        curlyeqprec: "⋞",
        curlyeqsucc: "⋟",
        curlyvee: "⋎",
        curlywedge: "⋏",
        curren: "¤",
        curvearrowleft: "↶",
        curvearrowright: "↷",
        cuvee: "⋎",
        cuwed: "⋏",
        cwconint: "∲",
        cwint: "∱",
        cylcty: "⌭",
        Dagger: "‡",
        dagger: "†",
        daleth: "ℸ",
        Darr: "↡",
        dArr: "⇓",
        darr: "↓",
        dash: "‐",
        Dashv: "⫤",
        dashv: "⊣",
        dbkarow: "⤏",
        dblac: "˝",
        Dcaron: "Ď",
        dcaron: "ď",
        Dcy: "Д",
        dcy: "д",
        DD: "ⅅ",
        dd: "ⅆ",
        ddagger: "‡",
        ddarr: "⇊",
        DDotrahd: "⤑",
        ddotseq: "⩷",
        deg: "°",
        Del: "∇",
        Delta: "Δ",
        delta: "δ",
        demptyv: "⦱",
        dfisht: "⥿",
        Dfr: "𝔇",
        dfr: "𝔡",
        dHar: "⥥",
        dharl: "⇃",
        dharr: "⇂",
        DiacriticalAcute: "´",
        DiacriticalDot: "˙",
        DiacriticalDoubleAcute: "˝",
        DiacriticalGrave: "`",
        DiacriticalTilde: "˜",
        diam: "⋄",
        Diamond: "⋄",
        diamond: "⋄",
        diamondsuit: "♦",
        diams: "♦",
        die: "¨",
        DifferentialD: "ⅆ",
        digamma: "ϝ",
        disin: "⋲",
        div: "÷",
        divide: "÷",
        divideontimes: "⋇",
        divonx: "⋇",
        DJcy: "Ђ",
        djcy: "ђ",
        dlcorn: "⌞",
        dlcrop: "⌍",
        dollar: "$",
        Dopf: "𝔻",
        dopf: "𝕕",
        Dot: "¨",
        dot: "˙",
        DotDot: "⃜",
        doteq: "≐",
        doteqdot: "≑",
        DotEqual: "≐",
        dotminus: "∸",
        dotplus: "∔",
        dotsquare: "⊡",
        doublebarwedge: "⌆",
        DoubleContourIntegral: "∯",
        DoubleDot: "¨",
        DoubleDownArrow: "⇓",
        DoubleLeftArrow: "⇐",
        DoubleLeftRightArrow: "⇔",
        DoubleLeftTee: "⫤",
        DoubleLongLeftArrow: "⟸",
        DoubleLongLeftRightArrow: "⟺",
        DoubleLongRightArrow: "⟹",
        DoubleRightArrow: "⇒",
        DoubleRightTee: "⊨",
        DoubleUpArrow: "⇑",
        DoubleUpDownArrow: "⇕",
        DoubleVerticalBar: "∥",
        DownArrow: "↓",
        Downarrow: "⇓",
        downarrow: "↓",
        DownArrowBar: "⤓",
        DownArrowUpArrow: "⇵",
        DownBreve: "̑",
        downdownarrows: "⇊",
        downharpoonleft: "⇃",
        downharpoonright: "⇂",
        DownLeftRightVector: "⥐",
        DownLeftTeeVector: "⥞",
        DownLeftVector: "↽",
        DownLeftVectorBar: "⥖",
        DownRightTeeVector: "⥟",
        DownRightVector: "⇁",
        DownRightVectorBar: "⥗",
        DownTee: "⊤",
        DownTeeArrow: "↧",
        drbkarow: "⤐",
        drcorn: "⌟",
        drcrop: "⌌",
        Dscr: "𝒟",
        dscr: "𝒹",
        DScy: "Ѕ",
        dscy: "ѕ",
        dsol: "⧶",
        Dstrok: "Đ",
        dstrok: "đ",
        dtdot: "⋱",
        dtri: "▿",
        dtrif: "▾",
        duarr: "⇵",
        duhar: "⥯",
        dwangle: "⦦",
        DZcy: "Џ",
        dzcy: "џ",
        dzigrarr: "⟿",
        Eacute: "É",
        eacute: "é",
        easter: "⩮",
        Ecaron: "Ě",
        ecaron: "ě",
        ecir: "≖",
        Ecirc: "Ê",
        ecirc: "ê",
        ecolon: "≕",
        Ecy: "Э",
        ecy: "э",
        eDDot: "⩷",
        Edot: "Ė",
        eDot: "≑",
        edot: "ė",
        ee: "ⅇ",
        efDot: "≒",
        Efr: "𝔈",
        efr: "𝔢",
        eg: "⪚",
        Egrave: "È",
        egrave: "è",
        egs: "⪖",
        egsdot: "⪘",
        el: "⪙",
        Element: "∈",
        elinters: "⏧",
        ell: "ℓ",
        els: "⪕",
        elsdot: "⪗",
        Emacr: "Ē",
        emacr: "ē",
        empty: "∅",
        emptyset: "∅",
        EmptySmallSquare: "◻",
        emptyv: "∅",
        EmptyVerySmallSquare: "▫",
        emsp: " ",
        emsp13: " ",
        emsp14: " ",
        ENG: "Ŋ",
        eng: "ŋ",
        ensp: " ",
        Eogon: "Ę",
        eogon: "ę",
        Eopf: "𝔼",
        eopf: "𝕖",
        epar: "⋕",
        eparsl: "⧣",
        eplus: "⩱",
        epsi: "ε",
        Epsilon: "Ε",
        epsilon: "ε",
        epsiv: "ϵ",
        eqcirc: "≖",
        eqcolon: "≕",
        eqsim: "≂",
        eqslantgtr: "⪖",
        eqslantless: "⪕",
        Equal: "⩵",
        equals: "=",
        EqualTilde: "≂",
        equest: "≟",
        Equilibrium: "⇌",
        equiv: "≡",
        equivDD: "⩸",
        eqvparsl: "⧥",
        erarr: "⥱",
        erDot: "≓",
        Escr: "ℰ",
        escr: "ℯ",
        esdot: "≐",
        Esim: "⩳",
        esim: "≂",
        Eta: "Η",
        eta: "η",
        ETH: "Ð",
        eth: "ð",
        Euml: "Ë",
        euml: "ë",
        euro: "€",
        excl: "!",
        exist: "∃",
        Exists: "∃",
        expectation: "ℰ",
        ExponentialE: "ⅇ",
        exponentiale: "ⅇ",
        fallingdotseq: "≒",
        Fcy: "Ф",
        fcy: "ф",
        female: "♀",
        ffilig: "ﬃ",
        fflig: "ﬀ",
        ffllig: "ﬄ",
        Ffr: "𝔉",
        ffr: "𝔣",
        filig: "ﬁ",
        FilledSmallSquare: "◼",
        FilledVerySmallSquare: "▪",
        fjlig: "fj",
        flat: "♭",
        fllig: "ﬂ",
        fltns: "▱",
        fnof: "ƒ",
        Fopf: "𝔽",
        fopf: "𝕗",
        ForAll: "∀",
        forall: "∀",
        fork: "⋔",
        forkv: "⫙",
        Fouriertrf: "ℱ",
        fpartint: "⨍",
        frac12: "½",
        frac13: "⅓",
        frac14: "¼",
        frac15: "⅕",
        frac16: "⅙",
        frac18: "⅛",
        frac23: "⅔",
        frac25: "⅖",
        frac34: "¾",
        frac35: "⅗",
        frac38: "⅜",
        frac45: "⅘",
        frac56: "⅚",
        frac58: "⅝",
        frac78: "⅞",
        frasl: "⁄",
        frown: "⌢",
        Fscr: "ℱ",
        fscr: "𝒻",
        gacute: "ǵ",
        Gamma: "Γ",
        gamma: "γ",
        Gammad: "Ϝ",
        gammad: "ϝ",
        gap: "⪆",
        Gbreve: "Ğ",
        gbreve: "ğ",
        Gcedil: "Ģ",
        Gcirc: "Ĝ",
        gcirc: "ĝ",
        Gcy: "Г",
        gcy: "г",
        Gdot: "Ġ",
        gdot: "ġ",
        gE: "≧",
        ge: "≥",
        gEl: "⪌",
        gel: "⋛",
        geq: "≥",
        geqq: "≧",
        geqslant: "⩾",
        ges: "⩾",
        gescc: "⪩",
        gesdot: "⪀",
        gesdoto: "⪂",
        gesdotol: "⪄",
        gesl: "⋛︀",
        gesles: "⪔",
        Gfr: "𝔊",
        gfr: "𝔤",
        Gg: "⋙",
        gg: "≫",
        ggg: "⋙",
        gimel: "ℷ",
        GJcy: "Ѓ",
        gjcy: "ѓ",
        gl: "≷",
        gla: "⪥",
        glE: "⪒",
        glj: "⪤",
        gnap: "⪊",
        gnapprox: "⪊",
        gnE: "≩",
        gne: "⪈",
        gneq: "⪈",
        gneqq: "≩",
        gnsim: "⋧",
        Gopf: "𝔾",
        gopf: "𝕘",
        grave: "`",
        GreaterEqual: "≥",
        GreaterEqualLess: "⋛",
        GreaterFullEqual: "≧",
        GreaterGreater: "⪢",
        GreaterLess: "≷",
        GreaterSlantEqual: "⩾",
        GreaterTilde: "≳",
        Gscr: "𝒢",
        gscr: "ℊ",
        gsim: "≳",
        gsime: "⪎",
        gsiml: "⪐",
        Gt: "≫",
        GT: ">",
        gt: ">",
        gtcc: "⪧",
        gtcir: "⩺",
        gtdot: "⋗",
        gtlPar: "⦕",
        gtquest: "⩼",
        gtrapprox: "⪆",
        gtrarr: "⥸",
        gtrdot: "⋗",
        gtreqless: "⋛",
        gtreqqless: "⪌",
        gtrless: "≷",
        gtrsim: "≳",
        gvertneqq: "≩︀",
        gvnE: "≩︀",
        Hacek: "ˇ",
        hairsp: " ",
        half: "½",
        hamilt: "ℋ",
        HARDcy: "Ъ",
        hardcy: "ъ",
        hArr: "⇔",
        harr: "↔",
        harrcir: "⥈",
        harrw: "↭",
        Hat: "^",
        hbar: "ℏ",
        Hcirc: "Ĥ",
        hcirc: "ĥ",
        hearts: "♥",
        heartsuit: "♥",
        hellip: "…",
        hercon: "⊹",
        Hfr: "ℌ",
        hfr: "𝔥",
        HilbertSpace: "ℋ",
        hksearow: "⤥",
        hkswarow: "⤦",
        hoarr: "⇿",
        homtht: "∻",
        hookleftarrow: "↩",
        hookrightarrow: "↪",
        Hopf: "ℍ",
        hopf: "𝕙",
        horbar: "―",
        HorizontalLine: "─",
        Hscr: "ℋ",
        hscr: "𝒽",
        hslash: "ℏ",
        Hstrok: "Ħ",
        hstrok: "ħ",
        HumpDownHump: "≎",
        HumpEqual: "≏",
        hybull: "⁃",
        hyphen: "‐",
        Iacute: "Í",
        iacute: "í",
        ic: "⁣",
        Icirc: "Î",
        icirc: "î",
        Icy: "И",
        icy: "и",
        Idot: "İ",
        IEcy: "Е",
        iecy: "е",
        iexcl: "¡",
        iff: "⇔",
        Ifr: "ℑ",
        ifr: "𝔦",
        Igrave: "Ì",
        igrave: "ì",
        ii: "ⅈ",
        iiiint: "⨌",
        iiint: "∭",
        iinfin: "⧜",
        iiota: "℩",
        IJlig: "Ĳ",
        ijlig: "ĳ",
        Im: "ℑ",
        Imacr: "Ī",
        imacr: "ī",
        image: "ℑ",
        ImaginaryI: "ⅈ",
        imagline: "ℐ",
        imagpart: "ℑ",
        imath: "ı",
        imof: "⊷",
        imped: "Ƶ",
        Implies: "⇒",
        in: "∈",
        incare: "℅",
        infin: "∞",
        infintie: "⧝",
        inodot: "ı",
        Int: "∬",
        int: "∫",
        intcal: "⊺",
        integers: "ℤ",
        Integral: "∫",
        intercal: "⊺",
        Intersection: "⋂",
        intlarhk: "⨗",
        intprod: "⨼",
        InvisibleComma: "⁣",
        InvisibleTimes: "⁢",
        IOcy: "Ё",
        iocy: "ё",
        Iogon: "Į",
        iogon: "į",
        Iopf: "𝕀",
        iopf: "𝕚",
        Iota: "Ι",
        iota: "ι",
        iprod: "⨼",
        iquest: "¿",
        Iscr: "ℐ",
        iscr: "𝒾",
        isin: "∈",
        isindot: "⋵",
        isinE: "⋹",
        isins: "⋴",
        isinsv: "⋳",
        isinv: "∈",
        it: "⁢",
        Itilde: "Ĩ",
        itilde: "ĩ",
        Iukcy: "І",
        iukcy: "і",
        Iuml: "Ï",
        iuml: "ï",
        Jcirc: "Ĵ",
        jcirc: "ĵ",
        Jcy: "Й",
        jcy: "й",
        Jfr: "𝔍",
        jfr: "𝔧",
        jmath: "ȷ",
        Jopf: "𝕁",
        jopf: "𝕛",
        Jscr: "𝒥",
        jscr: "𝒿",
        Jsercy: "Ј",
        jsercy: "ј",
        Jukcy: "Є",
        jukcy: "є",
        Kappa: "Κ",
        kappa: "κ",
        kappav: "ϰ",
        Kcedil: "Ķ",
        kcedil: "ķ",
        Kcy: "К",
        kcy: "к",
        Kfr: "𝔎",
        kfr: "𝔨",
        kgreen: "ĸ",
        KHcy: "Х",
        khcy: "х",
        KJcy: "Ќ",
        kjcy: "ќ",
        Kopf: "𝕂",
        kopf: "𝕜",
        Kscr: "𝒦",
        kscr: "𝓀",
        lAarr: "⇚",
        Lacute: "Ĺ",
        lacute: "ĺ",
        laemptyv: "⦴",
        lagran: "ℒ",
        Lambda: "Λ",
        lambda: "λ",
        Lang: "⟪",
        lang: "⟨",
        langd: "⦑",
        langle: "⟨",
        lap: "⪅",
        Laplacetrf: "ℒ",
        laquo: "«",
        Larr: "↞",
        lArr: "⇐",
        larr: "←",
        larrb: "⇤",
        larrbfs: "⤟",
        larrfs: "⤝",
        larrhk: "↩",
        larrlp: "↫",
        larrpl: "⤹",
        larrsim: "⥳",
        larrtl: "↢",
        lat: "⪫",
        lAtail: "⤛",
        latail: "⤙",
        late: "⪭",
        lates: "⪭︀",
        lBarr: "⤎",
        lbarr: "⤌",
        lbbrk: "❲",
        lbrace: "{",
        lbrack: "[",
        lbrke: "⦋",
        lbrksld: "⦏",
        lbrkslu: "⦍",
        Lcaron: "Ľ",
        lcaron: "ľ",
        Lcedil: "Ļ",
        lcedil: "ļ",
        lceil: "⌈",
        lcub: "{",
        Lcy: "Л",
        lcy: "л",
        ldca: "⤶",
        ldquo: "“",
        ldquor: "„",
        ldrdhar: "⥧",
        ldrushar: "⥋",
        ldsh: "↲",
        lE: "≦",
        le: "≤",
        LeftAngleBracket: "⟨",
        LeftArrow: "←",
        Leftarrow: "⇐",
        leftarrow: "←",
        LeftArrowBar: "⇤",
        LeftArrowRightArrow: "⇆",
        leftarrowtail: "↢",
        LeftCeiling: "⌈",
        LeftDoubleBracket: "⟦",
        LeftDownTeeVector: "⥡",
        LeftDownVector: "⇃",
        LeftDownVectorBar: "⥙",
        LeftFloor: "⌊",
        leftharpoondown: "↽",
        leftharpoonup: "↼",
        leftleftarrows: "⇇",
        LeftRightArrow: "↔",
        Leftrightarrow: "⇔",
        leftrightarrow: "↔",
        leftrightarrows: "⇆",
        leftrightharpoons: "⇋",
        leftrightsquigarrow: "↭",
        LeftRightVector: "⥎",
        LeftTee: "⊣",
        LeftTeeArrow: "↤",
        LeftTeeVector: "⥚",
        leftthreetimes: "⋋",
        LeftTriangle: "⊲",
        LeftTriangleBar: "⧏",
        LeftTriangleEqual: "⊴",
        LeftUpDownVector: "⥑",
        LeftUpTeeVector: "⥠",
        LeftUpVector: "↿",
        LeftUpVectorBar: "⥘",
        LeftVector: "↼",
        LeftVectorBar: "⥒",
        lEg: "⪋",
        leg: "⋚",
        leq: "≤",
        leqq: "≦",
        leqslant: "⩽",
        les: "⩽",
        lescc: "⪨",
        lesdot: "⩿",
        lesdoto: "⪁",
        lesdotor: "⪃",
        lesg: "⋚︀",
        lesges: "⪓",
        lessapprox: "⪅",
        lessdot: "⋖",
        lesseqgtr: "⋚",
        lesseqqgtr: "⪋",
        LessEqualGreater: "⋚",
        LessFullEqual: "≦",
        LessGreater: "≶",
        lessgtr: "≶",
        LessLess: "⪡",
        lesssim: "≲",
        LessSlantEqual: "⩽",
        LessTilde: "≲",
        lfisht: "⥼",
        lfloor: "⌊",
        Lfr: "𝔏",
        lfr: "𝔩",
        lg: "≶",
        lgE: "⪑",
        lHar: "⥢",
        lhard: "↽",
        lharu: "↼",
        lharul: "⥪",
        lhblk: "▄",
        LJcy: "Љ",
        ljcy: "љ",
        Ll: "⋘",
        ll: "≪",
        llarr: "⇇",
        llcorner: "⌞",
        Lleftarrow: "⇚",
        llhard: "⥫",
        lltri: "◺",
        Lmidot: "Ŀ",
        lmidot: "ŀ",
        lmoust: "⎰",
        lmoustache: "⎰",
        lnap: "⪉",
        lnapprox: "⪉",
        lnE: "≨",
        lne: "⪇",
        lneq: "⪇",
        lneqq: "≨",
        lnsim: "⋦",
        loang: "⟬",
        loarr: "⇽",
        lobrk: "⟦",
        LongLeftArrow: "⟵",
        Longleftarrow: "⟸",
        longleftarrow: "⟵",
        LongLeftRightArrow: "⟷",
        Longleftrightarrow: "⟺",
        longleftrightarrow: "⟷",
        longmapsto: "⟼",
        LongRightArrow: "⟶",
        Longrightarrow: "⟹",
        longrightarrow: "⟶",
        looparrowleft: "↫",
        looparrowright: "↬",
        lopar: "⦅",
        Lopf: "𝕃",
        lopf: "𝕝",
        loplus: "⨭",
        lotimes: "⨴",
        lowast: "∗",
        lowbar: "_",
        LowerLeftArrow: "↙",
        LowerRightArrow: "↘",
        loz: "◊",
        lozenge: "◊",
        lozf: "⧫",
        lpar: "(",
        lparlt: "⦓",
        lrarr: "⇆",
        lrcorner: "⌟",
        lrhar: "⇋",
        lrhard: "⥭",
        lrm: "‎",
        lrtri: "⊿",
        lsaquo: "‹",
        Lscr: "ℒ",
        lscr: "𝓁",
        Lsh: "↰",
        lsh: "↰",
        lsim: "≲",
        lsime: "⪍",
        lsimg: "⪏",
        lsqb: "[",
        lsquo: "‘",
        lsquor: "‚",
        Lstrok: "Ł",
        lstrok: "ł",
        Lt: "≪",
        LT: "<",
        lt: "<",
        ltcc: "⪦",
        ltcir: "⩹",
        ltdot: "⋖",
        lthree: "⋋",
        ltimes: "⋉",
        ltlarr: "⥶",
        ltquest: "⩻",
        ltri: "◃",
        ltrie: "⊴",
        ltrif: "◂",
        ltrPar: "⦖",
        lurdshar: "⥊",
        luruhar: "⥦",
        lvertneqq: "≨︀",
        lvnE: "≨︀",
        macr: "¯",
        male: "♂",
        malt: "✠",
        maltese: "✠",
        Map: "⤅",
        map: "↦",
        mapsto: "↦",
        mapstodown: "↧",
        mapstoleft: "↤",
        mapstoup: "↥",
        marker: "▮",
        mcomma: "⨩",
        Mcy: "М",
        mcy: "м",
        mdash: "—",
        mDDot: "∺",
        measuredangle: "∡",
        MediumSpace: " ",
        Mellintrf: "ℳ",
        Mfr: "𝔐",
        mfr: "𝔪",
        mho: "℧",
        micro: "µ",
        mid: "∣",
        midast: "*",
        midcir: "⫰",
        middot: "·",
        minus: "−",
        minusb: "⊟",
        minusd: "∸",
        minusdu: "⨪",
        MinusPlus: "∓",
        mlcp: "⫛",
        mldr: "…",
        mnplus: "∓",
        models: "⊧",
        Mopf: "𝕄",
        mopf: "𝕞",
        mp: "∓",
        Mscr: "ℳ",
        mscr: "𝓂",
        mstpos: "∾",
        Mu: "Μ",
        mu: "μ",
        multimap: "⊸",
        mumap: "⊸",
        nabla: "∇",
        Nacute: "Ń",
        nacute: "ń",
        nang: "∠⃒",
        nap: "≉",
        napE: "⩰̸",
        napid: "≋̸",
        napos: "ŉ",
        napprox: "≉",
        natur: "♮",
        natural: "♮",
        naturals: "ℕ",
        nbsp: " ",
        nbump: "≎̸",
        nbumpe: "≏̸",
        ncap: "⩃",
        Ncaron: "Ň",
        ncaron: "ň",
        Ncedil: "Ņ",
        ncedil: "ņ",
        ncong: "≇",
        ncongdot: "⩭̸",
        ncup: "⩂",
        Ncy: "Н",
        ncy: "н",
        ndash: "–",
        ne: "≠",
        nearhk: "⤤",
        neArr: "⇗",
        nearr: "↗",
        nearrow: "↗",
        nedot: "≐̸",
        NegativeMediumSpace: "​",
        NegativeThickSpace: "​",
        NegativeThinSpace: "​",
        NegativeVeryThinSpace: "​",
        nequiv: "≢",
        nesear: "⤨",
        nesim: "≂̸",
        NestedGreaterGreater: "≫",
        NestedLessLess: "≪",
        NewLine: "\n",
        nexist: "∄",
        nexists: "∄",
        Nfr: "𝔑",
        nfr: "𝔫",
        ngE: "≧̸",
        nge: "≱",
        ngeq: "≱",
        ngeqq: "≧̸",
        ngeqslant: "⩾̸",
        nges: "⩾̸",
        nGg: "⋙̸",
        ngsim: "≵",
        nGt: "≫⃒",
        ngt: "≯",
        ngtr: "≯",
        nGtv: "≫̸",
        nhArr: "⇎",
        nharr: "↮",
        nhpar: "⫲",
        ni: "∋",
        nis: "⋼",
        nisd: "⋺",
        niv: "∋",
        NJcy: "Њ",
        njcy: "њ",
        nlArr: "⇍",
        nlarr: "↚",
        nldr: "‥",
        nlE: "≦̸",
        nle: "≰",
        nLeftarrow: "⇍",
        nleftarrow: "↚",
        nLeftrightarrow: "⇎",
        nleftrightarrow: "↮",
        nleq: "≰",
        nleqq: "≦̸",
        nleqslant: "⩽̸",
        nles: "⩽̸",
        nless: "≮",
        nLl: "⋘̸",
        nlsim: "≴",
        nLt: "≪⃒",
        nlt: "≮",
        nltri: "⋪",
        nltrie: "⋬",
        nLtv: "≪̸",
        nmid: "∤",
        NoBreak: "⁠",
        NonBreakingSpace: " ",
        Nopf: "ℕ",
        nopf: "𝕟",
        Not: "⫬",
        not: "¬",
        NotCongruent: "≢",
        NotCupCap: "≭",
        NotDoubleVerticalBar: "∦",
        NotElement: "∉",
        NotEqual: "≠",
        NotEqualTilde: "≂̸",
        NotExists: "∄",
        NotGreater: "≯",
        NotGreaterEqual: "≱",
        NotGreaterFullEqual: "≧̸",
        NotGreaterGreater: "≫̸",
        NotGreaterLess: "≹",
        NotGreaterSlantEqual: "⩾̸",
        NotGreaterTilde: "≵",
        NotHumpDownHump: "≎̸",
        NotHumpEqual: "≏̸",
        notin: "∉",
        notindot: "⋵̸",
        notinE: "⋹̸",
        notinva: "∉",
        notinvb: "⋷",
        notinvc: "⋶",
        NotLeftTriangle: "⋪",
        NotLeftTriangleBar: "⧏̸",
        NotLeftTriangleEqual: "⋬",
        NotLess: "≮",
        NotLessEqual: "≰",
        NotLessGreater: "≸",
        NotLessLess: "≪̸",
        NotLessSlantEqual: "⩽̸",
        NotLessTilde: "≴",
        NotNestedGreaterGreater: "⪢̸",
        NotNestedLessLess: "⪡̸",
        notni: "∌",
        notniva: "∌",
        notnivb: "⋾",
        notnivc: "⋽",
        NotPrecedes: "⊀",
        NotPrecedesEqual: "⪯̸",
        NotPrecedesSlantEqual: "⋠",
        NotReverseElement: "∌",
        NotRightTriangle: "⋫",
        NotRightTriangleBar: "⧐̸",
        NotRightTriangleEqual: "⋭",
        NotSquareSubset: "⊏̸",
        NotSquareSubsetEqual: "⋢",
        NotSquareSuperset: "⊐̸",
        NotSquareSupersetEqual: "⋣",
        NotSubset: "⊂⃒",
        NotSubsetEqual: "⊈",
        NotSucceeds: "⊁",
        NotSucceedsEqual: "⪰̸",
        NotSucceedsSlantEqual: "⋡",
        NotSucceedsTilde: "≿̸",
        NotSuperset: "⊃⃒",
        NotSupersetEqual: "⊉",
        NotTilde: "≁",
        NotTildeEqual: "≄",
        NotTildeFullEqual: "≇",
        NotTildeTilde: "≉",
        NotVerticalBar: "∤",
        npar: "∦",
        nparallel: "∦",
        nparsl: "⫽⃥",
        npart: "∂̸",
        npolint: "⨔",
        npr: "⊀",
        nprcue: "⋠",
        npre: "⪯̸",
        nprec: "⊀",
        npreceq: "⪯̸",
        nrArr: "⇏",
        nrarr: "↛",
        nrarrc: "⤳̸",
        nrarrw: "↝̸",
        nRightarrow: "⇏",
        nrightarrow: "↛",
        nrtri: "⋫",
        nrtrie: "⋭",
        nsc: "⊁",
        nsccue: "⋡",
        nsce: "⪰̸",
        Nscr: "𝒩",
        nscr: "𝓃",
        nshortmid: "∤",
        nshortparallel: "∦",
        nsim: "≁",
        nsime: "≄",
        nsimeq: "≄",
        nsmid: "∤",
        nspar: "∦",
        nsqsube: "⋢",
        nsqsupe: "⋣",
        nsub: "⊄",
        nsubE: "⫅̸",
        nsube: "⊈",
        nsubset: "⊂⃒",
        nsubseteq: "⊈",
        nsubseteqq: "⫅̸",
        nsucc: "⊁",
        nsucceq: "⪰̸",
        nsup: "⊅",
        nsupE: "⫆̸",
        nsupe: "⊉",
        nsupset: "⊃⃒",
        nsupseteq: "⊉",
        nsupseteqq: "⫆̸",
        ntgl: "≹",
        Ntilde: "Ñ",
        ntilde: "ñ",
        ntlg: "≸",
        ntriangleleft: "⋪",
        ntrianglelefteq: "⋬",
        ntriangleright: "⋫",
        ntrianglerighteq: "⋭",
        Nu: "Ν",
        nu: "ν",
        num: "#",
        numero: "№",
        numsp: " ",
        nvap: "≍⃒",
        nVDash: "⊯",
        nVdash: "⊮",
        nvDash: "⊭",
        nvdash: "⊬",
        nvge: "≥⃒",
        nvgt: ">⃒",
        nvHarr: "⤄",
        nvinfin: "⧞",
        nvlArr: "⤂",
        nvle: "≤⃒",
        nvlt: "<⃒",
        nvltrie: "⊴⃒",
        nvrArr: "⤃",
        nvrtrie: "⊵⃒",
        nvsim: "∼⃒",
        nwarhk: "⤣",
        nwArr: "⇖",
        nwarr: "↖",
        nwarrow: "↖",
        nwnear: "⤧",
        Oacute: "Ó",
        oacute: "ó",
        oast: "⊛",
        ocir: "⊚",
        Ocirc: "Ô",
        ocirc: "ô",
        Ocy: "О",
        ocy: "о",
        odash: "⊝",
        Odblac: "Ő",
        odblac: "ő",
        odiv: "⨸",
        odot: "⊙",
        odsold: "⦼",
        OElig: "Œ",
        oelig: "œ",
        ofcir: "⦿",
        Ofr: "𝔒",
        ofr: "𝔬",
        ogon: "˛",
        Ograve: "Ò",
        ograve: "ò",
        ogt: "⧁",
        ohbar: "⦵",
        ohm: "Ω",
        oint: "∮",
        olarr: "↺",
        olcir: "⦾",
        olcross: "⦻",
        oline: "‾",
        olt: "⧀",
        Omacr: "Ō",
        omacr: "ō",
        Omega: "Ω",
        omega: "ω",
        Omicron: "Ο",
        omicron: "ο",
        omid: "⦶",
        ominus: "⊖",
        Oopf: "𝕆",
        oopf: "𝕠",
        opar: "⦷",
        OpenCurlyDoubleQuote: "“",
        OpenCurlyQuote: "‘",
        operp: "⦹",
        oplus: "⊕",
        Or: "⩔",
        or: "∨",
        orarr: "↻",
        ord: "⩝",
        order: "ℴ",
        orderof: "ℴ",
        ordf: "ª",
        ordm: "º",
        origof: "⊶",
        oror: "⩖",
        orslope: "⩗",
        orv: "⩛",
        oS: "Ⓢ",
        Oscr: "𝒪",
        oscr: "ℴ",
        Oslash: "Ø",
        oslash: "ø",
        osol: "⊘",
        Otilde: "Õ",
        otilde: "õ",
        Otimes: "⨷",
        otimes: "⊗",
        otimesas: "⨶",
        Ouml: "Ö",
        ouml: "ö",
        ovbar: "⌽",
        OverBar: "‾",
        OverBrace: "⏞",
        OverBracket: "⎴",
        OverParenthesis: "⏜",
        par: "∥",
        para: "¶",
        parallel: "∥",
        parsim: "⫳",
        parsl: "⫽",
        part: "∂",
        PartialD: "∂",
        Pcy: "П",
        pcy: "п",
        percnt: "%",
        period: ".",
        permil: "‰",
        perp: "⊥",
        pertenk: "‱",
        Pfr: "𝔓",
        pfr: "𝔭",
        Phi: "Φ",
        phi: "φ",
        phiv: "ϕ",
        phmmat: "ℳ",
        phone: "☎",
        Pi: "Π",
        pi: "π",
        pitchfork: "⋔",
        piv: "ϖ",
        planck: "ℏ",
        planckh: "ℎ",
        plankv: "ℏ",
        plus: "+",
        plusacir: "⨣",
        plusb: "⊞",
        pluscir: "⨢",
        plusdo: "∔",
        plusdu: "⨥",
        pluse: "⩲",
        PlusMinus: "±",
        plusmn: "±",
        plussim: "⨦",
        plustwo: "⨧",
        pm: "±",
        Poincareplane: "ℌ",
        pointint: "⨕",
        Popf: "ℙ",
        popf: "𝕡",
        pound: "£",
        Pr: "⪻",
        pr: "≺",
        prap: "⪷",
        prcue: "≼",
        prE: "⪳",
        pre: "⪯",
        prec: "≺",
        precapprox: "⪷",
        preccurlyeq: "≼",
        Precedes: "≺",
        PrecedesEqual: "⪯",
        PrecedesSlantEqual: "≼",
        PrecedesTilde: "≾",
        preceq: "⪯",
        precnapprox: "⪹",
        precneqq: "⪵",
        precnsim: "⋨",
        precsim: "≾",
        Prime: "″",
        prime: "′",
        primes: "ℙ",
        prnap: "⪹",
        prnE: "⪵",
        prnsim: "⋨",
        prod: "∏",
        Product: "∏",
        profalar: "⌮",
        profline: "⌒",
        profsurf: "⌓",
        prop: "∝",
        Proportion: "∷",
        Proportional: "∝",
        propto: "∝",
        prsim: "≾",
        prurel: "⊰",
        Pscr: "𝒫",
        pscr: "𝓅",
        Psi: "Ψ",
        psi: "ψ",
        puncsp: " ",
        Qfr: "𝔔",
        qfr: "𝔮",
        qint: "⨌",
        Qopf: "ℚ",
        qopf: "𝕢",
        qprime: "⁗",
        Qscr: "𝒬",
        qscr: "𝓆",
        quaternions: "ℍ",
        quatint: "⨖",
        quest: "?",
        questeq: "≟",
        QUOT: '"',
        quot: '"',
        rAarr: "⇛",
        race: "∽̱",
        Racute: "Ŕ",
        racute: "ŕ",
        radic: "√",
        raemptyv: "⦳",
        Rang: "⟫",
        rang: "⟩",
        rangd: "⦒",
        range: "⦥",
        rangle: "⟩",
        raquo: "»",
        Rarr: "↠",
        rArr: "⇒",
        rarr: "→",
        rarrap: "⥵",
        rarrb: "⇥",
        rarrbfs: "⤠",
        rarrc: "⤳",
        rarrfs: "⤞",
        rarrhk: "↪",
        rarrlp: "↬",
        rarrpl: "⥅",
        rarrsim: "⥴",
        Rarrtl: "⤖",
        rarrtl: "↣",
        rarrw: "↝",
        rAtail: "⤜",
        ratail: "⤚",
        ratio: "∶",
        rationals: "ℚ",
        RBarr: "⤐",
        rBarr: "⤏",
        rbarr: "⤍",
        rbbrk: "❳",
        rbrace: "}",
        rbrack: "]",
        rbrke: "⦌",
        rbrksld: "⦎",
        rbrkslu: "⦐",
        Rcaron: "Ř",
        rcaron: "ř",
        Rcedil: "Ŗ",
        rcedil: "ŗ",
        rceil: "⌉",
        rcub: "}",
        Rcy: "Р",
        rcy: "р",
        rdca: "⤷",
        rdldhar: "⥩",
        rdquo: "”",
        rdquor: "”",
        rdsh: "↳",
        Re: "ℜ",
        real: "ℜ",
        realine: "ℛ",
        realpart: "ℜ",
        reals: "ℝ",
        rect: "▭",
        REG: "®",
        reg: "®",
        ReverseElement: "∋",
        ReverseEquilibrium: "⇋",
        ReverseUpEquilibrium: "⥯",
        rfisht: "⥽",
        rfloor: "⌋",
        Rfr: "ℜ",
        rfr: "𝔯",
        rHar: "⥤",
        rhard: "⇁",
        rharu: "⇀",
        rharul: "⥬",
        Rho: "Ρ",
        rho: "ρ",
        rhov: "ϱ",
        RightAngleBracket: "⟩",
        RightArrow: "→",
        Rightarrow: "⇒",
        rightarrow: "→",
        RightArrowBar: "⇥",
        RightArrowLeftArrow: "⇄",
        rightarrowtail: "↣",
        RightCeiling: "⌉",
        RightDoubleBracket: "⟧",
        RightDownTeeVector: "⥝",
        RightDownVector: "⇂",
        RightDownVectorBar: "⥕",
        RightFloor: "⌋",
        rightharpoondown: "⇁",
        rightharpoonup: "⇀",
        rightleftarrows: "⇄",
        rightleftharpoons: "⇌",
        rightrightarrows: "⇉",
        rightsquigarrow: "↝",
        RightTee: "⊢",
        RightTeeArrow: "↦",
        RightTeeVector: "⥛",
        rightthreetimes: "⋌",
        RightTriangle: "⊳",
        RightTriangleBar: "⧐",
        RightTriangleEqual: "⊵",
        RightUpDownVector: "⥏",
        RightUpTeeVector: "⥜",
        RightUpVector: "↾",
        RightUpVectorBar: "⥔",
        RightVector: "⇀",
        RightVectorBar: "⥓",
        ring: "˚",
        risingdotseq: "≓",
        rlarr: "⇄",
        rlhar: "⇌",
        rlm: "‏",
        rmoust: "⎱",
        rmoustache: "⎱",
        rnmid: "⫮",
        roang: "⟭",
        roarr: "⇾",
        robrk: "⟧",
        ropar: "⦆",
        Ropf: "ℝ",
        ropf: "𝕣",
        roplus: "⨮",
        rotimes: "⨵",
        RoundImplies: "⥰",
        rpar: ")",
        rpargt: "⦔",
        rppolint: "⨒",
        rrarr: "⇉",
        Rrightarrow: "⇛",
        rsaquo: "›",
        Rscr: "ℛ",
        rscr: "𝓇",
        Rsh: "↱",
        rsh: "↱",
        rsqb: "]",
        rsquo: "’",
        rsquor: "’",
        rthree: "⋌",
        rtimes: "⋊",
        rtri: "▹",
        rtrie: "⊵",
        rtrif: "▸",
        rtriltri: "⧎",
        RuleDelayed: "⧴",
        ruluhar: "⥨",
        rx: "℞",
        Sacute: "Ś",
        sacute: "ś",
        sbquo: "‚",
        Sc: "⪼",
        sc: "≻",
        scap: "⪸",
        Scaron: "Š",
        scaron: "š",
        sccue: "≽",
        scE: "⪴",
        sce: "⪰",
        Scedil: "Ş",
        scedil: "ş",
        Scirc: "Ŝ",
        scirc: "ŝ",
        scnap: "⪺",
        scnE: "⪶",
        scnsim: "⋩",
        scpolint: "⨓",
        scsim: "≿",
        Scy: "С",
        scy: "с",
        sdot: "⋅",
        sdotb: "⊡",
        sdote: "⩦",
        searhk: "⤥",
        seArr: "⇘",
        searr: "↘",
        searrow: "↘",
        sect: "§",
        semi: ";",
        seswar: "⤩",
        setminus: "∖",
        setmn: "∖",
        sext: "✶",
        Sfr: "𝔖",
        sfr: "𝔰",
        sfrown: "⌢",
        sharp: "♯",
        SHCHcy: "Щ",
        shchcy: "щ",
        SHcy: "Ш",
        shcy: "ш",
        ShortDownArrow: "↓",
        ShortLeftArrow: "←",
        shortmid: "∣",
        shortparallel: "∥",
        ShortRightArrow: "→",
        ShortUpArrow: "↑",
        shy: "­",
        Sigma: "Σ",
        sigma: "σ",
        sigmaf: "ς",
        sigmav: "ς",
        sim: "∼",
        simdot: "⩪",
        sime: "≃",
        simeq: "≃",
        simg: "⪞",
        simgE: "⪠",
        siml: "⪝",
        simlE: "⪟",
        simne: "≆",
        simplus: "⨤",
        simrarr: "⥲",
        slarr: "←",
        SmallCircle: "∘",
        smallsetminus: "∖",
        smashp: "⨳",
        smeparsl: "⧤",
        smid: "∣",
        smile: "⌣",
        smt: "⪪",
        smte: "⪬",
        smtes: "⪬︀",
        SOFTcy: "Ь",
        softcy: "ь",
        sol: "/",
        solb: "⧄",
        solbar: "⌿",
        Sopf: "𝕊",
        sopf: "𝕤",
        spades: "♠",
        spadesuit: "♠",
        spar: "∥",
        sqcap: "⊓",
        sqcaps: "⊓︀",
        sqcup: "⊔",
        sqcups: "⊔︀",
        Sqrt: "√",
        sqsub: "⊏",
        sqsube: "⊑",
        sqsubset: "⊏",
        sqsubseteq: "⊑",
        sqsup: "⊐",
        sqsupe: "⊒",
        sqsupset: "⊐",
        sqsupseteq: "⊒",
        squ: "□",
        Square: "□",
        square: "□",
        SquareIntersection: "⊓",
        SquareSubset: "⊏",
        SquareSubsetEqual: "⊑",
        SquareSuperset: "⊐",
        SquareSupersetEqual: "⊒",
        SquareUnion: "⊔",
        squarf: "▪",
        squf: "▪",
        srarr: "→",
        Sscr: "𝒮",
        sscr: "𝓈",
        ssetmn: "∖",
        ssmile: "⌣",
        sstarf: "⋆",
        Star: "⋆",
        star: "☆",
        starf: "★",
        straightepsilon: "ϵ",
        straightphi: "ϕ",
        strns: "¯",
        Sub: "⋐",
        sub: "⊂",
        subdot: "⪽",
        subE: "⫅",
        sube: "⊆",
        subedot: "⫃",
        submult: "⫁",
        subnE: "⫋",
        subne: "⊊",
        subplus: "⪿",
        subrarr: "⥹",
        Subset: "⋐",
        subset: "⊂",
        subseteq: "⊆",
        subseteqq: "⫅",
        SubsetEqual: "⊆",
        subsetneq: "⊊",
        subsetneqq: "⫋",
        subsim: "⫇",
        subsub: "⫕",
        subsup: "⫓",
        succ: "≻",
        succapprox: "⪸",
        succcurlyeq: "≽",
        Succeeds: "≻",
        SucceedsEqual: "⪰",
        SucceedsSlantEqual: "≽",
        SucceedsTilde: "≿",
        succeq: "⪰",
        succnapprox: "⪺",
        succneqq: "⪶",
        succnsim: "⋩",
        succsim: "≿",
        SuchThat: "∋",
        Sum: "∑",
        sum: "∑",
        sung: "♪",
        Sup: "⋑",
        sup: "⊃",
        sup1: "¹",
        sup2: "²",
        sup3: "³",
        supdot: "⪾",
        supdsub: "⫘",
        supE: "⫆",
        supe: "⊇",
        supedot: "⫄",
        Superset: "⊃",
        SupersetEqual: "⊇",
        suphsol: "⟉",
        suphsub: "⫗",
        suplarr: "⥻",
        supmult: "⫂",
        supnE: "⫌",
        supne: "⊋",
        supplus: "⫀",
        Supset: "⋑",
        supset: "⊃",
        supseteq: "⊇",
        supseteqq: "⫆",
        supsetneq: "⊋",
        supsetneqq: "⫌",
        supsim: "⫈",
        supsub: "⫔",
        supsup: "⫖",
        swarhk: "⤦",
        swArr: "⇙",
        swarr: "↙",
        swarrow: "↙",
        swnwar: "⤪",
        szlig: "ß",
        Tab: "	",
        target: "⌖",
        Tau: "Τ",
        tau: "τ",
        tbrk: "⎴",
        Tcaron: "Ť",
        tcaron: "ť",
        Tcedil: "Ţ",
        tcedil: "ţ",
        Tcy: "Т",
        tcy: "т",
        tdot: "⃛",
        telrec: "⌕",
        Tfr: "𝔗",
        tfr: "𝔱",
        there4: "∴",
        Therefore: "∴",
        therefore: "∴",
        Theta: "Θ",
        theta: "θ",
        thetasym: "ϑ",
        thetav: "ϑ",
        thickapprox: "≈",
        thicksim: "∼",
        ThickSpace: "  ",
        thinsp: " ",
        ThinSpace: " ",
        thkap: "≈",
        thksim: "∼",
        THORN: "Þ",
        thorn: "þ",
        Tilde: "∼",
        tilde: "˜",
        TildeEqual: "≃",
        TildeFullEqual: "≅",
        TildeTilde: "≈",
        times: "×",
        timesb: "⊠",
        timesbar: "⨱",
        timesd: "⨰",
        tint: "∭",
        toea: "⤨",
        top: "⊤",
        topbot: "⌶",
        topcir: "⫱",
        Topf: "𝕋",
        topf: "𝕥",
        topfork: "⫚",
        tosa: "⤩",
        tprime: "‴",
        TRADE: "™",
        trade: "™",
        triangle: "▵",
        triangledown: "▿",
        triangleleft: "◃",
        trianglelefteq: "⊴",
        triangleq: "≜",
        triangleright: "▹",
        trianglerighteq: "⊵",
        tridot: "◬",
        trie: "≜",
        triminus: "⨺",
        TripleDot: "⃛",
        triplus: "⨹",
        trisb: "⧍",
        tritime: "⨻",
        trpezium: "⏢",
        Tscr: "𝒯",
        tscr: "𝓉",
        TScy: "Ц",
        tscy: "ц",
        TSHcy: "Ћ",
        tshcy: "ћ",
        Tstrok: "Ŧ",
        tstrok: "ŧ",
        twixt: "≬",
        twoheadleftarrow: "↞",
        twoheadrightarrow: "↠",
        Uacute: "Ú",
        uacute: "ú",
        Uarr: "↟",
        uArr: "⇑",
        uarr: "↑",
        Uarrocir: "⥉",
        Ubrcy: "Ў",
        ubrcy: "ў",
        Ubreve: "Ŭ",
        ubreve: "ŭ",
        Ucirc: "Û",
        ucirc: "û",
        Ucy: "У",
        ucy: "у",
        udarr: "⇅",
        Udblac: "Ű",
        udblac: "ű",
        udhar: "⥮",
        ufisht: "⥾",
        Ufr: "𝔘",
        ufr: "𝔲",
        Ugrave: "Ù",
        ugrave: "ù",
        uHar: "⥣",
        uharl: "↿",
        uharr: "↾",
        uhblk: "▀",
        ulcorn: "⌜",
        ulcorner: "⌜",
        ulcrop: "⌏",
        ultri: "◸",
        Umacr: "Ū",
        umacr: "ū",
        uml: "¨",
        UnderBar: "_",
        UnderBrace: "⏟",
        UnderBracket: "⎵",
        UnderParenthesis: "⏝",
        Union: "⋃",
        UnionPlus: "⊎",
        Uogon: "Ų",
        uogon: "ų",
        Uopf: "𝕌",
        uopf: "𝕦",
        UpArrow: "↑",
        Uparrow: "⇑",
        uparrow: "↑",
        UpArrowBar: "⤒",
        UpArrowDownArrow: "⇅",
        UpDownArrow: "↕",
        Updownarrow: "⇕",
        updownarrow: "↕",
        UpEquilibrium: "⥮",
        upharpoonleft: "↿",
        upharpoonright: "↾",
        uplus: "⊎",
        UpperLeftArrow: "↖",
        UpperRightArrow: "↗",
        Upsi: "ϒ",
        upsi: "υ",
        upsih: "ϒ",
        Upsilon: "Υ",
        upsilon: "υ",
        UpTee: "⊥",
        UpTeeArrow: "↥",
        upuparrows: "⇈",
        urcorn: "⌝",
        urcorner: "⌝",
        urcrop: "⌎",
        Uring: "Ů",
        uring: "ů",
        urtri: "◹",
        Uscr: "𝒰",
        uscr: "𝓊",
        utdot: "⋰",
        Utilde: "Ũ",
        utilde: "ũ",
        utri: "▵",
        utrif: "▴",
        uuarr: "⇈",
        Uuml: "Ü",
        uuml: "ü",
        uwangle: "⦧",
        vangrt: "⦜",
        varepsilon: "ϵ",
        varkappa: "ϰ",
        varnothing: "∅",
        varphi: "ϕ",
        varpi: "ϖ",
        varpropto: "∝",
        vArr: "⇕",
        varr: "↕",
        varrho: "ϱ",
        varsigma: "ς",
        varsubsetneq: "⊊︀",
        varsubsetneqq: "⫋︀",
        varsupsetneq: "⊋︀",
        varsupsetneqq: "⫌︀",
        vartheta: "ϑ",
        vartriangleleft: "⊲",
        vartriangleright: "⊳",
        Vbar: "⫫",
        vBar: "⫨",
        vBarv: "⫩",
        Vcy: "В",
        vcy: "в",
        VDash: "⊫",
        Vdash: "⊩",
        vDash: "⊨",
        vdash: "⊢",
        Vdashl: "⫦",
        Vee: "⋁",
        vee: "∨",
        veebar: "⊻",
        veeeq: "≚",
        vellip: "⋮",
        Verbar: "‖",
        verbar: "|",
        Vert: "‖",
        vert: "|",
        VerticalBar: "∣",
        VerticalLine: "|",
        VerticalSeparator: "❘",
        VerticalTilde: "≀",
        VeryThinSpace: " ",
        Vfr: "𝔙",
        vfr: "𝔳",
        vltri: "⊲",
        vnsub: "⊂⃒",
        vnsup: "⊃⃒",
        Vopf: "𝕍",
        vopf: "𝕧",
        vprop: "∝",
        vrtri: "⊳",
        Vscr: "𝒱",
        vscr: "𝓋",
        vsubnE: "⫋︀",
        vsubne: "⊊︀",
        vsupnE: "⫌︀",
        vsupne: "⊋︀",
        Vvdash: "⊪",
        vzigzag: "⦚",
        Wcirc: "Ŵ",
        wcirc: "ŵ",
        wedbar: "⩟",
        Wedge: "⋀",
        wedge: "∧",
        wedgeq: "≙",
        weierp: "℘",
        Wfr: "𝔚",
        wfr: "𝔴",
        Wopf: "𝕎",
        wopf: "𝕨",
        wp: "℘",
        wr: "≀",
        wreath: "≀",
        Wscr: "𝒲",
        wscr: "𝓌",
        xcap: "⋂",
        xcirc: "◯",
        xcup: "⋃",
        xdtri: "▽",
        Xfr: "𝔛",
        xfr: "𝔵",
        xhArr: "⟺",
        xharr: "⟷",
        Xi: "Ξ",
        xi: "ξ",
        xlArr: "⟸",
        xlarr: "⟵",
        xmap: "⟼",
        xnis: "⋻",
        xodot: "⨀",
        Xopf: "𝕏",
        xopf: "𝕩",
        xoplus: "⨁",
        xotime: "⨂",
        xrArr: "⟹",
        xrarr: "⟶",
        Xscr: "𝒳",
        xscr: "𝓍",
        xsqcup: "⨆",
        xuplus: "⨄",
        xutri: "△",
        xvee: "⋁",
        xwedge: "⋀",
        Yacute: "Ý",
        yacute: "ý",
        YAcy: "Я",
        yacy: "я",
        Ycirc: "Ŷ",
        ycirc: "ŷ",
        Ycy: "Ы",
        ycy: "ы",
        yen: "¥",
        Yfr: "𝔜",
        yfr: "𝔶",
        YIcy: "Ї",
        yicy: "ї",
        Yopf: "𝕐",
        yopf: "𝕪",
        Yscr: "𝒴",
        yscr: "𝓎",
        YUcy: "Ю",
        yucy: "ю",
        Yuml: "Ÿ",
        yuml: "ÿ",
        Zacute: "Ź",
        zacute: "ź",
        Zcaron: "Ž",
        zcaron: "ž",
        Zcy: "З",
        zcy: "з",
        Zdot: "Ż",
        zdot: "ż",
        zeetrf: "ℨ",
        ZeroWidthSpace: "​",
        Zeta: "Ζ",
        zeta: "ζ",
        Zfr: "ℨ",
        zfr: "𝔷",
        ZHcy: "Ж",
        zhcy: "ж",
        zigrarr: "⇝",
        Zopf: "ℤ",
        zopf: "𝕫",
        Zscr: "𝒵",
        zscr: "𝓏",
        zwj: "‍",
        zwnj: "‌"
      });
      exports.entityMap = exports.HTML_ENTITIES;
    }
  });

  // node_modules/@xmldom/xmldom/lib/sax.js
  var require_sax = __commonJS({
    "node_modules/@xmldom/xmldom/lib/sax.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var g = require_grammar();
      var errors = require_errors();
      var isHTMLEscapableRawTextElement = conventions.isHTMLEscapableRawTextElement;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isHTMLRawTextElement = conventions.isHTMLRawTextElement;
      var hasOwn = conventions.hasOwn;
      var NAMESPACE = conventions.NAMESPACE;
      var ParseError = errors.ParseError;
      var DOMException = errors.DOMException;
      var S_TAG = 0;
      var S_ATTR = 1;
      var S_ATTR_SPACE = 2;
      var S_EQ = 3;
      var S_ATTR_NOQUOT_VALUE = 4;
      var S_ATTR_END = 5;
      var S_TAG_SPACE = 6;
      var S_TAG_CLOSE = 7;
      function XMLReader() {
      }
      XMLReader.prototype = {
        parse: function(source, defaultNSMap, entityMap) {
          var domBuilder = this.domBuilder;
          domBuilder.startDocument();
          _copy(defaultNSMap, defaultNSMap = /* @__PURE__ */ Object.create(null));
          parse2(source, defaultNSMap, entityMap, domBuilder, this.errorHandler);
          domBuilder.endDocument();
        }
      };
      var ENTITY_REG = /&#?\w+;?/g;
      function parse2(source, defaultNSMapCopy, entityMap, domBuilder, errorHandler) {
        var isHTML = isHTMLMimeType(domBuilder.mimeType);
        if (source.indexOf(g.UNICODE_REPLACEMENT_CHARACTER) >= 0) {
          errorHandler.warning("Unicode replacement character detected, source encoding issues?");
        }
        function fixedFromCharCode(code) {
          if (code > 65535) {
            code -= 65536;
            var surrogate1 = 55296 + (code >> 10), surrogate2 = 56320 + (code & 1023);
            return String.fromCharCode(surrogate1, surrogate2);
          } else {
            return String.fromCharCode(code);
          }
        }
        function entityReplacer(a2) {
          var complete = a2[a2.length - 1] === ";" ? a2 : a2 + ";";
          if (!isHTML && complete !== a2) {
            errorHandler.error("EntityRef: expecting ;");
            return a2;
          }
          var match = g.Reference.exec(complete);
          if (!match || match[0].length !== complete.length) {
            errorHandler.error("entity not matching Reference production: " + a2);
            return a2;
          }
          var k = complete.slice(1, -1);
          if (hasOwn(entityMap, k)) {
            return entityMap[k];
          } else if (k.charAt(0) === "#") {
            return fixedFromCharCode(parseInt(k.substring(1).replace("x", "0x")));
          } else {
            errorHandler.error("entity not found:" + a2);
            return a2;
          }
        }
        function appendText(end2) {
          if (end2 > start) {
            var xt = source.substring(start, end2).replace(ENTITY_REG, entityReplacer);
            locator && position(start);
            domBuilder.characters(xt, 0, end2 - start);
            start = end2;
          }
        }
        var lineStart = 0;
        var lineEnd = 0;
        var linePattern = /\r\n?|\n|$/g;
        var locator = domBuilder.locator;
        function position(p, m) {
          while (p >= lineEnd && (m = linePattern.exec(source))) {
            lineStart = lineEnd;
            lineEnd = m.index + m[0].length;
            locator.lineNumber++;
          }
          locator.columnNumber = p - lineStart + 1;
        }
        var parseStack = [{ currentNSMap: defaultNSMapCopy }];
        var unclosedTags = [];
        var start = 0;
        while (true) {
          try {
            var tagStart = source.indexOf("<", start);
            if (tagStart < 0) {
              if (!isHTML && unclosedTags.length > 0) {
                return errorHandler.fatalError("unclosed xml tag(s): " + unclosedTags.join(", "));
              }
              if (!source.substring(start).match(/^\s*$/)) {
                var doc = domBuilder.doc;
                var text = doc.createTextNode(source.substring(start));
                if (doc.documentElement) {
                  return errorHandler.error("Extra content at the end of the document");
                }
                doc.appendChild(text);
                domBuilder.currentElement = text;
              }
              return;
            }
            if (tagStart > start) {
              var fromSource = source.substring(start, tagStart);
              if (!isHTML && unclosedTags.length === 0) {
                fromSource = fromSource.replace(new RegExp(g.S_OPT.source, "g"), "");
                fromSource && errorHandler.error("Unexpected content outside root element: '" + fromSource + "'");
              }
              appendText(tagStart);
            }
            switch (source.charAt(tagStart + 1)) {
              case "/":
                var end = source.indexOf(">", tagStart + 2);
                var tagNameRaw = source.substring(tagStart + 2, end > 0 ? end : void 0);
                if (!tagNameRaw) {
                  return errorHandler.fatalError("end tag name missing");
                }
                var endTagNameStrict = g.reg("^", g.QName_group, g.S_OPT, "$");
                var tagNameMatch = end > 0 && endTagNameStrict.exec(tagNameRaw);
                if (!tagNameMatch) {
                  var leadingTagNameMatch = end > 0 && g.reg("^", g.QName_group).exec(tagNameRaw);
                  if (isHTML && leadingTagNameMatch) {
                    errorHandler.warning('end tag name contains invalid trailing characters: "' + tagNameRaw + '"');
                    tagNameMatch = leadingTagNameMatch;
                  } else if (
                    // Backward compatibility, remove this whole `else if` arm in the next breaking release
                    // (XML then falls through to the `fatalError` below, for a clean mode split: XML fatal,
                    // HTML warning). A valid end-tag name followed by a line break and trailing content was
                    // silently accepted while `reg` still used the `m` flag; re-adding `m` here matches exactly
                    // those inputs, kept recoverable and reported.
                    leadingTagNameMatch && new RegExp(endTagNameStrict.source, endTagNameStrict.flags + "m").test(tagNameRaw)
                  ) {
                    errorHandler.error('end tag name is followed by a line break and trailing content: "' + tagNameRaw + '"');
                    tagNameMatch = leadingTagNameMatch;
                  } else {
                    return errorHandler.fatalError('end tag name contains invalid characters: "' + tagNameRaw + '"');
                  }
                }
                if (!domBuilder.currentElement && !domBuilder.doc.documentElement) {
                  return;
                }
                var currentTagName = unclosedTags[unclosedTags.length - 1] || domBuilder.currentElement.tagName || domBuilder.doc.documentElement.tagName || "";
                if (currentTagName !== tagNameMatch[1]) {
                  var tagNameLower = tagNameMatch[1].toLowerCase();
                  if (!isHTML || currentTagName.toLowerCase() !== tagNameLower) {
                    return errorHandler.fatalError('Opening and ending tag mismatch: "' + currentTagName + '" != "' + tagNameRaw + '"');
                  }
                }
                var config = parseStack.pop();
                unclosedTags.pop();
                var localNSMap = config.localNSMap;
                domBuilder.endElement(config.uri, config.localName, currentTagName);
                if (localNSMap) {
                  for (var prefix in localNSMap) {
                    if (hasOwn(localNSMap, prefix)) {
                      domBuilder.endPrefixMapping(prefix);
                    }
                  }
                }
                end++;
                break;
              // end element
              case "?":
                locator && position(tagStart);
                end = parseProcessingInstruction(source, tagStart, domBuilder, errorHandler);
                break;
              case "!":
                locator && position(tagStart);
                end = parseDoctypeCommentOrCData(source, tagStart, domBuilder, errorHandler, isHTML);
                break;
              default:
                locator && position(tagStart);
                var el = new ElementAttributes();
                var currentNSMap = parseStack[parseStack.length - 1].currentNSMap;
                var end = parseElementStartPart(source, tagStart, el, currentNSMap, entityReplacer, errorHandler, isHTML);
                var len = el.length;
                if (!el.closed) {
                  if (isHTML && conventions.isHTMLVoidElement(el.tagName)) {
                    el.closed = true;
                  } else {
                    unclosedTags.push(el.tagName);
                  }
                }
                if (locator && len) {
                  var locator2 = copyLocator(locator, {});
                  for (var i = 0; i < len; i++) {
                    var a = el[i];
                    position(a.offset);
                    a.locator = copyLocator(locator, {});
                  }
                  domBuilder.locator = locator2;
                  if (appendElement(el, domBuilder, currentNSMap)) {
                    parseStack.push(el);
                  }
                  domBuilder.locator = locator;
                } else {
                  if (appendElement(el, domBuilder, currentNSMap)) {
                    parseStack.push(el);
                  }
                }
                if (isHTML && !el.closed) {
                  end = parseHtmlSpecialContent(source, end, el.tagName, entityReplacer, domBuilder);
                } else {
                  end++;
                }
            }
          } catch (e) {
            if (e instanceof ParseError) {
              throw e;
            } else if (e instanceof DOMException) {
              return errorHandler.fatalError("Error constructing the DOM: " + e.name + ": " + e.message, e);
            }
            errorHandler.error("element parse error: " + e);
            end = -1;
          }
          if (end > start) {
            start = end;
          } else {
            appendText(Math.max(tagStart, start) + 1);
          }
        }
      }
      function copyLocator(f, t) {
        t.lineNumber = f.lineNumber;
        t.columnNumber = f.columnNumber;
        return t;
      }
      function parseElementStartPart(source, start, el, currentNSMap, entityReplacer, errorHandler, isHTML) {
        function addAttribute(qname, value3, startIndex) {
          if (hasOwn(el.attributeNames, qname)) {
            return errorHandler.fatalError("Attribute " + qname + " redefined");
          }
          if (!isHTML && value3.indexOf("<") >= 0) {
            return errorHandler.fatalError("Unescaped '<' not allowed in attributes values");
          }
          el.addValue(
            qname,
            // @see https://www.w3.org/TR/xml/#AVNormalize
            // since the xmldom sax parser does not "interpret" DTD the following is not implemented:
            // - recursive replacement of (DTD) entity references
            // - trimming and collapsing multiple spaces into a single one for attributes that are not of type CDATA
            value3.replace(/[\t\n\r]/g, " ").replace(ENTITY_REG, entityReplacer),
            startIndex
          );
        }
        var attrName;
        var value2;
        var p = ++start;
        var s = S_TAG;
        while (true) {
          var c = source.charAt(p);
          if (s === S_TAG && c === "<") {
            throw new Error("unexpected < in tag name: " + source.slice(start, p));
          }
          switch (c) {
            case "=":
              if (s === S_ATTR) {
                attrName = source.slice(start, p);
                s = S_EQ;
              } else if (s === S_ATTR_SPACE) {
                s = S_EQ;
              } else {
                throw new Error("attribute equal must after attrName");
              }
              break;
            case "'":
            case '"':
              if (s === S_EQ || s === S_ATTR) {
                if (s === S_ATTR) {
                  errorHandler.warning('attribute value must after "="');
                  attrName = source.slice(start, p);
                }
                start = p + 1;
                p = source.indexOf(c, start);
                if (p > 0) {
                  value2 = source.slice(start, p);
                  addAttribute(attrName, value2, start - 1);
                  s = S_ATTR_END;
                } else {
                  throw new Error("attribute value no end '" + c + "' match");
                }
              } else if (s == S_ATTR_NOQUOT_VALUE) {
                value2 = source.slice(start, p);
                addAttribute(attrName, value2, start);
                errorHandler.warning('attribute "' + attrName + '" missed start quot(' + c + ")!!");
                start = p + 1;
                s = S_ATTR_END;
              } else {
                throw new Error('attribute value must after "="');
              }
              break;
            case "/":
              switch (s) {
                case S_TAG:
                  el.setTagName(source.slice(start, p));
                case S_ATTR_END:
                case S_TAG_SPACE:
                case S_TAG_CLOSE:
                  s = S_TAG_CLOSE;
                  el.closed = true;
                case S_ATTR_NOQUOT_VALUE:
                case S_ATTR:
                  break;
                case S_ATTR_SPACE:
                  el.closed = true;
                  break;
                //case S_EQ:
                default:
                  throw new Error("attribute invalid close char('/')");
              }
              break;
            case "":
              errorHandler.error("unexpected end of input");
              if (s == S_TAG) {
                el.setTagName(source.slice(start, p));
              }
              return p;
            case ">":
              switch (s) {
                case S_TAG:
                  el.setTagName(source.slice(start, p));
                case S_ATTR_END:
                case S_TAG_SPACE:
                case S_TAG_CLOSE:
                  break;
                //normal
                case S_ATTR_NOQUOT_VALUE:
                //Compatible state
                case S_ATTR:
                  value2 = source.slice(start, p);
                  if (value2.slice(-1) === "/") {
                    el.closed = true;
                    value2 = value2.slice(0, -1);
                  }
                case S_ATTR_SPACE:
                  if (s === S_ATTR_SPACE) {
                    value2 = attrName;
                  }
                  if (s == S_ATTR_NOQUOT_VALUE) {
                    errorHandler.warning('attribute "' + value2 + '" missed quot(")!');
                    addAttribute(attrName, value2, start);
                  } else {
                    if (!isHTML) {
                      errorHandler.warning('attribute "' + value2 + '" missed value!! "' + value2 + '" instead!!');
                    }
                    addAttribute(value2, value2, start);
                  }
                  break;
                case S_EQ:
                  if (!isHTML) {
                    return errorHandler.fatalError(`AttValue: ' or " expected`);
                  }
              }
              return p;
            /*xml space '\x20' | #x9 | #xD | #xA; */
            case "":
              c = " ";
            default:
              if (c <= " ") {
                switch (s) {
                  case S_TAG:
                    el.setTagName(source.slice(start, p));
                    s = S_TAG_SPACE;
                    break;
                  case S_ATTR:
                    attrName = source.slice(start, p);
                    s = S_ATTR_SPACE;
                    break;
                  case S_ATTR_NOQUOT_VALUE:
                    var value2 = source.slice(start, p);
                    errorHandler.warning('attribute "' + value2 + '" missed quot(")!!');
                    addAttribute(attrName, value2, start);
                  case S_ATTR_END:
                    s = S_TAG_SPACE;
                    break;
                }
              } else {
                switch (s) {
                  //case S_TAG:void();break;
                  //case S_ATTR:void();break;
                  //case S_ATTR_NOQUOT_VALUE:void();break;
                  case S_ATTR_SPACE:
                    if (!isHTML) {
                      errorHandler.warning('attribute "' + attrName + '" missed value!! "' + attrName + '" instead2!!');
                    }
                    addAttribute(attrName, attrName, start);
                    start = p;
                    s = S_ATTR;
                    break;
                  case S_ATTR_END:
                    errorHandler.warning('attribute space is required"' + attrName + '"!!');
                  case S_TAG_SPACE:
                    s = S_ATTR;
                    start = p;
                    break;
                  case S_EQ:
                    s = S_ATTR_NOQUOT_VALUE;
                    start = p;
                    break;
                  case S_TAG_CLOSE:
                    throw new Error("elements closed character '/' and '>' must be connected to");
                }
              }
          }
          p++;
        }
      }
      function appendElement(el, domBuilder, currentNSMap) {
        var tagName = el.tagName;
        var localNSMap = null;
        var i = el.length;
        while (i--) {
          var a = el[i];
          var qName = a.qName;
          var value2 = a.value;
          var nsp = qName.indexOf(":");
          if (nsp > 0) {
            var prefix = a.prefix = qName.slice(0, nsp);
            var localName = qName.slice(nsp + 1);
            var nsPrefix = prefix === "xmlns" && localName;
          } else {
            localName = qName;
            prefix = null;
            nsPrefix = qName === "xmlns" && "";
          }
          a.localName = localName;
          if (nsPrefix !== false) {
            if (localNSMap == null) {
              localNSMap = /* @__PURE__ */ Object.create(null);
              currentNSMap = Object.create(currentNSMap);
            }
            currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value2;
            a.uri = NAMESPACE.XMLNS;
            domBuilder.startPrefixMapping(nsPrefix, value2);
          }
        }
        var i = el.length;
        while (i--) {
          a = el[i];
          if (a.prefix) {
            if (a.prefix === "xml") {
              a.uri = NAMESPACE.XML;
            }
            if (a.prefix !== "xmlns") {
              a.uri = currentNSMap[a.prefix];
            }
          }
        }
        var nsp = tagName.indexOf(":");
        if (nsp > 0) {
          prefix = el.prefix = tagName.slice(0, nsp);
          localName = el.localName = tagName.slice(nsp + 1);
        } else {
          prefix = null;
          localName = el.localName = tagName;
        }
        var ns = el.uri = currentNSMap[prefix || ""];
        domBuilder.startElement(ns, localName, tagName, el);
        if (el.closed) {
          domBuilder.endElement(ns, localName, tagName);
          if (localNSMap) {
            for (prefix in localNSMap) {
              if (hasOwn(localNSMap, prefix)) {
                domBuilder.endPrefixMapping(prefix);
              }
            }
          }
        } else {
          el.currentNSMap = currentNSMap;
          el.localNSMap = localNSMap;
          return true;
        }
      }
      function parseHtmlSpecialContent(source, elStartEnd, tagName, entityReplacer, domBuilder) {
        var isEscapableRaw = isHTMLEscapableRawTextElement(tagName);
        if (isEscapableRaw || isHTMLRawTextElement(tagName)) {
          var closeTag = new RegExp("</" + tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ">", "ig");
          closeTag.lastIndex = elStartEnd;
          var match = closeTag.exec(source);
          var elEndStart = match ? match.index : -1;
          if (elEndStart < 0) {
            return elStartEnd + 1;
          }
          var text = source.substring(elStartEnd + 1, elEndStart);
          if (isEscapableRaw) {
            text = text.replace(ENTITY_REG, entityReplacer);
          }
          domBuilder.characters(text, 0, text.length);
          return elEndStart;
        }
        return elStartEnd + 1;
      }
      function _copy(source, target) {
        for (var n in source) {
          if (hasOwn(source, n)) {
            target[n] = source[n];
          }
        }
      }
      function parseUtils(source, start) {
        var index = start;
        function char(n) {
          n = n || 0;
          return source.charAt(index + n);
        }
        function skip(n) {
          n = n || 1;
          index += n;
        }
        function skipBlanks() {
          var blanks = 0;
          while (index < source.length) {
            var c = char();
            if (c !== " " && c !== "\n" && c !== "	" && c !== "\r") {
              return blanks;
            }
            blanks++;
            skip();
          }
          return -1;
        }
        function substringFromIndex() {
          return source.substring(index);
        }
        function substringStartsWith(text) {
          return source.substring(index, index + text.length) === text;
        }
        function substringStartsWithCaseInsensitive(text) {
          return source.substring(index, index + text.length).toUpperCase() === text.toUpperCase();
        }
        function getMatch(args) {
          var expr = g.reg("^", args);
          var match = expr.exec(substringFromIndex());
          if (match) {
            skip(match[0].length);
            return match[0];
          }
          return null;
        }
        return {
          char,
          getIndex: function() {
            return index;
          },
          getMatch,
          getSource: function() {
            return source;
          },
          skip,
          skipBlanks,
          substringFromIndex,
          substringStartsWith,
          substringStartsWithCaseInsensitive
        };
      }
      function parseDoctypeInternalSubset(p, errorHandler) {
        function parsePI(p2, errorHandler2) {
          var match = g.PI.exec(p2.substringFromIndex());
          if (!match) {
            return errorHandler2.fatalError("processing instruction is not well-formed at position " + p2.getIndex());
          }
          if (match[1].toLowerCase() === "xml") {
            return errorHandler2.fatalError(
              "xml declaration is only allowed at the start of the document, but found at position " + p2.getIndex()
            );
          }
          p2.skip(match[0].length);
          return match[0];
        }
        var source = p.getSource();
        if (p.char() === "[") {
          p.skip(1);
          var intSubsetStart = p.getIndex();
          while (p.getIndex() < source.length) {
            p.skipBlanks();
            if (p.char() === "]") {
              var internalSubset = source.substring(intSubsetStart, p.getIndex());
              p.skip(1);
              return internalSubset;
            }
            var current = null;
            if (p.char() === "<" && p.char(1) === "!") {
              switch (p.char(2)) {
                case "E":
                  if (p.char(3) === "L") {
                    current = p.getMatch(g.elementdecl);
                  } else if (p.char(3) === "N") {
                    current = p.getMatch(g.EntityDecl);
                  }
                  break;
                case "A":
                  current = p.getMatch(g.AttlistDecl);
                  break;
                case "N":
                  current = p.getMatch(g.NotationDecl);
                  break;
                case "-":
                  current = p.getMatch(g.Comment);
                  break;
              }
            } else if (p.char() === "<" && p.char(1) === "?") {
              current = parsePI(p, errorHandler);
            } else if (p.char() === "%") {
              current = p.getMatch(g.PEReference);
            } else {
              return errorHandler.fatalError("Error detected in Markup declaration");
            }
            if (!current) {
              return errorHandler.fatalError("Error in internal subset at position " + p.getIndex());
            }
          }
          return errorHandler.fatalError("doctype internal subset is not well-formed, missing ]");
        }
      }
      function parseDoctypeCommentOrCData(source, start, domBuilder, errorHandler, isHTML) {
        var p = parseUtils(source, start);
        switch (isHTML ? p.char(2).toUpperCase() : p.char(2)) {
          case "-":
            var comment = p.getMatch(g.Comment);
            if (comment) {
              domBuilder.comment(comment, g.COMMENT_START.length, comment.length - g.COMMENT_START.length - g.COMMENT_END.length);
              return p.getIndex();
            } else {
              return errorHandler.fatalError("comment is not well-formed at position " + p.getIndex());
            }
          case "[":
            var cdata = p.getMatch(g.CDSect);
            if (cdata) {
              if (!isHTML && !domBuilder.currentElement) {
                return errorHandler.fatalError("CDATA outside of element");
              }
              domBuilder.startCDATA();
              domBuilder.characters(cdata, g.CDATA_START.length, cdata.length - g.CDATA_START.length - g.CDATA_END.length);
              domBuilder.endCDATA();
              return p.getIndex();
            } else {
              return errorHandler.fatalError("Invalid CDATA starting at position " + start);
            }
          case "D": {
            if (domBuilder.doc && domBuilder.doc.documentElement) {
              return errorHandler.fatalError("Doctype not allowed inside or after documentElement at position " + p.getIndex());
            }
            if (isHTML ? !p.substringStartsWithCaseInsensitive(g.DOCTYPE_DECL_START) : !p.substringStartsWith(g.DOCTYPE_DECL_START)) {
              return errorHandler.fatalError("Expected " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
            }
            p.skip(g.DOCTYPE_DECL_START.length);
            if (p.skipBlanks() < 1) {
              return errorHandler.fatalError("Expected whitespace after " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
            }
            var doctype = {
              name: void 0,
              publicId: void 0,
              systemId: void 0,
              internalSubset: void 0
            };
            doctype.name = p.getMatch(g.Name);
            if (!doctype.name)
              return errorHandler.fatalError("doctype name missing or contains unexpected characters at position " + p.getIndex());
            if (isHTML && doctype.name.toLowerCase() !== "html") {
              errorHandler.warning("Unexpected DOCTYPE in HTML document at position " + p.getIndex());
            }
            p.skipBlanks();
            if (p.substringStartsWith(g.PUBLIC) || p.substringStartsWith(g.SYSTEM)) {
              var match = g.ExternalID_match.exec(p.substringFromIndex());
              if (!match) {
                return errorHandler.fatalError("doctype external id is not well-formed at position " + p.getIndex());
              }
              if (match.groups.SystemLiteralOnly !== void 0) {
                doctype.systemId = match.groups.SystemLiteralOnly;
              } else {
                doctype.systemId = match.groups.SystemLiteral;
                doctype.publicId = match.groups.PubidLiteral;
              }
              p.skip(match[0].length);
            } else if (isHTML && p.substringStartsWithCaseInsensitive(g.SYSTEM)) {
              p.skip(g.SYSTEM.length);
              if (p.skipBlanks() < 1) {
                return errorHandler.fatalError("Expected whitespace after " + g.SYSTEM + " at position " + p.getIndex());
              }
              doctype.systemId = p.getMatch(g.ABOUT_LEGACY_COMPAT_SystemLiteral);
              if (!doctype.systemId) {
                return errorHandler.fatalError(
                  "Expected " + g.ABOUT_LEGACY_COMPAT + " in single or double quotes after " + g.SYSTEM + " at position " + p.getIndex()
                );
              }
            }
            if (isHTML && doctype.systemId && !g.ABOUT_LEGACY_COMPAT_SystemLiteral.test(doctype.systemId)) {
              errorHandler.warning("Unexpected doctype.systemId in HTML document at position " + p.getIndex());
            }
            if (!isHTML) {
              p.skipBlanks();
              doctype.internalSubset = parseDoctypeInternalSubset(p, errorHandler);
            }
            p.skipBlanks();
            if (p.char() !== ">") {
              return errorHandler.fatalError("doctype not terminated with > at position " + p.getIndex());
            }
            p.skip(1);
            domBuilder.startDTD(doctype.name, doctype.publicId, doctype.systemId, doctype.internalSubset);
            domBuilder.endDTD();
            return p.getIndex();
          }
          default:
            return errorHandler.fatalError('Not well-formed XML starting with "<!" at position ' + start);
        }
      }
      function parseProcessingInstruction(source, start, domBuilder, errorHandler) {
        var match = source.substring(start).match(g.PI);
        if (!match) {
          return errorHandler.fatalError("Invalid processing instruction starting at position " + start);
        }
        if (match[1].toLowerCase() === "xml") {
          if (start > 0) {
            return errorHandler.fatalError(
              "processing instruction at position " + start + " is an xml declaration which is only at the start of the document"
            );
          }
          if (!g.XMLDecl.test(source.substring(start))) {
            return errorHandler.fatalError("xml declaration is not well-formed");
          }
        }
        domBuilder.processingInstruction(match[1], match[2]);
        return start + match[0].length;
      }
      function ElementAttributes() {
        this.attributeNames = /* @__PURE__ */ Object.create(null);
      }
      ElementAttributes.prototype = {
        setTagName: function(tagName) {
          if (!g.QName_exact.test(tagName)) {
            throw new Error("invalid tagName:" + tagName);
          }
          this.tagName = tagName;
        },
        addValue: function(qName, value2, offset) {
          if (!g.QName_exact.test(qName)) {
            throw new Error("invalid attribute:" + qName);
          }
          this.attributeNames[qName] = this.length;
          this[this.length++] = { qName, value: value2, offset };
        },
        length: 0,
        getLocalName: function(i) {
          return this[i].localName;
        },
        getLocator: function(i) {
          return this[i].locator;
        },
        getQName: function(i) {
          return this[i].qName;
        },
        getURI: function(i) {
          return this[i].uri;
        },
        getValue: function(i) {
          return this[i].value;
        }
        //	,getIndex:function(uri, localName)){
        //		if(localName){
        //
        //		}else{
        //			var qName = uri
        //		}
        //	},
        //	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
        //	getType:function(uri,localName){}
        //	getType:function(i){},
      };
      exports.XMLReader = XMLReader;
      exports.parseUtils = parseUtils;
      exports.parseDoctypeCommentOrCData = parseDoctypeCommentOrCData;
    }
  });

  // node_modules/@xmldom/xmldom/lib/dom-parser.js
  var require_dom_parser = __commonJS({
    "node_modules/@xmldom/xmldom/lib/dom-parser.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      var dom = require_dom();
      var errors = require_errors();
      var entities = require_entities();
      var sax = require_sax();
      var DOMImplementation = dom.DOMImplementation;
      var hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      var isHTMLMimeType = conventions.isHTMLMimeType;
      var isValidMimeType = conventions.isValidMimeType;
      var MIME_TYPE = conventions.MIME_TYPE;
      var NAMESPACE = conventions.NAMESPACE;
      var ParseError = errors.ParseError;
      var XMLReader = sax.XMLReader;
      function normalizeLineEndings(input) {
        return input.replace(/\r[\n\u0085]/g, "\n").replace(/[\r\u0085\u2028\u2029]/g, "\n");
      }
      function DOMParser2(options) {
        options = options || {};
        if (options.locator === void 0) {
          options.locator = true;
        }
        this.assign = options.assign || conventions.assign;
        this.domHandler = options.domHandler || DOMHandler;
        this.onError = options.onError || options.errorHandler;
        if (options.errorHandler && typeof options.errorHandler !== "function") {
          throw new TypeError("errorHandler object is no longer supported, switch to onError!");
        } else if (options.errorHandler) {
          options.errorHandler("warning", "The `errorHandler` option has been deprecated, use `onError` instead!", this);
        }
        this.normalizeLineEndings = options.normalizeLineEndings || normalizeLineEndings;
        this.locator = !!options.locator;
        this.xmlns = this.assign(/* @__PURE__ */ Object.create(null), options.xmlns);
      }
      DOMParser2.prototype.parseFromString = function(source, mimeType) {
        if (!isValidMimeType(mimeType)) {
          throw new TypeError('DOMParser.parseFromString: the provided mimeType "' + mimeType + '" is not valid.');
        }
        var defaultNSMap = this.assign(/* @__PURE__ */ Object.create(null), this.xmlns);
        var entityMap = entities.XML_ENTITIES;
        var defaultNamespace = defaultNSMap[""] || null;
        if (hasDefaultHTMLNamespace(mimeType)) {
          entityMap = entities.HTML_ENTITIES;
          defaultNamespace = NAMESPACE.HTML;
        } else if (mimeType === MIME_TYPE.XML_SVG_IMAGE) {
          defaultNamespace = NAMESPACE.SVG;
        }
        defaultNSMap[""] = defaultNamespace;
        defaultNSMap.xml = defaultNSMap.xml || NAMESPACE.XML;
        var domBuilder = new this.domHandler({
          mimeType,
          defaultNamespace,
          onError: this.onError
        });
        var locator = this.locator ? {} : void 0;
        if (this.locator) {
          domBuilder.setDocumentLocator(locator);
        }
        var sax2 = new XMLReader();
        sax2.errorHandler = domBuilder;
        sax2.domBuilder = domBuilder;
        var isXml = !conventions.isHTMLMimeType(mimeType);
        if (isXml && typeof source !== "string") {
          sax2.errorHandler.fatalError("source is not a string");
        }
        sax2.parse(this.normalizeLineEndings(String(source)), defaultNSMap, entityMap);
        if (!domBuilder.doc.documentElement) {
          sax2.errorHandler.fatalError("missing root element");
        }
        return domBuilder.doc;
      };
      function DOMHandler(options) {
        var opt = options || {};
        this.mimeType = opt.mimeType || MIME_TYPE.XML_APPLICATION;
        this.defaultNamespace = opt.defaultNamespace || null;
        this.cdata = false;
        this.currentElement = void 0;
        this.doc = void 0;
        this.locator = void 0;
        this.onError = opt.onError;
      }
      function position(locator, node) {
        node.lineNumber = locator.lineNumber;
        node.columnNumber = locator.columnNumber;
      }
      DOMHandler.prototype = {
        /**
         * Either creates an XML or an HTML document and stores it under `this.doc`.
         * If it is an XML document, `this.defaultNamespace` is used to create it,
         * and it will not contain any `childNodes`.
         * If it is an HTML document, it will be created without any `childNodes`.
         *
         * @see http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
         */
        startDocument: function() {
          var impl = new DOMImplementation();
          this.doc = isHTMLMimeType(this.mimeType) ? impl.createHTMLDocument(false) : impl.createDocument(this.defaultNamespace, "");
        },
        startElement: function(namespaceURI, localName, qName, attrs) {
          var doc = this.doc;
          var el = doc.createElementNS(namespaceURI, qName || localName);
          var len = attrs.length;
          appendElement(this, el);
          this.currentElement = el;
          this.locator && position(this.locator, el);
          for (var i = 0; i < len; i++) {
            var namespaceURI = attrs.getURI(i);
            var value2 = attrs.getValue(i);
            var qName = attrs.getQName(i);
            var attr = doc.createAttributeNS(namespaceURI, qName);
            this.locator && position(attrs.getLocator(i), attr);
            attr.value = attr.nodeValue = value2;
            el.setAttributeNode(attr);
          }
        },
        endElement: function(namespaceURI, localName, qName) {
          this.currentElement = this.currentElement.parentNode;
        },
        startPrefixMapping: function(prefix, uri) {
        },
        endPrefixMapping: function(prefix) {
        },
        processingInstruction: function(target, data) {
          var ins = this.doc.createProcessingInstruction(target, data);
          this.locator && position(this.locator, ins);
          appendElement(this, ins);
        },
        ignorableWhitespace: function(ch, start, length) {
        },
        characters: function(chars, start, length) {
          chars = _toString.apply(this, arguments);
          if (chars) {
            if (this.cdata) {
              var charNode = this.doc.createCDATASection(chars);
            } else {
              var charNode = this.doc.createTextNode(chars);
            }
            if (this.currentElement) {
              this.currentElement.appendChild(charNode);
            } else if (/^\s*$/.test(chars)) {
              this.doc.appendChild(charNode);
            }
            this.locator && position(this.locator, charNode);
          }
        },
        skippedEntity: function(name) {
        },
        endDocument: function() {
          this.doc.normalize();
        },
        /**
         * Stores the locator to be able to set the `columnNumber` and `lineNumber`
         * on the created DOM nodes.
         *
         * @param {Locator} locator
         */
        setDocumentLocator: function(locator) {
          if (locator) {
            locator.lineNumber = 0;
          }
          this.locator = locator;
        },
        //LexicalHandler
        comment: function(chars, start, length) {
          chars = _toString.apply(this, arguments);
          var comm = this.doc.createComment(chars);
          this.locator && position(this.locator, comm);
          appendElement(this, comm);
        },
        startCDATA: function() {
          this.cdata = true;
        },
        endCDATA: function() {
          this.cdata = false;
        },
        startDTD: function(name, publicId, systemId, internalSubset) {
          var impl = this.doc.implementation;
          if (impl && impl.createDocumentType) {
            var dt = impl.createDocumentType(name, publicId, systemId, internalSubset);
            this.locator && position(this.locator, dt);
            appendElement(this, dt);
            this.doc.doctype = dt;
          }
        },
        reportError: function(level, message) {
          if (typeof this.onError === "function") {
            try {
              this.onError(level, message, this);
            } catch (e) {
              throw new ParseError("Reporting " + level + ' "' + message + '" caused ' + e, this.locator);
            }
          } else {
            console.error("[xmldom " + level + "]	" + message, _locator(this.locator));
          }
        },
        /**
         * @see http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
         */
        warning: function(message) {
          this.reportError("warning", message);
        },
        error: function(message) {
          this.reportError("error", message);
        },
        /**
         * This function reports a fatal error and throws a ParseError.
         *
         * @param {string} message
         * - The message to be used for reporting and throwing the error.
         * @param {Error} [cause]
         * The error that caused this fatal error, preserved as the thrown `ParseError`'s `cause`.
         * @returns {never}
         * This function always throws an error and never returns a value.
         * @throws {ParseError}
         * Always throws a ParseError with the provided message.
         */
        fatalError: function(message, cause) {
          this.reportError("fatalError", message);
          throw new ParseError(message, this.locator, cause);
        }
      };
      function _locator(l) {
        if (l) {
          return "\n@#[line:" + l.lineNumber + ",col:" + l.columnNumber + "]";
        }
      }
      function _toString(chars, start, length) {
        if (typeof chars == "string") {
          return chars.substr(start, length);
        } else {
          if (chars.length >= start + length || start) {
            return new java.lang.String(chars, start, length) + "";
          }
          return chars;
        }
      }
      "endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(
        /\w+/g,
        function(key) {
          DOMHandler.prototype[key] = function() {
            return null;
          };
        }
      );
      function appendElement(handler, node) {
        if (!handler.currentElement) {
          handler.doc.appendChild(node);
        } else {
          handler.currentElement.appendChild(node);
        }
      }
      function onErrorStopParsing(level) {
        if (level === "error") throw "onErrorStopParsing";
      }
      function onWarningStopParsing() {
        throw "onWarningStopParsing";
      }
      exports.__DOMHandler = DOMHandler;
      exports.DOMParser = DOMParser2;
      exports.normalizeLineEndings = normalizeLineEndings;
      exports.onErrorStopParsing = onErrorStopParsing;
      exports.onWarningStopParsing = onWarningStopParsing;
    }
  });

  // node_modules/@xmldom/xmldom/lib/index.js
  var require_lib = __commonJS({
    "node_modules/@xmldom/xmldom/lib/index.js"(exports) {
      "use strict";
      var conventions = require_conventions();
      exports.assign = conventions.assign;
      exports.hasDefaultHTMLNamespace = conventions.hasDefaultHTMLNamespace;
      exports.isHTMLMimeType = conventions.isHTMLMimeType;
      exports.isValidMimeType = conventions.isValidMimeType;
      exports.MIME_TYPE = conventions.MIME_TYPE;
      exports.NAMESPACE = conventions.NAMESPACE;
      var errors = require_errors();
      exports.DOMException = errors.DOMException;
      exports.DOMExceptionName = errors.DOMExceptionName;
      exports.ExceptionCode = errors.ExceptionCode;
      exports.ParseError = errors.ParseError;
      var dom = require_dom();
      exports.Attr = dom.Attr;
      exports.CDATASection = dom.CDATASection;
      exports.CharacterData = dom.CharacterData;
      exports.Comment = dom.Comment;
      exports.Document = dom.Document;
      exports.DocumentFragment = dom.DocumentFragment;
      exports.DocumentType = dom.DocumentType;
      exports.DOMImplementation = dom.DOMImplementation;
      exports.Element = dom.Element;
      exports.Entity = dom.Entity;
      exports.EntityReference = dom.EntityReference;
      exports.LiveNodeList = dom.LiveNodeList;
      exports.NamedNodeMap = dom.NamedNodeMap;
      exports.Node = dom.Node;
      exports.NodeList = dom.NodeList;
      exports.Notation = dom.Notation;
      exports.ProcessingInstruction = dom.ProcessingInstruction;
      exports.Text = dom.Text;
      exports.XMLSerializer = dom.XMLSerializer;
      var domParser = require_dom_parser();
      exports.DOMParser = domParser.DOMParser;
      exports.normalizeLineEndings = domParser.normalizeLineEndings;
      exports.onErrorStopParsing = domParser.onErrorStopParsing;
      exports.onWarningStopParsing = domParser.onWarningStopParsing;
    }
  });

  // src/arch.js
  var arch_exports = {};
  __export(arch_exports, {
    ArchError: () => ArchError,
    getIconPacks: () => getIconPacks,
    getProfile: () => getProfile,
    getProfiles: () => getProfiles,
    help: () => help,
    inspectSource: () => inspectSource,
    layout: () => layout2,
    parse: () => parse,
    registerIconPack: () => registerIconPack,
    registerProfile: () => registerProfile,
    render: () => render,
    renderAll: () => renderAll,
    renderIconToString: () => renderIconToString,
    renderMarkdown: () => renderMarkdown,
    renderToString: () => renderToString,
    translate: () => translate,
    validate: () => validate2,
    version: () => version
  });

  // src/errors.js
  var ArchError = class extends Error {
    constructor(message, loc = {}, code = "ARCH_SYNTAX") {
      const detail = loc.path !== void 0 ? `${message} (JSON path ${loc.path || "/"})` : message;
      super(loc.line ? `${detail} (line ${loc.line}, column ${loc.column})` : detail);
      this.name = "ArchError";
      this.line = loc.line ?? null;
      this.column = loc.column ?? null;
      this.code = code;
      if (loc.path !== void 0) this.path = loc.path;
    }
  };

  // src/css3-colors.js
  var CSS3_COLORS = Object.freeze({
    "black": "#000000",
    "gray": "#808080",
    "maroon": "#800000",
    "purple": "#800080",
    "green": "#008000",
    "olive": "#808000",
    "navy": "#000080",
    "teal": "#008080",
    "aliceblue": "#f0f8ff",
    "antiquewhite": "#faebd7",
    "aqua": "#00ffff",
    "aquamarine": "#7fffd4",
    "azure": "#f0ffff",
    "beige": "#f5f5dc",
    "bisque": "#ffe4c4",
    "blanchedalmond": "#ffebcd",
    "blue": "#0000ff",
    "blueviolet": "#8a2be2",
    "brown": "#a52a2a",
    "burlywood": "#deb887",
    "cadetblue": "#5f9ea0",
    "chartreuse": "#7fff00",
    "chocolate": "#d2691e",
    "coral": "#ff7f50",
    "cornflowerblue": "#6495ed",
    "cornsilk": "#fff8dc",
    "crimson": "#dc143c",
    "cyan": "#00ffff",
    "darkblue": "#00008b",
    "darkcyan": "#008b8b",
    "darkgoldenrod": "#b8860b",
    "darkgray": "#a9a9a9",
    "darkgreen": "#006400",
    "darkgrey": "#a9a9a9",
    "darkkhaki": "#bdb76b",
    "darkmagenta": "#8b008b",
    "darkolivegreen": "#556b2f",
    "darkorange": "#ff8c00",
    "darkorchid": "#9932cc",
    "darkred": "#8b0000",
    "darksalmon": "#e9967a",
    "darkseagreen": "#8fbc8f",
    "darkslateblue": "#483d8b",
    "darkslategray": "#2f4f4f",
    "darkslategrey": "#2f4f4f",
    "darkturquoise": "#00ced1",
    "darkviolet": "#9400d3",
    "deeppink": "#ff1493",
    "deepskyblue": "#00bfff",
    "dimgray": "#696969",
    "dimgrey": "#696969",
    "dodgerblue": "#1e90ff",
    "firebrick": "#b22222",
    "floralwhite": "#fffaf0",
    "forestgreen": "#228b22",
    "fuchsia": "#ff00ff",
    "gainsboro": "#dcdcdc",
    "ghostwhite": "#f8f8ff",
    "gold": "#ffd700",
    "goldenrod": "#daa520",
    "greenyellow": "#adff2f",
    "grey": "#808080",
    "honeydew": "#f0fff0",
    "hotpink": "#ff69b4",
    "indianred": "#cd5c5c",
    "indigo": "#4b0082",
    "ivory": "#fffff0",
    "khaki": "#f0e68c",
    "lavender": "#e6e6fa",
    "lavenderblush": "#fff0f5",
    "lawngreen": "#7cfc00",
    "lemonchiffon": "#fffacd",
    "lightblue": "#add8e6",
    "lightcoral": "#f08080",
    "lightcyan": "#e0ffff",
    "lightgoldenrodyellow": "#fafad2",
    "lightgray": "#d3d3d3",
    "lightgreen": "#90ee90",
    "lightgrey": "#d3d3d3",
    "lightpink": "#ffb6c1",
    "lightsalmon": "#ffa07a",
    "lightseagreen": "#20b2aa",
    "lightskyblue": "#87cefa",
    "lightslategray": "#778899",
    "lightslategrey": "#778899",
    "lightsteelblue": "#b0c4de",
    "lightyellow": "#ffffe0",
    "lime": "#00ff00",
    "limegreen": "#32cd32",
    "linen": "#faf0e6",
    "magenta": "#ff00ff",
    "mediumaquamarine": "#66cdaa",
    "mediumblue": "#0000cd",
    "mediumorchid": "#ba55d3",
    "mediumpurple": "#9370db",
    "mediumseagreen": "#3cb371",
    "mediumslateblue": "#7b68ee",
    "mediumspringgreen": "#00fa9a",
    "mediumturquoise": "#48d1cc",
    "mediumvioletred": "#c71585",
    "midnightblue": "#191970",
    "mintcream": "#f5fffa",
    "mistyrose": "#ffe4e1",
    "moccasin": "#ffe4b5",
    "navajowhite": "#ffdead",
    "oldlace": "#fdf5e6",
    "olivedrab": "#6b8e23",
    "orange": "#ffa500",
    "orangered": "#ff4500",
    "orchid": "#da70d6",
    "palegoldenrod": "#eee8aa",
    "palegreen": "#98fb98",
    "paleturquoise": "#afeeee",
    "palevioletred": "#db7093",
    "papayawhip": "#ffefd5",
    "peachpuff": "#ffdab9",
    "peru": "#cd853f",
    "pink": "#ffc0cb",
    "plum": "#dda0dd",
    "powderblue": "#b0e0e6",
    "red": "#ff0000",
    "rosybrown": "#bc8f8f",
    "royalblue": "#4169e1",
    "saddlebrown": "#8b4513",
    "salmon": "#fa8072",
    "sandybrown": "#f4a460",
    "seagreen": "#2e8b57",
    "seashell": "#fff5ee",
    "sienna": "#a0522d",
    "silver": "#c0c0c0",
    "skyblue": "#87ceeb",
    "slateblue": "#6a5acd",
    "slategray": "#708090",
    "slategrey": "#708090",
    "snow": "#fffafa",
    "springgreen": "#00ff7f",
    "steelblue": "#4682b4",
    "tan": "#d2b48c",
    "thistle": "#d8bfd8",
    "tomato": "#ff6347",
    "turquoise": "#40e0d0",
    "violet": "#ee82ee",
    "wheat": "#f5deb3",
    "white": "#ffffff",
    "whitesmoke": "#f5f5f5",
    "yellow": "#ffff00",
    "yellowgreen": "#9acd32"
  });

  // src/colors.js
  function normalizeColor(value2) {
    if (typeof value2 !== "string") return void 0;
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value2)) return value2;
    const name = value2.toLowerCase();
    return Object.hasOwn(CSS3_COLORS, name) ? CSS3_COLORS[name] : void 0;
  }
  function luminance(hex) {
    const value2 = hex.slice(1);
    const channels = (value2.length === 3 ? [...value2].map((c) => c + c).join("") : value2).match(/../g).map((c) => {
      const n = parseInt(c, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  var foreground = (background) => contrast(background, "#000000") >= contrast(background, "#ffffff") ? "#000000" : "#ffffff";
  function composite(front, back, opacity) {
    const channels = (hex) => {
      const value2 = hex.slice(1);
      return (value2.length === 3 ? [...value2].map((c) => c + c).join("") : value2).match(/../g).map((c) => parseInt(c, 16));
    };
    const base = channels(back);
    return "#" + channels(front).map((n, i) => Math.round(n * opacity + base[i] * (1 - opacity)).toString(16).padStart(2, "0")).join("");
  }

  // src/help-syntax.js
  var topics = {
    syntax: ["Basic syntax and a complete starter example", 0],
    json: ["Equivalent JSON architecture documents and syntax mapping", 0],
    meta: ["Translate DSL/JSON and inspect source correction candidates", 0],
    model: ["Elements, containers, relationships and attributes", 0],
    profiles: ["Registered profiles and profile summaries", 1],
    types: ["Node types and inherited attribute rules", 2],
    relations: ["Relationship types, endpoints and rules", 2],
    connections: ["Allowed incoming/outgoing relationships for a node type", 2],
    viewpoints: ["Allowed and required contents for each viewpoint", 2],
    iconpacks: ["Registered packs, icon names and search", 3],
    diagrams: ["Diagram types and their options", 1],
    views: ["View selection, filters, direction and theme", 0],
    routing: ["Positions, ports, curves and custom paths", 0],
    styles: ["Templates, icons, colors and fill opacity", 0],
    colors: ["All CSS3 color names and their hex values", 1],
    templates: ["Node templates and edge styles", 0],
    config: ["View selection, profiles and custom inline profiles", 0],
    api: ["Public JavaScript API", 0]
  };
  var aliases = { icons: "iconpacks", profile: "profiles", nodes: "types", edges: "relations", diagram: "diagrams", view: "views", style: "styles" };
  var usage = {
    profiles: "@help profiles [PROFILE]",
    types: "@help types [PROFILE [TYPE]]",
    relations: "@help relations [PROFILE [RELATION]]",
    viewpoints: "@help viewpoints [PROFILE [VIEWPOINT]]",
    connections: "@help connections [PROFILE [TYPE]]",
    iconpacks: "@help iconpacks [PACK [FILTER [PAGE]]]",
    diagrams: "@help diagrams [TYPE]",
    colors: "@help colors [FILTER]"
  };
  var fail = (message) => {
    throw new ArchError(message, {}, "ARCH_HELP");
  };
  var syntax = (topic) => usage[topic] ?? `@help${topic ? ` ${topic}` : ""}`;
  function tokens(source) {
    const values = [];
    let rest = source;
    while (rest.length) {
      const skip = rest.match(/^(?:\s+|#[^\n]*|\/\/[^\n]*)/);
      if (skip) {
        rest = rest.slice(skip[0].length);
        continue;
      }
      const token = rest.match(/^"(?:[^"\\]|\\.)*"|^[^\s"#]+/);
      if (!token) fail("Invalid help command. Use @help or @help TOPIC.");
      let value2 = token[0];
      if (value2.startsWith('"')) {
        try {
          value2 = JSON.parse(value2);
        } catch {
          fail("Invalid string in help command.");
        }
      }
      values.push(value2);
      rest = rest.slice(token[0].length);
      if (values.length > 5) fail("Too many help parameters. Use @help to see valid commands.");
    }
    return values;
  }
  function request(topic = "", parameters = []) {
    if (typeof topic !== "string" || !Array.isArray(parameters) || parameters.some((p) => typeof p !== "string")) fail("Invalid help request.");
    topic = topic.toLowerCase();
    topic = Object.hasOwn(aliases, topic) ? aliases[topic] : topic;
    if (topic && !Object.hasOwn(topics, topic)) fail(`Unknown help topic: ${topic}. Use @help. Topics: ${Object.keys(topics).join(", ")}.`);
    if (parameters.length > (topic ? topics[topic][1] : 0)) fail(`Usage: ${syntax(topic)}`);
    return { topic, parameters: [...parameters] };
  }
  function parseHelpCommand(source) {
    if (source.length > 2e6) fail("Source exceeds 2 MB");
    const [command, topic, ...parameters] = tokens(source);
    if (command !== "@help") fail("Unknown command. Use @help.");
    return request(topic, parameters);
  }
  function helpDocument(help2) {
    return {
      kind: "help",
      help: help2,
      title: "arch.js Help",
      description: "Valid inputs and currently registered extensions.",
      nodes: [],
      edges: [],
      views: [{ id: "help", title: syntax(help2.topic), theme: "light" }]
    };
  }

  // src/view-selection.js
  var fail2 = (message, loc) => {
    throw new ArchError(message, loc, "ARCH_VALIDATION");
  };
  function viewIds(selection, views, loc) {
    if (!Array.isArray(views) || !views.length) fail2("Invalid model; use parse(source)", loc);
    if (selection === void 0) return [views[0].id];
    if (selection === "all") return views.map((view) => view.id);
    const ids = typeof selection === "string" ? [selection] : selection;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !id))
      fail2("views must be all, a view ID or a nonempty list of view IDs", loc);
    if (new Set(ids).size !== ids.length) fail2("views must not contain duplicate view IDs", loc);
    const available = new Set(views.map((view) => view.id));
    for (const id of ids) if (!available.has(id)) fail2(`Unknown view: ${id}`, loc);
    return [...ids];
  }
  function selectedViewIds(model, options = {}) {
    if (options.view !== void 0) {
      if (typeof options.view !== "string" || !options.view) fail2("view must be a view ID");
      return viewIds([options.view], model?.views);
    }
    return viewIds(
      options.views === void 0 ? model?.config?.views : options.views,
      model?.views,
      options.views === void 0 ? model?.config?.loc : void 0
    );
  }

  // src/routing-options.js
  var fields = ["from", "to", "via", "curve", "label", "path", "icon", "iconPosition", "showIcon", "showLabel"];
  var geometryFields = ["from", "to", "via", "curve"];
  function routingOptions(view, specific, reference2 = false) {
    const defaults = { ...view.routeDefaults };
    if (reference2) {
      delete defaults.label;
      delete defaults.icon;
      delete defaults.iconPosition;
      delete defaults.showIcon;
      delete defaults.showLabel;
      if (typeof defaults.to !== "number") delete defaults.to;
    } else if (typeof defaults.to === "number") delete defaults.to;
    if (specific && geometryFields.some((key) => specific[key] !== void 0)) delete defaults.path;
    if (!specific && !fields.some((key) => defaults[key] !== void 0)) return void 0;
    return { ...defaults, ...specific };
  }

  // src/relationship-labels.js
  function relationshipReferences(edge, rule) {
    return Object.entries(rule.referenceLabels ?? {}).flatMap(([attribute, label]) => [edge.attributes?.[attribute]].flat().filter((id) => typeof id === "string").map((id) => ({ id, attribute, label })));
  }
  function relationshipLabel(edge, rule, nodes, omit = /* @__PURE__ */ new Set()) {
    const lines = edge.title ? [edge.title] : [];
    for (const [attribute, label] of Object.entries(rule.referenceLabels ?? {})) {
      const ids = [edge.attributes?.[attribute]].flat().filter((id) => typeof id === "string" && !omit.has(`${attribute}\0${id}`));
      if (ids.length) lines.push(`${label}: ${ids.map((id) => `${nodes.get(id)?.title ?? id} [${id}]`).join(", ")}`);
    }
    return lines.join("\n");
  }

  // src/profiles.js
  var TEMPLATES = Object.freeze([
    "person",
    "system",
    "application",
    "service",
    "component",
    "database",
    "queue",
    "interface",
    "capability",
    "process",
    "artifact",
    "node",
    "package"
  ]);
  var EDGE_STYLES = Object.freeze(["flow", "dependency", "association", "access", "composition", "realization", "generalization"]);
  var NODE_PROPERTIES = Object.freeze(["description", "technology", "icon", "stereotype", "tags"]);
  var EDGE_PROPERTIES = Object.freeze(["description", "technology", "tags"]);
  var registry = /* @__PURE__ */ new Map();
  var compiledProfiles = /* @__PURE__ */ new WeakSet();
  var idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
  var reservedTypes = /* @__PURE__ */ new Set(["relation", "model", "view", "config", "architecture"]);
  var reservedAttributes = /* @__PURE__ */ new Set(["id", "type", "title", "parent", "loc", "attributes", "attributeLocs", "relation"]);
  var fail3 = (message) => {
    throw new ArchError(message, {}, "ARCH_PROFILE");
  };
  var own = (object, key) => Object.hasOwn(object, key);
  var record = (value2) => value2 && typeof value2 === "object" && !Array.isArray(value2);
  var documentationKeys = ["title", "description", "sources", "limitations"];
  function documentation(raw, label) {
    const result = {};
    for (const key of ["title", "description"]) if (raw[key] !== void 0) {
      if (typeof raw[key] !== "string" || raw[key].length > 16e3) fail3(`${label}.${key}: expected text (at most 16000 characters)`);
      result[key] = raw[key];
    }
    for (const key of ["sources", "limitations"]) if (raw[key] !== void 0) {
      if (!Array.isArray(raw[key]) || raw[key].length > 128 || raw[key].some((s) => typeof s !== "string" || s.length > 4e3)) fail3(`${label}.${key}: expected a text list`);
      result[key] = [...raw[key]];
    }
    return result;
  }
  var copy = (value2) => JSON.parse(JSON.stringify(value2));
  var freeze = (value2) => {
    if (value2 && typeof value2 === "object") {
      Object.values(value2).forEach(freeze);
      Object.freeze(value2);
    }
    return value2;
  };
  function keys(value2, allowed, label) {
    if (!record(value2)) fail3(`${label} must be an object`);
    for (const key of Object.keys(value2)) if (!allowed.includes(key)) fail3(`${label}: unknown option ${key}`);
  }
  function identifier(value2, label) {
    if (typeof value2 !== "string" || !idPattern.test(value2)) fail3(`${label}: invalid identifier ${value2}`);
  }
  function names(value2, label, fallback = ["*"], allowEmpty = false) {
    const array = value2 === void 0 ? fallback : typeof value2 === "string" ? [value2] : value2;
    if (!Array.isArray(array) || !allowEmpty && !array.length || array.length > 512) fail3(`${label}: invalid name list`);
    for (const item of array) if (item !== "*") identifier(item, label);
    return [...new Set(array)];
  }
  function cardinality(value2, label) {
    if (value2 === void 0) return void 0;
    keys(value2, ["min", "max"], label);
    const result = { min: value2.min ?? 0, max: value2.max ?? null };
    if (!Number.isInteger(result.min) || result.min < 0 || result.min > 4e3 || result.max !== null && (!Number.isInteger(result.max) || result.max < result.min || result.max > 4e3)) fail3(`${label}: invalid cardinality`);
    return result;
  }
  function attributes(value2 = {}, label) {
    if (!record(value2) || Object.keys(value2).length > 128) fail3(`${label}: invalid attribute definitions`);
    const result = /* @__PURE__ */ Object.create(null);
    for (const [name, rule] of Object.entries(value2)) {
      identifier(name, label);
      if (reservedAttributes.has(name)) fail3(`${label}: reserved attribute ${name}`);
      keys(rule, ["type", "required", "enum", "min", "max", "minLength", "maxLength", "many", "minItems", "maxItems", "uniqueItems", "targets", "format"], `${label}.${name}`);
      const type = rule.type ?? "string";
      if (!["string", "number", "integer", "boolean", "reference"].includes(type)) fail3(`${label}.${name}: unknown data type ${type}`);
      if (rule.required !== void 0 && typeof rule.required !== "boolean") fail3(`${label}.${name}: required must be boolean`);
      const normalized = { type, required: rule.required ?? false };
      if (rule.many !== void 0 && typeof rule.many !== "boolean") fail3(`${label}.${name}: many must be boolean`);
      if (rule.many) normalized.many = true;
      if (rule.uniqueItems !== void 0) {
        if (!rule.many || typeof rule.uniqueItems !== "boolean") fail3(`${label}.${name}: uniqueItems requires many`);
        normalized.uniqueItems = rule.uniqueItems;
      }
      for (const bound of ["minItems", "maxItems"]) if (rule[bound] !== void 0) {
        if (!rule.many || !Number.isInteger(rule[bound]) || rule[bound] < 0 || rule[bound] > 4e3) fail3(`${label}.${name}: invalid bound ${bound}`);
        normalized[bound] = rule[bound];
      }
      if ((normalized.minItems ?? 0) > (normalized.maxItems ?? 4e3)) fail3(`${label}.${name}: inconsistent list bounds`);
      if (type === "reference") normalized.targets = names(rule.targets, `${label}.${name}.targets`);
      else if (rule.targets !== void 0) fail3(`${label}.${name}: targets requires type reference`);
      if (rule.format !== void 0) {
        if (type !== "string" || !["date", "date-time", "uri"].includes(rule.format)) fail3(`${label}.${name}: invalid format`);
        normalized.format = rule.format;
      }
      for (const bound of ["min", "max", "minLength", "maxLength"]) if (rule[bound] !== void 0) {
        if (!Number.isFinite(rule[bound]) || (bound.includes("Length") ? type !== "string" || !Number.isInteger(rule[bound]) || rule[bound] < 0 : !["number", "integer"].includes(type)))
          fail3(`${label}.${name}: invalid bound ${bound}`);
        normalized[bound] = rule[bound];
      }
      if (normalized.min !== void 0 && normalized.max !== void 0 && normalized.min > normalized.max || normalized.minLength !== void 0 && normalized.maxLength !== void 0 && normalized.minLength > normalized.maxLength) fail3(`${label}.${name}: inconsistent bounds`);
      if (rule.enum !== void 0) {
        if (!Array.isArray(rule.enum) || !rule.enum.length || rule.enum.length > 256 || rule.enum.some((v) => type === "integer" ? !Number.isInteger(v) : typeof v !== (type === "reference" ? "string" : type) || type === "number" && !Number.isFinite(v))) fail3(`${label}.${name}: invalid enum values`);
        normalized.enum = [...new Set(rule.enum)];
      }
      if ([...NODE_PROPERTIES, ...EDGE_PROPERTIES].includes(name) && (type !== "string" || rule.many)) fail3(`${label}.${name}: Built-in attributes must remain scalar strings`);
      result[name] = normalized;
    }
    return result;
  }
  var bases = (rule) => typeof rule?.extends === "string" ? [rule.extends] : rule?.extends ?? [];
  function parentNames(value2, label) {
    if (value2 === void 0) return [];
    const values = names(value2, label, [], true);
    if (values.includes("*")) fail3(`${label}: A wildcard cannot be used as a base type`);
    return values;
  }
  function mergeAttributes(parents, local, label) {
    const result = /* @__PURE__ */ Object.create(null);
    for (const parent of parents) for (const [key, value2] of Object.entries(parent.attributes)) {
      if (own(result, key) && JSON.stringify(result[key]) !== JSON.stringify(value2) && !own(local ?? {}, key))
        fail3(`${label}.${key}: ambiguous inherited attribute rule; a local override is required`);
      result[key] = value2;
    }
    return Object.assign(result, attributes(local, label));
  }
  function comparisons(value2 = [], label) {
    if (!Array.isArray(value2) || value2.length > 128) fail3(`${label}: invalid comparisons`);
    return value2.map((rule) => {
      keys(rule, ["left", "op", "right"], label);
      identifier(rule.left, label);
      identifier(rule.right, label);
      if (!["<", "<=", "=", "!=", ">=", ">"].includes(rule.op)) fail3(`${label}: unknown comparison`);
      return { left: rule.left, op: rule.op, right: rule.right };
    });
  }
  function compileProfile(definition, fallbackId) {
    if (compiledProfiles.has(definition)) return definition;
    keys(definition, ["id", ...documentationKeys, "version", "extends", "nodeTypes", "relationTypes", "viewpoints", "styleGroups", "defaultRelation", "requireViewpoint"], "Profile");
    const id = definition.id ?? fallbackId;
    identifier(id, "Profile ID");
    if (definition.extends !== void 0 && (typeof definition.extends !== "string" || !registry.has(definition.extends))) fail3(`Unknown base profile: ${definition.extends}`);
    const base = definition.extends ? registry.get(definition.extends) : void 0;
    for (const key of ["title", "version"]) if (definition[key] !== void 0 && typeof definition[key] !== "string") fail3(`Profile.${key} must be a string`);
    if (definition.requireViewpoint !== void 0 && typeof definition.requireViewpoint !== "boolean") fail3("requireViewpoint must be boolean");
    const merged2 = (key) => {
      const values = definition[key] ?? {};
      if (!record(values)) fail3(`Profile.${key} must be an object`);
      return Object.assign(/* @__PURE__ */ Object.create(null), base?.[key] ?? {}, values);
    };
    const rawNodes = merged2("nodeTypes"), rawEdges = merged2("relationTypes"), rawViews = merged2("viewpoints");
    const styleGroups = merged2("styleGroups");
    if (Object.keys(styleGroups).length > 512) fail3("Too many style groups");
    for (const [name, group] of Object.entries(styleGroups)) {
      identifier(name, "Style group");
      keys(group, ["backgroundColor"], `Style group ${name}`);
      if (group.backgroundColor !== void 0 && !normalizeColor(group.backgroundColor)) fail3(`${name}: invalid backgroundColor`);
      styleGroups[name] = group.backgroundColor === void 0 ? { ...group } : { backgroundColor: normalizeColor(group.backgroundColor) };
    }
    if (!Object.keys(rawNodes).length || Object.keys(rawNodes).length > 512 || Object.keys(rawEdges).length > 512 || Object.keys(rawViews).length > 128) fail3("Profile requires 1–512 node types; at most 512 relation types and 128 viewpoints");
    const nodeTypes = /* @__PURE__ */ Object.create(null), relationTypes = /* @__PURE__ */ Object.create(null), viewpoints = /* @__PURE__ */ Object.create(null);
    const compiling = /* @__PURE__ */ new Set();
    const node = (name) => {
      if (own(nodeTypes, name)) return nodeTypes[name];
      if (!own(rawNodes, name) || compiling.has(`n:${name}`)) fail3(`Unknown or cyclic node type: ${name}`);
      identifier(name, "node type");
      if (reservedTypes.has(name)) fail3(`Reserved node type: ${name}`);
      const raw = rawNodes[name];
      keys(raw, ["extends", "template", "container", "contains", "abstract", "attributes", "icon", "accent", "backgroundColor", "styleGroup", "comparisons", ...documentationKeys], `node type ${name}`);
      compiling.add(`n:${name}`);
      const baseNames = parentNames(raw.extends, `Base type of ${name}`), parents = baseNames.map(node), parent = parents[0];
      const result = {
        ...documentation(raw, name),
        template: raw.template ?? parent?.template ?? "node",
        container: raw.container,
        abstract: raw.abstract ?? false,
        attributes: mergeAttributes(parents, raw.attributes, name)
      };
      for (const key of ["icon", "accent"]) if (raw[key] !== void 0 || parent?.[key] !== void 0) result[key] = raw[key] ?? parent[key];
      for (const key of ["styleGroup", "backgroundColor"]) if (raw[key] !== void 0 || parent?.[key] !== void 0) result[key] = raw[key] ?? parent[key];
      if (result.styleGroup !== void 0 && !own(styleGroups, result.styleGroup)) fail3(`${name}: unknown style group ${result.styleGroup}`);
      if (result.backgroundColor !== void 0 && !normalizeColor(result.backgroundColor)) fail3(`${name}: invalid backgroundColor`);
      if (raw.extends !== void 0) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
      const checks = [...parents.flatMap((p) => p.comparisons ?? []), ...comparisons(raw.comparisons, name)];
      if (checks.length) result.comparisons = [...new Map(checks.map((check) => [JSON.stringify(check), check])).values()];
      for (const check of result.comparisons ?? []) {
        const a = result.attributes[check.left], b = result.attributes[check.right];
        if (!a || !b || a.many || b.many || a.type !== b.type || !["number", "integer", "string"].includes(a.type) || a.format !== b.format)
          fail3(`${name}: Comparison requires two compatible scalar attributes`);
      }
      if (!TEMPLATES.includes(result.template)) fail3(`Unknown template for ${name}: ${result.template}`);
      result.container ?? (result.container = result.template === "package");
      if (typeof result.abstract !== "boolean" || typeof result.container !== "boolean" || result.container !== (result.template === "package")) fail3(`${name}: Containers require template package`);
      if (raw.contains !== void 0 && !result.container) fail3(`${name}: contains is only allowed for containers`);
      if (result.container) result.contains = names(raw.contains ?? parent?.contains, `${name}.contains`, ["*"], true);
      if (result.icon !== void 0 && (typeof result.icon !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(result.icon))) fail3(`${name}: invalid icon reference`);
      if (result.accent !== void 0 && !normalizeColor(result.accent)) fail3(`${name}: invalid accent color`);
      for (const key of ["accent", "backgroundColor"]) if (result[key] !== void 0) result[key] = normalizeColor(result[key]);
      nodeTypes[name] = result;
      compiling.delete(`n:${name}`);
      return result;
    };
    for (const name of Object.keys(rawNodes)) node(name);
    const knownNodes = (list2, label) => {
      for (const name of list2) if (name !== "*" && !own(nodeTypes, name)) fail3(`${label}: unknown node type ${name}`);
    };
    const checkReferences = (rule, label) => {
      for (const [key, attr] of Object.entries(rule.attributes)) if (attr.type === "reference") knownNodes(attr.targets, `${label}.${key}`);
    };
    for (const [name, rule] of Object.entries(nodeTypes)) {
      if (rule.container) knownNodes(rule.contains, `${name}.contains`);
      checkReferences(rule, name);
    }
    const relation = (name) => {
      if (own(relationTypes, name)) return relationTypes[name];
      if (!own(rawEdges, name) || compiling.has(`e:${name}`)) fail3(`Unknown or cyclic relation type: ${name}`);
      identifier(name, "relation type");
      const raw = rawEdges[name];
      keys(raw, ["extends", "from", "to", "style", "abstract", "allowSelf", "attributes", "outgoing", "incoming", "pairs", "acyclic", "referenceLabels", "referenceDisplay", "referenceOccurrences", ...documentationKeys], `relation type ${name}`);
      compiling.add(`e:${name}`);
      const baseNames = parentNames(raw.extends, `Base relationship of ${name}`), parents = baseNames.map(relation), parent = parents[0];
      const result = {
        ...documentation(raw, name),
        from: names(raw.from ?? parent?.from, `${name}.from`),
        to: names(raw.to ?? parent?.to, `${name}.to`),
        style: raw.style ?? parent?.style ?? "flow",
        abstract: raw.abstract ?? false,
        allowSelf: raw.allowSelf ?? parent?.allowSelf ?? true,
        attributes: mergeAttributes(parents, raw.attributes, name)
      };
      if (raw.extends !== void 0) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
      const referenceLabels = raw.referenceLabels ?? parent?.referenceLabels;
      if (raw.referenceDisplay !== void 0 || parent?.referenceDisplay !== void 0) {
        result.referenceDisplay = raw.referenceDisplay ?? parent.referenceDisplay;
        if (!["labels", "nodes", "both"].includes(result.referenceDisplay)) fail3(`${name}.referenceDisplay must be labels, nodes or both`);
      }
      if (raw.referenceOccurrences !== void 0 || parent?.referenceOccurrences !== void 0) {
        result.referenceOccurrences = raw.referenceOccurrences ?? parent.referenceOccurrences;
        if (!["shared", "perEdge"].includes(result.referenceOccurrences)) fail3(`${name}.referenceOccurrences must be shared or perEdge`);
      }
      if (referenceLabels !== void 0) {
        if (!record(referenceLabels) || Object.keys(referenceLabels).length > 128) fail3(`${name}.referenceLabels: expected an attribute-to-label map`);
        result.referenceLabels = /* @__PURE__ */ Object.create(null);
        for (const [attribute, label] of Object.entries(referenceLabels)) {
          if (!own(result.attributes, attribute) || result.attributes[attribute].type !== "reference") fail3(`${name}.referenceLabels: ${attribute} must be a reference attribute`);
          if (typeof label !== "string" || !label.trim() || label.length > 80) fail3(`${name}.referenceLabels: expected a nonempty label of at most 80 characters`);
          result.referenceLabels[attribute] = label;
        }
      }
      if (raw.acyclic !== void 0 && typeof raw.acyclic !== "boolean") fail3(`${name}.acyclic must be boolean`);
      if (raw.acyclic ?? parent?.acyclic) result.acyclic = true;
      const pairs = raw.pairs ?? parent?.pairs;
      if (pairs !== void 0) {
        if (!Array.isArray(pairs) || !pairs.length || pairs.length > 512) fail3(`${name}: invalid pairs`);
        result.pairs = pairs.map((pair) => {
          keys(pair, ["from", "to", "fromExclude", "toExclude"], `${name}.pairs`);
          const normalized = { from: names(pair.from, name), to: names(pair.to, name) };
          for (const key of ["fromExclude", "toExclude"]) if (pair[key] !== void 0) normalized[key] = names(pair[key], name, [], true);
          for (const [key, values] of Object.entries(normalized)) knownNodes(values, `${name}.${key}`);
          return normalized;
        });
      }
      if (!EDGE_STYLES.includes(result.style)) fail3(`Unknown edge style for ${name}: ${result.style}`);
      if (typeof result.abstract !== "boolean" || typeof result.allowSelf !== "boolean") fail3(`${name}: abstract/allowSelf must be boolean`);
      for (const key of ["outgoing", "incoming"]) {
        const value2 = cardinality(raw[key] ?? parent?.[key], `${name}.${key}`);
        if (value2) result[key] = value2;
      }
      knownNodes(result.from, `${name}.from`);
      knownNodes(result.to, `${name}.to`);
      checkReferences(result, name);
      relationTypes[name] = result;
      compiling.delete(`e:${name}`);
      return result;
    };
    for (const name of Object.keys(rawEdges)) relation(name);
    const knownEdges = (list2, label) => {
      for (const name of list2) if (name !== "*" && !own(relationTypes, name)) fail3(`${label}: unknown relation type ${name}`);
    };
    for (const [name, raw] of Object.entries(rawViews)) {
      identifier(name, "Viewpoint");
      keys(raw, ["nodes", "relations", "requiredNodes", "requiredRelations", "connections", "references", ...documentationKeys], `Viewpoint ${name}`);
      const result = {
        ...documentation(raw, name),
        nodes: names(raw.nodes, `${name}.nodes`, ["*"], true),
        relations: names(raw.relations, `${name}.relations`, ["*"], true),
        requiredNodes: raw.requiredNodes === void 0 ? [] : names(raw.requiredNodes, `${name}.requiredNodes`, [], true),
        requiredRelations: raw.requiredRelations === void 0 ? [] : names(raw.requiredRelations, `${name}.requiredRelations`, [], true)
      };
      knownNodes(result.nodes, name);
      knownNodes(result.requiredNodes, name);
      knownEdges(result.relations, name);
      knownEdges(result.requiredRelations, name);
      if (result.requiredNodes.includes("*") || result.requiredRelations.includes("*")) fail3(`${name}: Required type lists cannot contain a wildcard`);
      if (raw.connections !== void 0) {
        if (!Array.isArray(raw.connections) || raw.connections.length > 128) fail3(`${name}: invalid connections`);
        result.connections = raw.connections.map((check) => {
          keys(check, ["nodes", "relations", "counterparts", "direction", "min", "max"], `${name}.connections`);
          const value2 = {
            nodes: names(check.nodes, name),
            relations: names(check.relations, name),
            direction: check.direction ?? "either",
            ...cardinality({ min: check.min ?? 1, max: check.max }, `${name}.connections`)
          };
          if (!["incoming", "outgoing", "either"].includes(value2.direction)) fail3(`${name}: invalid connection direction`);
          if (check.counterparts !== void 0) {
            value2.counterparts = names(check.counterparts, name);
            knownNodes(value2.counterparts, name);
          }
          knownNodes(value2.nodes, name);
          knownEdges(value2.relations, name);
          return value2;
        });
      }
      if (raw.references !== void 0) {
        if (!Array.isArray(raw.references) || raw.references.length > 128) fail3(`${name}: invalid references`);
        result.references = raw.references.map((check) => {
          keys(check, ["nodes", "relations", "attributes"], `${name}.references`);
          if (check.nodes === void 0 === (check.relations === void 0)) fail3(`${name}: reference checks require nodes or relations`);
          const key = check.nodes === void 0 ? "relations" : "nodes";
          const value2 = { [key]: names(check[key], name), attributes: names(check.attributes, name) };
          (key === "nodes" ? knownNodes : knownEdges)(value2[key], name);
          if (value2[key].includes("*") || value2.attributes.includes("*")) fail3(`${name}: reference checks require explicit names`);
          for (const type of value2[key]) for (const attr of value2.attributes) if ((key === "nodes" ? nodeTypes : relationTypes)[type].attributes[attr]?.type !== "reference") fail3(`${name}: ${type}.${attr} is not a reference attribute`);
          return value2;
        });
      }
      viewpoints[name] = result;
    }
    const defaultRelation = own(definition, "defaultRelation") ? definition.defaultRelation : base ? base.defaultRelation : own(relationTypes, "flow") ? "flow" : null;
    if (defaultRelation !== null && (!own(relationTypes, defaultRelation) || relationTypes[defaultRelation].abstract)) fail3(`Invalid default relationship type: ${defaultRelation}`);
    const compiled = freeze({
      ...documentation(definition, "Profile"),
      id,
      title: definition.title ?? base?.title ?? id,
      version: definition.version ?? base?.version ?? "1",
      nodeTypes,
      relationTypes,
      viewpoints,
      styleGroups: copy(styleGroups),
      defaultRelation,
      requireViewpoint: definition.requireViewpoint ?? base?.requireViewpoint ?? false
    });
    compiledProfiles.add(compiled);
    return compiled;
  }
  function registerProfile(name, definition) {
    identifier(name, "Profile name");
    if (definition?.id !== void 0 && definition.id !== name) fail3("Profile name and profile ID must match");
    const profile = compileProfile(definition, name);
    registry.set(name, profile);
    return copy(profile);
  }
  function getProfiles() {
    return [...registry.keys()];
  }
  function getProfile(name) {
    if (!registry.has(name)) fail3(`Unknown profile: ${name}`);
    return copy(registry.get(name));
  }
  function resolveProfile(model, options = {}) {
    let selection = options.profile;
    if (selection === void 0 && model.profile) return compileProfile(model.profile);
    if (selection === void 0) selection = model.config?.profile;
    if (selection !== void 0) {
      if (typeof selection === "string") {
        if (!registry.has(selection)) throw new ArchError(`Unknown profile: ${selection}`, model.config?.loc, "ARCH_PROFILE");
        return registry.get(selection);
      }
      return compileProfile(selection, "parameter");
    }
    if (model.config?.definition) {
      try {
        return compileProfile(model.config.definition, "inline");
      } catch (error) {
        throw new ArchError(error.message, model.config.loc, "ARCH_PROFILE");
      }
    }
    return registry.get("default");
  }
  function matches(type, allowed, definitions) {
    if (allowed.includes("*")) return true;
    const visited = /* @__PURE__ */ new Set(), pending = [type];
    while (pending.length) {
      const next = pending.pop();
      if (!next || visited.has(next)) continue;
      if (allowed.includes(next)) return true;
      visited.add(next);
      pending.push(...bases(definitions[next]));
    }
    return false;
  }
  function concreteSubtypes(type, definitions) {
    return Object.keys(definitions).filter((name) => name !== type && !definitions[name].abstract && matches(name, [type], definitions)).sort();
  }
  function matchesPair(source, target, pair, definitions) {
    return matches(source, pair.from, definitions) && matches(target, pair.to, definitions) && !matches(source, pair.fromExclude ?? [], definitions) && !matches(target, pair.toExclude ?? [], definitions);
  }
  function typeConnections(type, profile) {
    if (!own(profile.nodeTypes, type)) fail3(`Unknown node type in profile ${profile.id}: ${type}`);
    const concrete = Object.keys(profile.nodeTypes).filter((name) => !profile.nodeTypes[name].abstract).sort();
    const outgoing = [], incoming = [];
    for (const name of Object.keys(profile.relationTypes).sort()) {
      const rule = profile.relationTypes[name];
      if (rule.abstract) continue;
      const accepts = (source, target) => matches(source, rule.from, profile.nodeTypes) && matches(target, rule.to, profile.nodeTypes) && (!rule.pairs || rule.pairs.some((pair) => matchesPair(source, target, pair, profile.nodeTypes)));
      const targets = concrete.filter((other) => accepts(type, other)), sources = concrete.filter((other) => accepts(other, type));
      const summary = { type: name, allowSelf: rule.allowSelf, acyclic: !!rule.acyclic };
      if (targets.length) outgoing.push({ ...summary, counterparts: targets });
      if (sources.length) incoming.push({ ...summary, counterparts: sources });
    }
    return { type, abstract: profile.nodeTypes[type].abstract, outgoing, incoming };
  }
  function visibleNodeIds(model, view) {
    const nodes = new Map(model.nodes.map((node) => [node.id, node]));
    const children = /* @__PURE__ */ new Map();
    for (const node of model.nodes) {
      if (!children.has(node.parent)) children.set(node.parent, []);
      children.get(node.parent).push(node.id);
    }
    const descendants = (roots) => {
      const ids = new Set(roots), pending = [...ids];
      while (pending.length) for (const child2 of children.get(pending.pop()) ?? [])
        if (!ids.has(child2)) {
          ids.add(child2);
          pending.push(child2);
        }
      return ids;
    };
    const visible = view.include ? descendants(view.include) : new Set(nodes.keys());
    for (const id of descendants(view.exclude ?? [])) visible.delete(id);
    if (view.include) for (const id of [...visible]) {
      const seen = /* @__PURE__ */ new Set();
      let parent = nodes.get(id)?.parent;
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        visible.add(parent);
        parent = nodes.get(parent)?.parent;
      }
    }
    return visible;
  }
  function validFormat(value2, format) {
    if (typeof value2 !== "string") return false;
    if (format === "uri") return /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(value2);
    const date = value2.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!date) return false;
    const year = Number(date[1]), month = Number(date[2]), day = Number(date[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return false;
    if (format === "date") return date[4] === "";
    const time = date[4].match(/^T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/);
    return !!time && Number(time[1]) < 24 && Number(time[2]) < 60 && Number(time[3]) < 60 && (!time[4] || Number(time[5]) < 24 && Number(time[6]) < 60) && Number.isFinite(Date.parse(value2));
  }
  function profileDiagnostics(model, profile) {
    const result = [], nodes = new Map(model.nodes.map((node) => [node.id, node]));
    const add = (message, item, extra = {}) => result.push({
      severity: "error",
      code: profile.id === "default" ? "ARCH_VALIDATION" : "ARCH_SEMANTIC",
      message,
      line: item?.loc?.line ?? null,
      column: item?.loc?.column ?? null,
      ...item?.loc?.path !== void 0 ? { path: item.loc.path } : {},
      ...extra
    });
    const abstractType = (type, kind, definitions, item) => {
      const candidates = concreteSubtypes(type, definitions), topic = kind === "node" ? "types" : "relations";
      const help2 = `@help ${topic} ${registry.get(profile.id) === profile ? profile.id : "."} ${type}`;
      const detail = candidates.length ? `Concrete subtypes: ${candidates.slice(0, 12).join(", ")}${candidates.length > 12 ? ` (+${candidates.length - 12} more)` : ""}.` : `No concrete subtypes are defined in profile ${profile.id}.`;
      add(`Abstract ${kind} type cannot be instantiated: ${type}. ${detail} See ${help2}`, item, { elementId: item.id, candidates, help: help2 });
    };
    const checkAttributes = (item, rule, builtins) => {
      const values = { ...Object.fromEntries(builtins.filter((key) => own(item, key)).map((key) => [key, item[key]])), ...item.attributes };
      for (const [name, value2] of Object.entries(values)) {
        const schema = rule.attributes[name];
        const location = { loc: item.attributeLocs?.[name] ?? item.loc };
        const extra = { elementId: item.id, attribute: name };
        if (!schema && !builtins.includes(name)) {
          add(`Unknown attribute for ${item.type}: ${name}`, location, extra);
          continue;
        }
        const type = schema?.type ?? "string", many = !!schema?.many;
        if (many !== Array.isArray(value2)) {
          add(`${item.id}.${name}: expected ${many ? "list" : type}`, location, extra);
          continue;
        }
        const entries = many ? value2 : [value2];
        if (many && (entries.length < (schema.minItems ?? 0) || entries.length > (schema.maxItems ?? 4e3))) add(`${item.id}.${name}: invalid list length`, location, extra);
        if (many && schema.uniqueItems && new Set(entries).size !== entries.length) add(`${item.id}.${name}: Duplicate list entries are not allowed`, location, extra);
        for (const entry of entries) {
          if (type === "integer" ? !Number.isInteger(entry) : typeof entry !== (type === "reference" ? "string" : type) || type === "number" && !Number.isFinite(entry)) {
            add(`${item.id}.${name}: expected ${type}`, location, extra);
            continue;
          }
          if (!schema) continue;
          if (schema.enum && !schema.enum.includes(entry)) add(`${item.id}.${name}: Value must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`, location, extra);
          if (schema.min !== void 0 && entry < schema.min || schema.max !== void 0 && entry > schema.max) add(`${item.id}.${name}: Number outside the allowed range`, location, extra);
          if (schema.minLength !== void 0 && [...entry].length < schema.minLength || schema.maxLength !== void 0 && [...entry].length > schema.maxLength) add(`${item.id}.${name}: invalid text length`, location, extra);
          if (schema.format && !validFormat(entry, schema.format)) add(`${item.id}.${name}: invalid format ${schema.format}`, location, extra);
          if (type === "reference") {
            const target = nodes.get(entry);
            if (!target) add(`${item.id}.${name}: unknown reference ${entry}`, location, extra);
            else if (!matches(target.type, schema.targets, profile.nodeTypes)) add(`${item.id}.${name}: Reference type ${target.type} is not allowed`, location, extra);
          }
        }
      }
      for (const [name, schema] of Object.entries(rule.attributes)) if (schema.required && !own(values, name)) add(`${item.id}: Missing required attribute ${name}`, item, { elementId: item.id, attribute: name });
      for (const check of rule.comparisons ?? []) {
        const a = rule.attributes[check.left], b = rule.attributes[check.right];
        let left = values[check.left], right = values[check.right];
        if (left === void 0 || right === void 0 || typeof left !== typeof right) continue;
        if (a.format && (!validFormat(left, a.format) || !validFormat(right, b.format))) continue;
        if (a.format === "date" || a.format === "date-time") {
          left = Date.parse(left);
          right = Date.parse(right);
        }
        const ok = { "<": left < right, "<=": left <= right, "=": left === right, "!=": left !== right, ">=": left >= right, ">": left > right }[check.op];
        if (!ok) add(`${item.id}: ${check.left} ${check.op} ${check.right} is not satisfied`, item, { elementId: item.id });
      }
    };
    for (const node of model.nodes) {
      const rule = profile.nodeTypes[node.type];
      if (!rule) {
        add(`Unknown element type in profile ${profile.id}: ${node.type}`, node, { elementId: node.id });
        continue;
      }
      if (rule.abstract) abstractType(node.type, "node", profile.nodeTypes, node);
      if (node.parent) {
        const parent = nodes.get(node.parent), parentRule = profile.nodeTypes[parent?.type];
        if (parentRule && !parentRule.container) add(`${node.parent} is not a container`, node, { elementId: node.id });
        else if (parentRule && !matches(node.type, parentRule.contains, profile.nodeTypes)) add(`${node.type} is not allowed in ${parent.type}`, node, { elementId: node.id });
      }
      checkAttributes(node, rule, NODE_PROPERTIES);
    }
    for (const edge of model.edges) {
      const type = edge.type ?? profile.defaultRelation, rule = profile.relationTypes[type];
      if (!rule) {
        add(type ? `Unknown relationship type in profile ${profile.id}: ${type}` : `Relationship ${edge.id} requires an explicit type`, edge, { elementId: edge.id });
        continue;
      }
      if (rule.abstract) abstractType(type, "relationship", profile.relationTypes, edge);
      if (!rule.allowSelf && edge.source === edge.target) add(`${type}: Self-relationships are not allowed`, edge, { elementId: edge.id });
      for (const [endpoint, types] of [["source", rule.from], ["target", rule.to]]) {
        const node = nodes.get(edge[endpoint]);
        if (node && !matches(node.type, types, profile.nodeTypes)) add(`${edge.id}: ${endpoint} of type ${node.type} is not allowed for ${type}`, edge, { elementId: edge.id });
      }
      if (rule.pairs && !rule.pairs.some((pair) => {
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        return source && target && matchesPair(source.type, target.type, pair, profile.nodeTypes);
      })) add(`${edge.id}: Type combination ${nodes.get(edge.source)?.type} → ${nodes.get(edge.target)?.type} is not allowed for ${type}`, edge, { elementId: edge.id });
      checkAttributes({ ...edge, type }, rule, EDGE_PROPERTIES);
    }
    const counts = /* @__PURE__ */ new Map();
    for (const edge of model.edges) {
      const pending = [edge.type ?? profile.defaultRelation];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const type = pending.pop();
        if (!type || visited.has(type)) continue;
        visited.add(type);
        if (!counts.has(type)) counts.set(type, { source: /* @__PURE__ */ new Map(), target: /* @__PURE__ */ new Map() });
        for (const endpoint of ["source", "target"]) {
          const map = counts.get(type)[endpoint];
          map.set(edge[endpoint], (map.get(edge[endpoint]) ?? 0) + 1);
        }
        pending.push(...bases(profile.relationTypes[type]));
      }
    }
    for (const [type, rule] of Object.entries(profile.relationTypes)) if (rule.acyclic) {
      const adjacency = /* @__PURE__ */ new Map(), state = /* @__PURE__ */ new Map();
      for (const edge of model.edges) if (matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes)) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source).push(edge);
      }
      let cycle;
      const visit = (id) => {
        state.set(id, 1);
        for (const edge of adjacency.get(id) ?? []) {
          if (state.get(edge.target) === 1) {
            cycle = edge;
            return;
          }
          if (!state.has(edge.target)) visit(edge.target);
          if (cycle) return;
        }
        state.set(id, 2);
      };
      for (const id of adjacency.keys()) {
        if (!state.has(id)) visit(id);
        if (cycle) break;
      }
      if (cycle) add(`${type}: Cycles are not allowed`, cycle, { elementId: cycle.id });
    }
    for (const [name, rule] of Object.entries(profile.relationTypes)) for (const key of ["outgoing", "incoming"]) if (rule[key]) {
      const endpoint = key === "outgoing" ? "source" : "target", applicable = key === "outgoing" ? rule.from : rule.to;
      for (const node of model.nodes) if (matches(node.type, applicable, profile.nodeTypes)) {
        const count = counts.get(name)?.[endpoint].get(node.id) ?? 0;
        if (count < rule[key].min || rule[key].max !== null && count > rule[key].max) add(`${node.id}: ${name}.${key} expected ${rule[key].min}–${rule[key].max ?? "∞"} relationships, found ${count}`, node, { elementId: node.id });
      }
    }
    for (const view of model.views) {
      if (view.meta !== void 0) continue;
      if (!view.viewpoint) {
        if (profile.requireViewpoint) add(`View ${view.id} requires a viewpoint`, view, { viewId: view.id });
        continue;
      }
      const rule = profile.viewpoints[view.viewpoint];
      if (!rule) {
        add(`Unknown viewpoint: ${view.viewpoint}`, view, { viewId: view.id });
        continue;
      }
      const visible = visibleNodeIds(model, view), selectedNodes = model.nodes.filter((node) => visible.has(node.id));
      const selectedEdges = model.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
      for (const node of selectedNodes) if (!matches(node.type, rule.nodes, profile.nodeTypes)) add(`${view.id}: node type ${node.type} is not allowed in viewpoint ${view.viewpoint}`, node, { elementId: node.id, viewId: view.id });
      for (const edge of selectedEdges) if (!matches(edge.type ?? profile.defaultRelation, rule.relations, profile.relationTypes)) add(`${view.id}: Relationship type ${edge.type ?? profile.defaultRelation} is not allowed`, edge, { elementId: edge.id, viewId: view.id });
      for (const type of rule.requiredNodes) if (!selectedNodes.some((node) => matches(node.type, [type], profile.nodeTypes))) add(`${view.id}: Missing required node type ${type}`, view, { viewId: view.id });
      for (const type of rule.requiredRelations) if (!selectedEdges.some((edge) => matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes))) add(`${view.id}: Missing required relationship type ${type}`, view, { viewId: view.id });
      for (const check of rule.connections ?? []) for (const node of selectedNodes) if (matches(node.type, check.nodes, profile.nodeTypes)) {
        const count = selectedEdges.filter((edge) => matches(edge.type ?? profile.defaultRelation, check.relations, profile.relationTypes) && (check.direction !== "incoming" && edge.source === node.id && (!check.counterparts || matches(nodes.get(edge.target)?.type, check.counterparts, profile.nodeTypes)) || check.direction !== "outgoing" && edge.target === node.id && (!check.counterparts || matches(nodes.get(edge.source)?.type, check.counterparts, profile.nodeTypes)))).length;
        if (count < check.min || check.max !== null && count > check.max) add(`${view.id}: ${node.id} requires ${check.min}–${check.max ?? "∞"} ${check.direction} connections (${check.relations.join(", ")}${check.counterparts ? `; counterpart: ${check.counterparts.join(", ")}` : ""}); found ${count}`, node, { elementId: node.id, viewId: view.id });
      }
      for (const check of rule.references ?? []) for (const item of check.nodes ? selectedNodes : selectedEdges) if (matches(item.type, check.nodes ?? check.relations, check.nodes ? profile.nodeTypes : profile.relationTypes)) {
        for (const attr of check.attributes) for (const id of [item.attributes?.[attr]].flat().filter((v) => typeof v === "string")) if (!visible.has(id))
          add(`${view.id}: ${item.id}.${attr} references ${id}, which must be visible in viewpoint ${view.viewpoint}`, item, { elementId: item.id, attribute: attr, viewId: view.id });
      }
    }
    return result;
  }
  registerProfile("default", {
    title: "arch.js standard",
    version: "1",
    nodeTypes: Object.fromEntries(TEMPLATES.map((template) => [template, { template }])),
    relationTypes: Object.fromEntries(EDGE_STYLES.map((style) => [style, { style }])),
    defaultRelation: "flow"
  });

  // src/meta-syntax.js
  var META_FORMATS = ["json", "dsl"];
  function metaCommand(command, loc) {
    const match = command.match(/^@meta\s+(json|dsl)\s*$/);
    if (!match) throw new ArchError("Use @meta json or @meta dsl inside an architecture or view", loc, "ARCH_META");
    return match[1];
  }
  function validateMetaView(view) {
    if (view.meta === void 0) return false;
    const fail8 = (message) => {
      throw new ArchError(`View ${view.id}: ${message}`, view.loc, "ARCH_META");
    };
    if (!META_FORMATS.includes(view.meta)) fail8("meta must be json or dsl");
    if (view.diagram || view.viewpoint || view.include !== void 0 || view.exclude !== void 0 || Object.keys(view.places).length || Object.keys(view.styles).length || Object.keys(view.routes).length || view.referenceRoutes?.length || view.routeDefaults !== void 0 || view.referenceDisplay !== void 0 || view.referenceOccurrences !== void 0 || view.direction !== "right" || view.spacing !== 80)
      fail8("meta views support a source format and theme; model filters, viewpoints, diagrams and layout/style settings do not apply");
    return true;
  }

  // src/diagrams.js
  var DIAGRAMS = ["connected", "sequence", "state", "activity", "matrix", "heatmap", "timeline", "class"];
  var DIAGRAM_OPTIONS = {
    connected: [],
    sequence: ["participants", "messages", "asyncMessages", "returns"],
    state: ["initial", "finals"],
    activity: ["lanes", "laneAttribute", "initial", "finals", "decisions", "forks", "joins"],
    matrix: ["rows", "columns", "relations"],
    heatmap: ["valueAttribute", "parentAttribute", "min", "max", "colorLow", "colorHigh"],
    timeline: ["startAttribute", "endAttribute"],
    class: ["attributes", "methods", "functions", "interfaces", "ports", "parameters", "ownerAttribute", "signatureAttribute", "propertyFields"]
  };
  var fields2 = DIAGRAM_OPTIONS;
  var lists = /* @__PURE__ */ new Set(["participants", "messages", "asyncMessages", "returns", "finals", "lanes", "decisions", "forks", "joins", "rows", "columns", "relations", "attributes", "methods", "functions", "interfaces", "ports", "parameters"]);
  var members = ["attributes", "methods", "functions", "interfaces", "ports", "parameters"];
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var fail4 = (message, view) => {
    throw new ArchError(`View ${view.id}: ${message}`, view.loc, "ARCH_VALIDATION");
  };
  var value = (node, name) => node.attributes?.[name] ?? node[name];
  function selected(model, view) {
    const ids = visibleNodeIds(model, view), nodes = model.nodes.filter((n) => ids.has(n.id));
    return { nodes, edges: model.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }
  function validateDiagramView(model, profile, view) {
    if (validateMetaView(view)) return;
    const c = view.diagram ?? { type: "connected" }, type = c.type;
    if (!DIAGRAMS.includes(type)) fail4(`Unknown diagram type ${type}`, view);
    const { nodes, edges } = selected(model, view), ids = new Set(nodes.map((n) => n.id)), edgeIds = new Set(edges.map((e) => e.id));
    if (type !== "connected" && (view.referenceDisplay === "nodes" || view.referenceDisplay === "both")) fail4("graphical referenceDisplay requires the connected renderer", view);
    if (type !== "connected" && view.routeDefaults !== void 0) fail4("routes defaults require the connected renderer", view);
    if (type !== "connected" && view.referenceOccurrences !== void 0) fail4("referenceOccurrences requires the connected renderer", view);
    if (type !== "connected" && Object.values(view.styles).some((style) => ["showIcon", "showLabel", "showStereotype", "showDescription", "showTechnology"].some((key) => style[key] !== void 0))) fail4("node visibility style overrides require the connected renderer", view);
    if (type !== "connected" && Object.values(view.styles).some((style) => style.iconPosition !== void 0)) fail4("iconPosition style overrides require the connected renderer", view);
    if (type !== "connected" && Object.values(view.styles).some((style) => style.display === "logo")) fail4("logo display requires the connected renderer", view);
    if (type !== "connected" && Object.values(view.styles).some((style) => ["fontSize", "width", "height"].some((field) => style[field] !== void 0))) fail4("fontSize/width/height style overrides require the connected renderer", view);
    for (const [key, v] of Object.entries(c)) {
      if (key === "type") continue;
      if (!fields2[type].includes(key)) fail4(`Option ${key} does not apply to ${type}`, view);
      if (key === "propertyFields") {
        const allowed = /* @__PURE__ */ new Set(["id", "type", "title", "description", "technology", "stereotype", "tags", ...nodes.flatMap((n) => Object.keys(profile.nodeTypes[n.type]?.attributes ?? {}))]);
        if (!Array.isArray(v) || v.length > 128 || v.some((x) => typeof x !== "string" || !allowed.has(x)) || new Set(v).size !== v.length) fail4("propertyFields requires unique declared attribute or public property names", view);
      } else if (lists.has(key)) {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string") || new Set(v).size !== v.length) fail4(`${key} requires a list of unique values`, view);
        const allowed = ["messages", "asyncMessages", "returns"].includes(key) ? edgeIds : key === "relations" ? new Set(Object.keys(profile.relationTypes)) : ids;
        for (const id of v) if (!allowed.has(id)) fail4(`${key}: unknown or invisible reference ${id}`, view);
      } else if (["min", "max"].includes(key)) {
        if (!Number.isFinite(v)) fail4(`${key} must be finite`, view);
      } else if (typeof v !== "string") fail4(`${key} must be a string`, view);
      if (key.startsWith("color") && !normalizeColor(v)) fail4(`Invalid color ${key}`, view);
    }
    if (Object.keys(view.places).length || Object.keys(view.routes).length || view.referenceRoutes?.length) {
      if (type !== "connected") fail4("place/route are only supported for connected; this renderer determines the layout", view);
    }
    if (c.initial && !ids.has(c.initial)) fail4("initial is not visible", view);
    if (type === "sequence") {
      const participants = new Set(c.participants ?? nodes.map((n) => n.id)), messages = c.messages ?? edges.map((e) => e.id);
      for (const id of messages) {
        const e = edges.find((e2) => e2.id === id);
        if (!participants.has(e.source) || !participants.has(e.target)) fail4(`Message ${id} requires both participants`, view);
      }
      for (const id of [...c.returns ?? [], ...c.asyncMessages ?? []]) if (!messages.includes(id)) fail4(`Message ${id} is not included in messages`, view);
      if ((c.returns ?? []).some((id) => (c.asyncMessages ?? []).includes(id))) fail4("A message cannot be both return and async", view);
    }
    if (type === "matrix" && ((c.rows ?? nodes).length > 100 || (c.columns ?? nodes).length > 100)) fail4("Matrix supports at most 100 rows/columns", view);
    if (type === "activity") {
      const lanes = new Set(c.lanes ?? []), tasks = nodes.filter((n) => !lanes.has(n.id));
      for (const n of tasks) if (lanes.size && !lanes.has(value(n, c.laneAttribute ?? "owner"))) fail4(`${n.id}: Missing valid lane assignment`, view);
      const kinds = [...c.decisions ?? [], ...c.forks ?? [], ...c.joins ?? []];
      if (new Set(kinds).size !== kinds.length) fail4("Activity has multiple control node kinds", view);
      for (const id of c.decisions ?? []) if (edges.filter((e) => e.source === id).length < 2) fail4(`${id}: Decision requires at least two outgoing edges`, view);
      for (const id of c.forks ?? []) if (edges.filter((e) => e.source === id).length < 2) fail4(`${id}: Fork requires at least two outgoing edges`, view);
      for (const id of c.joins ?? []) if (edges.filter((e) => e.target === id).length < 2) fail4(`${id}: Join requires at least two incoming edges`, view);
      for (const e of edges) if (lanes.has(e.source) || lanes.has(e.target)) fail4("Lane elements cannot be flow nodes", view);
    }
    if (["state", "activity"].includes(type)) {
      if (c.initial && (c.finals ?? []).includes(c.initial)) fail4("Initial and final nodes must be different", view);
      if (c.initial && edges.some((e) => e.target === c.initial)) fail4("Initial node cannot have incoming transitions", view);
      if (edges.some((e) => (c.finals ?? []).includes(e.source))) fail4("Final nodes cannot have outgoing transitions", view);
    }
    if (type === "heatmap") {
      const min = c.min ?? 0, max = c.max ?? 5;
      if (min >= max) fail4("Heatmap requires min < max", view);
      if (!c.valueAttribute) fail4("Missing valueAttribute", view);
      const parents = /* @__PURE__ */ new Map();
      for (const n of nodes) {
        const v = value(n, c.valueAttribute);
        if (v !== void 0 && (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)) fail4(`${n.id}: Heatmap value outside ${min}–${max}`, view);
        const parent = c.parentAttribute ? value(n, c.parentAttribute) : n.parent;
        if (parent !== void 0 && parent !== null) {
          if (!ids.has(parent)) fail4(`${n.id}: Heatmap parent is not visible`, view);
          parents.set(n.id, parent);
        }
      }
      for (const n of nodes) {
        const seen = /* @__PURE__ */ new Set();
        let p = n.id;
        while (parents.has(p)) {
          if (seen.has(p) || seen.size >= 32) fail4("Heatmap hierarchy is cyclic or too deep", view);
          seen.add(p);
          p = parents.get(p);
        }
      }
    }
    if (type === "timeline") for (const n of nodes) {
      const start = value(n, c.startAttribute ?? "start"), end = value(n, c.endAttribute ?? "end");
      for (const v of [start, end]) {
        const match = typeof v === "string" && v.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!match || !Number.isFinite(Date.parse(v)) || new Date(Date.parse(match[1])).toISOString().slice(0, 10) !== match[1]) fail4(`${n.id}: Valid ISO start/end values are required`, view);
      }
      if (Date.parse(start) > Date.parse(end)) fail4(`${n.id}: start is after end`, view);
    }
    if (type === "class") {
      const all = members.flatMap((k) => c[k] ?? []), memberIds = new Set(all), byId = new Map(nodes.map((n) => [n.id, n]));
      if (memberIds.size !== all.length) fail4("A detail belongs to multiple compartments", view);
      for (const id of all) {
        const owner = value(byId.get(id), c.ownerAttribute ?? "owner");
        if (!byId.has(owner) || id === owner || memberIds.has(owner) && !(c.parameters ?? []).includes(id)) fail4(`${id}: Missing valid owner`, view);
        if ((c.parameters ?? []).includes(id) && ![...c.methods ?? [], ...c.functions ?? []].includes(owner)) fail4(`${id}: Parameter requires a method/function as its owner`, view);
      }
    }
  }
  function scene(graph, theme, prefix) {
    const { nodes, edges, view, profileRules } = graph, c = { ...view.diagram, colorLow: normalizeColor(view.diagram.colorLow), colorHigh: normalizeColor(view.diagram.colorHigh) }, type = c.type;
    const dark = theme === "dark", bg = dark ? "#111827" : "#fafbfe", text = dark ? "#f1f5f9" : "#1e293b", border = dark ? "#8b9ab2" : "#64748b", muted = dark ? "#b4bfd0" : "#52627a";
    const byId = new Map(nodes.map((n) => [n.id, n])), out = [];
    let width = 900, height = 300;
    const wrap2 = (s, limit) => {
      const measure = (s2) => [...s2].reduce((sum, c2) => sum + (/[MW@%]/.test(c2) ? 1.6 : /[ilI.,:! ]/.test(c2) ? 0.5 : 1), 0);
      const lines = [];
      for (const paragraph of String(s ?? "").split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          if (line && measure(line + " " + word) > limit) {
            lines.push(line);
            line = "";
          }
          let part = "";
          for (const ch of word) {
            if (part && measure(part + ch) > limit) {
              lines.push(part);
              part = "";
            }
            part += ch;
          }
          line += (line ? " " : "") + part;
        }
        lines.push(line);
      }
      return lines;
    };
    const label = (s, x, y, w = 200, size = 13, color = text, anchor = "start") => {
      const all = wrap2(s, Math.max(1, Math.floor(w / (size * 0.65)))), lines = all.slice(0, 2);
      if (all.length > 2) lines[1] = lines[1].slice(0, -1) + "…";
      out.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}"><title>${esc(s)}</title>${lines.map((s2, i) => `<tspan x="${x}" dy="${i ? size * 1.4 : 0}">${esc(s2)}</tspan>`).join("")}</text>`);
      return lines.length * size * 1.4;
    };
    const rect = (x, y, w, h, fill = bg, opacity = 1, rx = 6) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}" stroke="${border}"/>`);
    const path = (d, arrow = false, dashed = false) => out.push(`<path d="${d}" fill="none" stroke="${border}" stroke-width="1.5"${arrow ? ` marker-end="url(#${prefix}-${typeof arrow === "string" ? arrow : "arrow"})"` : ""}${dashed ? ' stroke-dasharray="6 5"' : ""}/>`);
    const card = (n, x, y, w = 220, h = 90, body) => {
      Object.assign(n, { x, y, width: w, height: h });
      const fill = n.backgroundColor ?? (dark ? "#1e293b" : "#ffffff"), opacity = n.opacity ?? (n.backgroundColor ? 0.2 : 1), fg = foreground(composite(fill, bg, opacity));
      out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" transform="translate(${x} ${y})"><title>${esc(n.title)}</title>`);
      rect(0, 0, w, h, fill, opacity);
      label(n.type, 14, 22, w - 28, 10, fg);
      label(n.title, 14, 45, w - 28, 14, fg);
      if (body) body(fg);
      out.push("</g>");
      return { x, y, width: w, height: h };
    };
    const edgeLabel = (e, x, y) => {
      rect(x - 80, y - 14, 160, 20, bg, 1, 3);
      label(e.title, x, y, 150, 11, muted, "middle");
    };
    if (type === "sequence") {
      const participants = (c.participants ?? nodes.map((n) => n.id)).map((id) => byId.get(id));
      const messages = (c.messages ?? edges.map((e) => e.id)).map((id) => edges.find((e) => e.id === id));
      const gap = Math.max(280, ...participants.map((n) => n.title.length * 8 + 40));
      width = Math.max(500, participants.length * gap + 160);
      height = 180 + messages.reduce((sum, e) => sum + Math.max(90, Math.min(2, wrap2(e.title, 32).length) * 18 + 50), 0);
      const xs = /* @__PURE__ */ new Map();
      participants.forEach((n, i) => {
        const x = 60 + i * gap;
        xs.set(n.id, x + 110);
        card(n, x, 25, 220, 90);
        path(`M${x + 110} 115 V${height - 25}`, false, true);
      });
      let y = 155;
      messages.forEach((e, i) => {
        const a = xs.get(e.source), b = xs.get(e.target), ret = (c.returns ?? []).includes(e.id), async = (c.asyncMessages ?? []).includes(e.id);
        out.push(`<g data-edge="${esc(e.id)}" data-message="${i + 1}" data-message-kind="${ret ? "return" : async ? "async" : "sync"}">`);
        if (a === b) {
          path(`M${a} ${y} h65 v35 h-65`, !async, ret);
          if (async) path(`M${a + 10} ${y + 29} L${a} ${y + 35} l10 6`);
          label(`${i + 1}. ${e.title}`, a + 10, y - 12, 220, 12);
        } else {
          path(`M${a} ${y} H${b}`, !async, ret);
          if (async) path(`M${b + (b > a ? -10 : 10)} ${y - 6} L${b} ${y} l${b > a ? -10 : 10} 6`);
          label(`${i + 1}. ${e.title}`, (a + b) / 2, y - 15, Math.abs(b - a) - 25, 12, text, "middle");
        }
        if (!ret && !async) rect(b - 4, y, 8, 35, dark ? "#64748b" : "#cbd5e1", 1, 0);
        out.push("</g>");
        y += Math.max(90, Math.min(2, wrap2(e.title, 32).length) * 18 + 50);
      });
    } else if (type === "matrix") {
      const rows = (c.rows ?? nodes.map((n) => n.id)).map((id) => byId.get(id)), cols = (c.columns ?? nodes.map((n) => n.id)).map((id) => byId.get(id));
      const cell = 110, left = 240, top = 130;
      width = left + cols.length * cell + 40;
      height = top + rows.length * 70 + 60;
      cols.forEach((n, i) => label(n.title, left + i * cell + cell / 2, 35, cell - 12, 12, text, "middle"));
      rows.forEach((n, r) => {
        label(n.title, 10, top + r * 70 + 30, left - 25, 12);
        cols.forEach((m, k) => {
          const matching = edges.filter((e) => e.source === n.id && e.target === m.id && (!c.relations || matches(e.type, c.relations, profileRules.relationTypes)));
          const x = left + k * cell, y = top + r * 70;
          rect(x, y, cell, 70, matching.length ? dark ? "#134e4a" : "#ccfbf1" : bg, 1, 0);
          out.push(`<g data-cell="${esc(n.id)}:${esc(m.id)}"><title>${esc(matching.map((e) => `${e.type}: ${e.title}`).join("\n") || "No relationship")}</title>`);
          label(matching.length || "·", x + cell / 2, y + 40, cell, 16, text, "middle");
          out.push("</g>");
        });
      });
      label("Rows → columns · number of directed relationships", 10, height - 15, width - 20, 12, muted);
    } else if (type === "heatmap") {
      const parent = (n) => c.parentAttribute ? value(n, c.parentAttribute) : n.parent, children = (id) => nodes.filter((n) => (parent(n) ?? null) === id);
      const leaves = (n) => Math.max(1, children(n.id).reduce((sum, k) => sum + leaves(k), 0));
      const levels = (n) => 1 + Math.max(0, ...children(n.id).map(levels));
      const roots = children(null);
      width = Math.max(600, roots.reduce((sum, n) => sum + leaves(n) * 250, 0) + 40);
      height = Math.max(270, ...roots.map((n) => levels(n) * 110 + 140));
      const mix = (a, b, t) => composite(b, a, t), min = c.min ?? 0, max = c.max ?? 5;
      const tile = (n, x2, y, w, h, backdrop = bg) => {
        const v = value(n, c.valueAttribute), fill = v === void 0 ? dark ? "#64748b" : "#94a3b8" : mix(c.colorLow ?? "#fee2e2", c.colorHigh ?? "#16a34a", (v - min) / (max - min)), fg = foreground(composite(fill, backdrop, n.opacity ?? 0.2));
        out.push(`<g data-tile="${esc(n.id)}"><title>${esc(n.title)}: ${esc(v ?? "No value")}</title>`);
        rect(x2, y, w, h, fill, n.opacity ?? 0.2);
        label(`${n.title} · ${v ?? "—"}`, x2 + 12, y + 25, w - 24, 13, fg);
        out.push("</g>");
        let cx = x2 + 12;
        for (const k of children(n.id)) {
          const kw = (w - 24) * leaves(k) / leaves(n);
          tile(k, cx, y + 45, kw - 8, h - 57, composite(fill, backdrop, n.opacity ?? 0.2));
          cx += kw;
        }
      };
      let x = 20;
      for (const n of roots) {
        const w = leaves(n) * 250;
        tile(n, x, 20, w - 15, height - 105);
        x += w;
      }
      for (let i = 0; i <= 10; i++) rect(25 + i * 28, height - 55, 28, 18, mix(c.colorLow ?? "#fee2e2", c.colorHigh ?? "#16a34a", i / 10), 0.2, 0);
      label(`${min} → ${max} · — = no value`, 25, height - 12, 450, 12, muted);
    } else if (type === "timeline") {
      const data = nodes.map((n) => ({ n, start: Date.parse(value(n, c.startAttribute ?? "start")), end: Date.parse(value(n, c.endAttribute ?? "end")) }));
      const min = Math.min(...data.map((d) => d.start), 0 === data.length ? 0 : Infinity), max = Math.max(min + 864e5, ...data.map((d) => d.end));
      width = 1200;
      height = 130 + data.length * 90;
      const scale = (t) => 260 + (t - min) / (max - min) * 850, ys = /* @__PURE__ */ new Map();
      for (let i = 0; i <= 5; i++) {
        const x = 260 + i * 170;
        path(`M${x} 65 V${height - 25}`, false, true);
        label(new Date(min + (max - min) * i / 5).toISOString().slice(0, 10), x, 35, 140, 11, text, "middle");
      }
      data.forEach(({ n, start, end }, i) => {
        const y = 85 + i * 90;
        ys.set(n.id, y + 20);
        label(n.title, 10, y + 20, 230, 13);
        out.push(`<g data-bar="${esc(n.id)}"><title>${esc(n.title)}: ${esc(value(n, c.startAttribute ?? "start"))} – ${esc(value(n, c.endAttribute ?? "end"))}</title>`);
        const x = scale(start), w = scale(end) - x;
        if (!w) out.push(`<path d="M${x} ${y} l12 20 -12 20 -12 -20Z" fill="${text}"/>`);
        else rect(x, y, w, 40, n.backgroundColor ?? "#6366f1", n.opacity ?? 0.2);
        out.push("</g>");
        label(new Date(start).toISOString().slice(0, 10), x, y + 60, 160, 10, muted);
      });
      for (const e of edges) {
        const a = data.find((d) => d.n.id === e.source), b = data.find((d) => d.n.id === e.target);
        if (a && b) path(`M${scale(a.end)} ${ys.get(e.source)} H${scale(a.end) + 15} V${ys.get(e.target)} H${scale(b.start)}`, true);
      }
    } else if (type === "class") {
      const memberIds = new Set(members.flatMap((k) => c[k] ?? [])), classes = nodes.filter((n) => !memberIds.has(n.id)), pos = /* @__PURE__ */ new Map(), portPositions = /* @__PURE__ */ new Map();
      const owner = (n) => value(n, c.ownerAttribute ?? "owner"), signature = (n) => value(n, c.signatureAttribute ?? "signature") ?? n.title;
      const memberText = (m) => {
        const params = (c.parameters ?? []).map((id) => byId.get(id)).filter((p) => owner(p) === m.id).map(signature).join(", ");
        const s = String(signature(m));
        return params ? s.includes("()") ? s.replace("()", `(${params})`) : `${s} (${params})` : s;
      };
      const cardWidth = 380, cardBorder = dark ? "#37465d" : "#dce3ed";
      const sectionColor = dark ? "#a9b6cc" : "#66758c";
      const symbols = { properties: "·", attributes: "−", methods: "ƒ", functions: "ƒ", interfaces: "◇", ports: "□" };
      let x = 30;
      height = 220;
      for (const n of classes) {
        const sections = members.filter((k) => k !== "parameters").map((kind) => ({ kind, items: (c[kind] ?? []).map((id) => byId.get(id)).filter((m) => owner(m) === n.id) })).filter((s) => s.items.length);
        const lines = sections.map((s) => ({ ...s, rows: s.items.map((m) => ({ id: m.id, full: memberText(m), lines: wrap2(memberText(m), 32) })) }));
        const properties = (c.propertyFields ?? []).filter((key) => value(n, key) !== void 0).map((key) => {
          const field = value(n, key), full = `${key}: ${Array.isArray(field) ? "[" + field.join(", ") + "]" : String(field)}`;
          return { id: `${n.id}.${key}`, full, lines: wrap2(full, 32) };
        });
        if (properties.length) lines.unshift({ kind: "properties", rows: properties });
        const ownPorts = (c.ports ?? []).map((id) => byId.get(id)).filter((p) => owner(p) === n.id);
        const h = Math.max(148, 90 + ownPorts.length * 24, 110 + lines.reduce((sum, s) => sum + 50 + s.rows.reduce((count, r) => count + r.lines.length * 21, 0), 0));
        const fill = n.backgroundColor ?? (dark ? "#1e293b" : "#ffffff"), opacity = n.opacity ?? (n.backgroundColor ? 0.2 : 1);
        const visible = composite(fill, bg, opacity), fg = n.backgroundColor || n.opacity !== void 0 ? foreground(visible) : text;
        const subdued = n.backgroundColor ? fg : sectionColor;
        const accent = n.accent && contrast(n.accent, visible) >= 4.5 ? n.accent : n.backgroundColor ? fg : dark ? "#a5b4fc" : "#6366f1";
        Object.assign(n, { x, y: 40, width: cardWidth, height: h });
        pos.set(n.id, { x, y: 40, width: cardWidth, height: h });
        out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" data-class-card="true" transform="translate(${x} 40)"><title>${esc(n.title)}</title>`);
        out.push(`<rect width="${cardWidth}" height="${h}" rx="16" fill="${fill}" fill-opacity="${opacity}" stroke="${cardBorder}" filter="url(#${prefix}-class-shadow)"/>`);
        out.push(`<path d="M16 1 H${cardWidth - 16} Q${cardWidth - 1} 1 ${cardWidth - 1} 16 V95 H1 V16 Q1 1 16 1Z" fill="${accent}" fill-opacity="0.055"/>`);
        out.push(`<rect x="20" y="18" width="26" height="26" rx="7" fill="${accent}" fill-opacity="0.1"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="600">`);
        label("{}", 33, 36, 24, 12, accent, "middle");
        out.push('</g><g font-weight="600" letter-spacing="1">');
        label(String(n.stereotype ?? n.type).toUpperCase(), 58, 35, cardWidth - 80, 10, subdued);
        out.push('</g><g font-weight="650">');
        label(n.title, 20, 65, cardWidth - 40, 18, fg);
        out.push("</g>");
        let y = 116;
        for (const s of lines) {
          out.push(`<g data-compartment="${s.kind}"><title>${esc(s.rows.map((row) => row.full).join("\n"))}</title>`);
          out.push(`<path d="M20 ${y - 16} H${cardWidth - 20}" fill="none" stroke="${cardBorder}" stroke-width="0.8"/>`);
          out.push('<g font-weight="600" letter-spacing="1.2">');
          label(s.kind.toUpperCase(), 22, y, cardWidth - 85, 9.5, subdued);
          out.push("</g>");
          out.push(`<rect x="${cardWidth - 47}" y="${y - 12}" width="25" height="17" rx="8.5" fill="${subdued}" fill-opacity="0.08"/>`);
          label(s.rows.length, cardWidth - 34.5, y, 22, 9, subdued, "middle");
          y += 30;
          for (const row of s.rows) {
            out.push(`<g data-member="${esc(row.id)}"><title>${esc(row.full)}</title>`);
            label(symbols[s.kind], 24, y, 16, 12, accent);
            out.push('<g font-family="ui-monospace,SFMono-Regular,Consolas,monospace">');
            for (const line of row.lines) {
              label(line, 46, y, cardWidth - 68, 12.5, fg);
              y += 21;
            }
            out.push("</g></g>");
          }
          y += 20;
          out.push("</g>");
        }
        out.push("</g>");
        ownPorts.forEach((p, index) => {
          const py = 64 + index * 24;
          out.push(`<g data-port="${esc(p.id)}"><title>${esc(p.title)}</title><rect x="${x + cardWidth - 6}" y="${py - 6}" width="12" height="12" rx="3" fill="${dark ? "#1e293b" : "#ffffff"}" stroke="${accent}" stroke-width="1.5"/><circle cx="${x + cardWidth}" cy="${py}" r="2" fill="${accent}"/></g>`);
          portPositions.set(p.id, { x: x + cardWidth, y: py });
        });
        x += 470;
        height = Math.max(height, h + 120);
      }
      width = Math.max(500, x);
      for (const e of edges) {
        const a = pos.get(e.source), b = pos.get(e.target), pa = portPositions.get(e.source), pb = portPositions.get(e.target);
        if ((a || pa) && (b || pb)) {
          const start = pa ?? { x: a.x + a.width, y: a.y + 56 }, end = pb ?? { x: b.x, y: b.y + 56 };
          path(`M${start.x} ${start.y} L${end.x} ${end.y}`, ["generalization", "realization"].includes(e.style) ? "triangle" : !["association", "composition"].includes(e.style), ["dependency", "realization"].includes(e.style));
          edgeLabel(e, (start.x + end.x) / 2, 25);
        }
      }
    } else {
      const laneIds = c.lanes ?? [], tasks = nodes.filter((n) => !laneIds.includes(n.id)), pos = /* @__PURE__ */ new Map();
      const lanes = laneIds.length ? laneIds : [null];
      width = Math.max(850, lanes.length * 330 + 160);
      height = 130 + tasks.length * 145;
      lanes.forEach((id, i) => {
        if (id) {
          rect(25 + i * 330, 20, 320, height - 45, bg, 1, 0);
          label(byId.get(id).title, 40 + i * 330, 48, 290, 14);
          path(`M${25 + i * 330} 65 h320`);
        }
      });
      tasks.forEach((n, i) => {
        const lane = laneIds.length ? lanes.indexOf(value(n, c.laneAttribute ?? "owner")) : 0, x = laneIds.length ? 65 + lane * 330 : Math.max(80, width / 2 - 110), y = 95 + i * 145;
        pos.set(n.id, { x, y, width: 220, height: 80, inY: y + (n.id === c.initial ? 29 : (c.finals ?? []).includes(n.id) ? 20 : [...c.forks ?? [], ...c.joins ?? []].includes(n.id) ? 30 : 0), outY: y + (n.id === c.initial ? 51 : (c.finals ?? []).includes(n.id) ? 60 : [...c.forks ?? [], ...c.joins ?? []].includes(n.id) ? 42 : 80) });
        out.push(`<g data-state="${esc(n.id)}">`);
        if (n.id === c.initial || (c.finals ?? []).includes(n.id)) {
          out.push(`<circle cx="${x + 110}" cy="${y + 40}" r="${n.id === c.initial ? 11 : 15}" fill="${text}"/>`);
          if (n.id !== c.initial) out.push(`<circle cx="${x + 110}" cy="${y + 40}" r="20" fill="none" stroke="${text}"/>`);
          label(n.title, x + 140, y + 44, 110, 11);
        } else if ((c.decisions ?? []).includes(n.id)) {
          out.push(`<path d="M${x + 110} ${y} l100 40 -100 40 -100 -40Z" fill="${bg}" stroke="${border}"/>`);
          label(n.title, x + 110, y + 44, 150, 12, text, "middle");
        } else if ([...c.forks ?? [], ...c.joins ?? []].includes(n.id)) {
          rect(x, y + 30, 220, 12, text, 1, 0);
          label(n.title, x, y + 70, 220, 11);
        } else card(n, x, y, 220, 80);
        out.push("</g>");
      });
      edges.forEach((e, index) => {
        const a = pos.get(e.source), b = pos.get(e.target);
        if (!a || !b) return;
        out.push(`<g data-edge="${esc(e.id)}">`);
        if (e.source === e.target) {
          path(`M${a.x + 220} ${a.y + 20} h45 v50 h-45`, true);
          edgeLabel(e, a.x + 300, a.y + 45);
        } else if (b.y > a.y) {
          const y = (a.outY + b.inY) / 2;
          path(`M${a.x + 110} ${a.outY} V${y} H${b.x + 110} V${b.inY}`, true);
          if (e.title) edgeLabel(e, (a.x + b.x) / 2 + 110, y - 4);
        } else {
          const x = 25 + index % 3 * 14;
          path(`M${a.x} ${a.y + 40} H${x} V${b.y + 40} H${b.x}`, true);
          if (e.title) edgeLabel(e, Math.max(110, a.x - 90), (a.y + b.y) / 2 + 40);
        }
        out.push("</g>");
      });
    }
    return { body: out.join(""), width: Math.max(300, width), height: Math.max(180, height) };
  }
  function layoutDiagram(model, profile, view, nodes, edges) {
    const graph = { title: model.title, description: model.description, profile: { id: profile.id, version: profile.version }, profileRules: profile, view, nodes, edges };
    const result = scene(graph, view.theme, "measure");
    graph.bounds = { x: -20, y: -20, width: result.width + 40, height: result.height + 40 };
    return graph;
  }
  function toDiagramSVG(graph, { theme, idPrefix }) {
    const result = scene(graph, theme, idPrefix), bg = theme === "dark" ? "#111827" : "#fafbfe", stroke = theme === "dark" ? "#8b9ab2" : "#64748b";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-diagram="${graph.view.diagram.type}" role="img" aria-labelledby="${idPrefix}-title" width="${result.width + 40}" height="${result.height + 40}" viewBox="-20 -20 ${result.width + 40} ${result.height + 40}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:${bg}"><title id="${idPrefix}-title">${esc(graph.title)} — ${esc(graph.view.title)}</title><defs><filter id="${idPrefix}-class-shadow" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#0f172a" flood-opacity="${theme === "dark" ? 0.22 : 0.07}"/></filter><marker id="${idPrefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9Z" fill="${stroke}"/></marker><marker id="${idPrefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L11 6 L1 11Z" fill="${bg}" stroke="${stroke}"/></marker></defs><rect x="-20" y="-20" width="${result.width + 40}" height="${result.height + 40}" fill="${bg}"/>${result.body}</svg>`;
  }

  // src/json.js
  var own2 = (o, k) => Object.hasOwn(o, k);
  var record2 = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
  var child = (path, key) => `${path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
  var identifier2 = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
  var maxSource = 2e6;
  var isJSONDocument = (value2) => record2(value2) && (own2(value2, "architecture") || own2(value2, "@help"));
  function jsonToDSL(input) {
    const locations = /* @__PURE__ */ new Map();
    const lineStarts = [0];
    let source;
    const error = (message, path = "", offset) => {
      const loc = offset === void 0 ? locations.get(path) ?? { path } : position(offset, path);
      throw new ArchError(message, loc, "ARCH_JSON");
    };
    const position = (offset, path) => {
      let low = 0, high = lineStarts.length;
      while (low + 1 < high) {
        const mid = low + high >>> 1;
        if (lineStarts[mid] <= offset) low = mid;
        else high = mid;
      }
      return { path, line: low + 1, column: offset - lineStarts[low] + 1 };
    };
    if (typeof input === "string") source = input;
    else {
      const ancestors = /* @__PURE__ */ new Set();
      const check = (value2, path, depth = 0) => {
        if (depth > 128) error("JSON nesting exceeds 128 levels", path);
        if (value2 === null || ["string", "boolean"].includes(typeof value2)) return;
        if (typeof value2 === "number" && Number.isFinite(value2)) return;
        if (typeof value2 !== "object" || !value2 || !Array.isArray(value2) && Object.getPrototypeOf(value2) !== null && Object.getPrototypeOf(Object.getPrototypeOf(value2)) !== null) error("Expected a JSON value", path);
        if (ancestors.has(value2)) error("Cyclic JSON document", path);
        ancestors.add(value2);
        for (const key of Reflect.ownKeys(value2)) {
          if (Array.isArray(value2) && key === "length") continue;
          if (typeof key !== "string") error("JSON keys must be strings", path);
          const descriptor = Object.getOwnPropertyDescriptor(value2, key);
          if (!own2(descriptor, "value")) error("JSON properties must be data values", child(path, key));
          check(descriptor.value, child(path, key), depth + 1);
        }
        ancestors.delete(value2);
      };
      check(input, "");
      source = JSON.stringify(input);
    }
    if (source.length > maxSource) error("Source exceeds 2 MB");
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
    try {
      JSON.parse(source);
    } catch (e) {
      const nativePosition = e.message.match(/position (\d+)/), nativeLine = e.message.match(/line (\d+) column (\d+)/);
      const at = nativePosition ? Number(nativePosition[1]) : nativeLine ? (lineStarts[Number(nativeLine[1]) - 1] ?? 0) + Number(nativeLine[2]) - 1 : source.length;
      error(`Invalid JSON: ${e.message}`, "", at);
    }
    let cursor = 0;
    const space = () => {
      while (/\s/.test(source[cursor] ?? "") && cursor < source.length) cursor++;
    };
    const string = () => {
      const start = cursor++;
      while (source[cursor] !== '"') {
        if (source[cursor] === "\\") cursor++;
        cursor++;
      }
      cursor++;
      return JSON.parse(source.slice(start, cursor));
    };
    const read = (path = "", depth = 0) => {
      space();
      locations.set(path, position(cursor, path));
      if (depth > 128) error("JSON nesting exceeds 128 levels", path);
      if (source[cursor] === "{") {
        cursor++;
        space();
        const result = /* @__PURE__ */ Object.create(null);
        while (source[cursor] !== "}") {
          const start2 = cursor, key = string(), next = child(path, key);
          if (own2(result, key)) error(`Duplicate JSON key: ${key}`, next, start2);
          space();
          cursor++;
          result[key] = read(next, depth + 1);
          space();
          if (source[cursor] !== ",") break;
          cursor++;
          space();
        }
        cursor++;
        return result;
      }
      if (source[cursor] === "[") {
        cursor++;
        space();
        const result = [];
        while (source[cursor] !== "]") {
          result.push(read(child(path, result.length), depth + 1));
          space();
          if (source[cursor] !== ",") break;
          cursor++;
        }
        cursor++;
        return result;
      }
      if (source[cursor] === '"') return string();
      const start = cursor;
      while (cursor < source.length && !/[\s,}\]]/.test(source[cursor])) cursor++;
      return JSON.parse(source.slice(start, cursor));
    };
    const document = read();
    const obj = (value2, path) => {
      if (!record2(value2)) error("Expected an object", path);
      return value2;
    };
    const keys2 = (value2, allowed, path) => {
      obj(value2, path);
      for (const key of Object.keys(value2)) if (!allowed.includes(key)) error(`Unknown JSON field: ${key}`, child(path, key));
    };
    const id = (value2, path) => {
      if (typeof value2 !== "string" || !identifier2.test(value2)) error("Expected an identifier", path);
      return value2;
    };
    const text = (value2, path) => {
      if (typeof value2 !== "string") error("Expected a string", path);
      return JSON.stringify(value2);
    };
    const scalar = (value2, path) => {
      if (Array.isArray(value2)) {
        if (value2.length > 4e3) error("At most 4000 list entries are allowed", path);
        if (value2.some((v) => Array.isArray(v))) error("Nested attribute lists are not allowed", path);
        return `[${value2.map((v, i) => scalar(v, child(path, i))).join(", ")}]`;
      }
      if (typeof value2 === "string") return text(value2, path);
      if (typeof value2 === "boolean" || typeof value2 === "number" && Number.isFinite(value2)) return String(value2);
      error("Expected a string, finite number, boolean or flat list", path);
    };
    const list2 = (value2, path) => {
      const values = Array.isArray(value2) ? value2 : [value2];
      if (!values.length) error("Expected a nonempty list", path);
      return values.map((v, i) => text(v, Array.isArray(value2) ? child(path, i) : path)).join(", ");
    };
    const point2 = (value2, path) => {
      if (!Array.isArray(value2) || value2.length !== 2 || value2.some((v) => typeof v !== "number" || !Number.isFinite(v))) error("Expected a coordinate pair [x, y]", path);
      return `(${value2.join(", ")})`;
    };
    const entries = (value2, path) => {
      if (Array.isArray(value2)) return value2.map((v, i) => {
        const p = child(path, i);
        obj(v, p);
        return [id(v.id, child(p, "id")), v, p];
      });
      return Object.entries(obj(value2, path)).map(([key, v]) => {
        const p = child(path, key);
        id(key, p);
        obj(v, p);
        if (own2(v, "id")) error("Use either an object key or an array entry with id", child(p, "id"));
        return [key, v, p];
      });
    };
    const lines = [], origins = [];
    let generatedLength = 0;
    const emit = (line, path) => {
      generatedLength += line.length + 1;
      if (generatedLength > maxSource) error("Normalized source exceeds 2 MB", path);
      lines.push(line);
      origins.push(locations.get(path) ?? { path });
    };
    const field = (key, value2, path) => emit(`${id(key, path)} ${scalar(value2, path)}`, path);
    const attributes2 = (value2, path, reserved = []) => {
      obj(value2, path);
      for (const [key, v] of Object.entries(value2)) {
        const p = child(path, key);
        if (reserved.includes(key)) error(`Reserved attribute: ${key}`, p);
        field(key, v, p);
      }
    };
    const config = (value2, path) => {
      obj(value2, path);
      emit("config {", path);
      for (const [key, v] of Object.entries(value2)) {
        const p = child(path, key);
        if (["type", "relation", "viewpoint", "styleGroup"].includes(key)) {
          for (const [name, rule, rp] of entries(v, p)) {
            emit(`${key} ${name} {`, rp);
            for (const [attr, a] of Object.entries(rule)) {
              if (attr === "id") continue;
              const ap = child(rp, attr);
              if (["attribute", "attributes"].includes(attr)) {
                for (const [name2, schema, sp] of entries(a, ap)) {
                  emit(`attribute ${name2} {`, sp);
                  for (const [option, optionValue] of Object.entries(schema)) if (option !== "id") {
                    const op = child(sp, option);
                    let value3;
                    if (option === "enum") {
                      const values = Array.isArray(optionValue) ? optionValue : [optionValue];
                      if (!values.length) error("Expected a nonempty enum list", op);
                      value3 = values.map((v2, i) => scalar(v2, child(op, i))).join(", ");
                    } else value3 = option === "targets" ? list2(optionValue, op) : scalar(optionValue, op);
                    emit(`${id(option, op)} ${value3}`, op);
                  }
                  emit("}", sp);
                }
              } else if (["incoming", "outgoing"].includes(attr)) {
                obj(a, ap);
                emit(`${attr} {`, ap);
                attributes2(a, ap);
                emit("}", ap);
              } else {
                const asList = ["extends", "contains", "from", "to", "nodes", "relations", "requiredNodes", "requiredRelations"].includes(attr);
                emit(`${id(attr, ap)} ${asList ? list2(a, ap) : scalar(a, ap)}`, ap);
              }
            }
            emit("}", rp);
          }
        } else field(key, v, p);
      }
      emit("}", path);
    };
    let nodeCount = 0, edgeCount = 0;
    const model = (value2, path, depth = 0) => {
      keys2(value2, ["elements", "relations"], path);
      for (const [key, collection2] of Object.entries(value2)) for (const [name, item, p] of entries(collection2, child(path, key))) {
        if (key === "elements") {
          if (++nodeCount > 1e3) error("At most 1000 elements are allowed", p);
          if (depth > 32) error("Packages may be nested at most 32 levels deep", p);
          emit(`${id(item.type, child(p, "type"))} ${name} ${text(item.name, child(p, "name"))} {`, p);
        } else {
          if (++edgeCount > 4e3) error("At most 4000 relationships are allowed", p);
          emit(`relation ${name} ${id(item.from, child(p, "from"))} -> ${id(item.to, child(p, "to"))} ${text(item.name, child(p, "name"))} {`, p);
        }
        const reserved = key === "elements" ? ["id", "type", "name", "elements", "relations"] : ["id", "name", "from", "to"];
        const written = /* @__PURE__ */ new Set();
        const attribute = (attr, v, ap) => {
          if (written.has(attr)) error(`Duplicate attribute: ${attr}`, ap);
          written.add(attr);
          field(attr, v, ap);
        };
        for (const [attr, v] of Object.entries(item)) {
          const ap = child(p, attr);
          if (reserved.includes(attr)) continue;
          if (attr === "attributes") {
            obj(v, ap);
            for (const [a, av] of Object.entries(v)) attribute(a, av, child(ap, a));
          } else attribute(attr, v, ap);
        }
        if (key === "elements" && (own2(item, "elements") || own2(item, "relations"))) {
          const nested = /* @__PURE__ */ Object.create(null);
          if (own2(item, "elements")) nested.elements = item.elements;
          if (own2(item, "relations")) nested.relations = item.relations;
          model(nested, p, depth + 1);
        }
        emit("}", p);
      }
    };
    const routing = (value2, path) => {
      obj(value2, path);
      emit("{", path);
      for (const [key, v] of Object.entries(value2)) {
        const p = child(path, key);
        if (key === "via") {
          if (!Array.isArray(v) || !v.length) error("Expected a nonempty list of coordinate pairs", p);
          emit(`via ${v.map((pair, i) => point2(pair, child(p, i))).join(", ")}`, p);
        } else if (["from", "to", "label"].includes(key) && Array.isArray(v)) emit(`${key} ${point2(v, p)}`, p);
        else if (key === "label" && v === "none") emit("label none", p);
        else field(key, v, p);
      }
      emit("}", path);
    };
    const help2 = (command, path) => {
      text(command, path);
      let quoted = false;
      for (let i = 0; i < command.length; i++) {
        const c = command[i];
        if (quoted && c === "\\") {
          i++;
          continue;
        }
        if (c === '"') quoted = !quoted;
        if (/[\r\n]/.test(c) || !quoted && /[;}]/.test(c)) error("Expected a single help query without @help", path);
      }
      emit(`@help ${command}`, path);
    };
    const views = (value2, path) => {
      for (const [name, view, p] of entries(value2, path)) {
        emit(`view ${name} ${text(view.name, child(p, "name"))} {`, p);
        for (const [key, v] of Object.entries(view)) {
          const vp = child(p, key);
          if (["id", "name"].includes(key)) continue;
          if (["meta", "@meta"].includes(key)) {
            if (!["json", "dsl"].includes(v)) error("meta must be json or dsl", vp);
            emit(`@meta ${v}`, vp);
          } else if (["place", "style", "route"].includes(key)) {
            obj(v, vp);
            for (const [target, rule] of Object.entries(v)) {
              const rp = child(vp, target);
              obj(rule, rp);
              if (key === "route") {
                const pair = target.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*->\s*([A-Za-z_][A-Za-z0-9_.-]*)$/);
                emit(`route ${pair ? `${pair[1]} -> ${pair[2]}` : id(target, rp)}`, rp);
                routing(rule, rp);
              } else if (key === "place") {
                keys2(rule, ["at", "size"], rp);
                emit(`place ${id(target, rp)} at ${point2(rule.at, child(rp, "at"))}${own2(rule, "size") ? ` size ${point2(rule.size, child(rp, "size"))}` : ""}`, rp);
              } else {
                emit(`style ${id(target, rp)} {`, rp);
                attributes2(rule, rp);
                emit("}", rp);
              }
            }
          } else if (key === "routes") {
            emit("routes", vp);
            routing(v, vp);
          } else if (key === "diagram") {
            if (typeof v === "string") emit(`diagram ${id(v, vp)}`, vp);
            else {
              obj(v, vp);
              emit(`diagram ${id(v.type, child(vp, "type"))} {`, vp);
              for (const [option, a] of Object.entries(v)) if (option !== "type") field(option, a, child(vp, option));
              emit("}", vp);
            }
          } else if (["include", "exclude"].includes(key)) {
            const values = Array.isArray(v) ? v : [v];
            if (!values.length) error("Expected a nonempty identifier list", vp);
            emit(`${key} ${values.map((a, i) => id(a, Array.isArray(v) ? child(vp, i) : vp)).join(", ")}`, vp);
          } else if (["direction", "theme", "viewpoint", "referenceDisplay", "referenceOccurrences"].includes(key)) emit(`${key} ${id(v, vp)}`, vp);
          else field(key, v, vp);
        }
        emit("}", p);
      }
    };
    obj(document, "");
    if (own2(document, "@help")) {
      keys2(document, ["@help"], "");
      help2(document["@help"], "/@help");
    } else {
      keys2(document, ["architecture"], "");
      const a = obj(document.architecture, "/architecture");
      keys2(a, ["name", "description", "config", "model", "views", "@help", "@meta"], "/architecture");
      emit(`architecture ${text(a.name, "/architecture/name")} {`, "/architecture");
      if (own2(a, "description")) emit(`description ${text(a.description, "/architecture/description")}`, "/architecture/description");
      if (own2(a, "config")) config(a.config, "/architecture/config");
      if (own2(a, "@help")) {
        help2(a["@help"], "/architecture/@help");
      }
      if (own2(a, "model")) {
        emit("model {", "/architecture/model");
        model(a.model, "/architecture/model");
        emit("}", "/architecture/model");
      }
      if (own2(a, "views")) views(a.views, "/architecture/views");
      if (own2(a, "@meta")) {
        const format = a["@meta"];
        if (!["json", "dsl"].includes(format)) error("meta must be json or dsl", "/architecture/@meta");
        emit(`@meta ${format}`, "/architecture/@meta");
      }
      emit("}", "/architecture");
    }
    return { source: lines.join("\n"), origin: (line) => origins[line - 1] ?? { path: "" } };
  }

  // src/parser.js
  var dict = () => /* @__PURE__ */ Object.create(null);
  var fail5 = (message, loc, code = "ARCH_VALIDATION") => {
    throw new ArchError(message, loc, code);
  };
  function tokenize(source) {
    const tokens2 = [];
    let i = 0, line = 1, column = 1;
    const advance = (n) => {
      for (let j = 0; j < n; j++) {
        if (source[i++] === "\n") {
          line++;
          column = 1;
        } else column++;
      }
    };
    while (i < source.length) {
      const c = source[i], loc = { line, column };
      if (/\s/.test(c) || c === ";") {
        advance(1);
        continue;
      }
      if (c === "#" || source.slice(i, i + 2) === "//") {
        while (i < source.length && source[i] !== "\n") advance(1);
        continue;
      }
      if (c === "@") {
        let end = i, quoted = false;
        while (end < source.length) {
          const char = source[end];
          if (quoted && char === "\\") {
            end += 2;
            continue;
          }
          if (char === '"') quoted = !quoted;
          if (char === "\n" || !quoted && (";}".includes(char) || char === "#" || source.slice(end, end + 2) === "//")) break;
          end++;
        }
        tokens2.push({ type: "directive", value: source.slice(i, end), ...loc });
        advance(end - i);
        continue;
      }
      if (source.slice(i, i + 2) === "->") {
        tokens2.push({ type: "->", value: "->", ...loc });
        advance(2);
        continue;
      }
      if ("{}(),[]".includes(c)) {
        tokens2.push({ type: c, value: c, ...loc });
        advance(1);
        continue;
      }
      if (c === '"') {
        let end = i + 1;
        while (end < source.length) {
          if (source[end] === "\\") {
            end += 2;
            continue;
          }
          if (source[end] === '"') break;
          end++;
        }
        if (end >= source.length) fail5("Unclosed string", loc, "ARCH_SYNTAX");
        const raw = source.slice(i, end + 1);
        let value2;
        try {
          value2 = JSON.parse(raw);
        } catch {
          fail5("Invalid string or escape sequence", loc, "ARCH_SYNTAX");
        }
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value2) || [...value2].some((char) => {
          const code = char.codePointAt(0);
          return code >= 55296 && code <= 57343;
        }))
          fail5("String contains a Unicode character that is invalid in SVG", loc, "ARCH_SYNTAX");
        tokens2.push({ type: "string", value: value2, ...loc });
        advance(raw.length);
        continue;
      }
      const number2 = source.slice(i).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number2) {
        const value2 = Number(number2[0]);
        if (!Number.isFinite(value2)) fail5("Number must be finite", loc);
        tokens2.push({ type: "number", value: value2, ...loc });
        advance(number2[0].length);
        continue;
      }
      const word = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.-]*/);
      if (word) {
        const value2 = word[0].replace(/-$/, (match) => source[i + word[0].length] === ">" ? "" : match);
        tokens2.push({ type: "word", value: value2, ...loc });
        advance(value2.length);
        continue;
      }
      fail5(`Unexpected character ${JSON.stringify(c)}`, loc, "ARCH_SYNTAX");
    }
    tokens2.push({ type: "eof", value: "", line, column });
    return tokens2;
  }
  function parseDocument(source) {
    if (source === null || !["string", "object"].includes(typeof source)) fail5("Source must be a string or a JSON architecture object");
    if (typeof source !== "string" || /^[\s\uFEFF]*[\[{]/.test(source)) {
      const translated = jsonToDSL(source);
      let model;
      try {
        model = parseDSLDocument(translated.source);
      } catch (error) {
        if (!(error instanceof ArchError)) throw error;
        const message = error.message.replace(/ \(line \d+, column \d+\)$/, "");
        throw new ArchError(message, translated.origin(error.line), error.code);
      }
      const seen = /* @__PURE__ */ new Set();
      const relocate = (value2) => {
        if (!value2 || typeof value2 !== "object" || seen.has(value2)) return;
        seen.add(value2);
        if (typeof value2.line === "number" && typeof value2.column === "number") Object.assign(value2, translated.origin(value2.line));
        for (const child2 of Object.values(value2)) relocate(child2);
      };
      relocate(model);
      return model;
    }
    return parseDSLDocument(source);
  }
  function parseDSLDocument(source) {
    if (typeof source !== "string") fail5("Source must be a string");
    if (source.length > 2e6) fail5("Source exceeds 2 MB");
    const tokens2 = tokenize(source);
    let cursor = 0;
    const peek = () => tokens2[cursor];
    const is = (value2) => peek().value === value2;
    const take = () => tokens2[cursor++];
    const expect = (value2) => {
      if (!is(value2)) fail5(`Expected: ${value2}; found: ${peek().value || "end of input"}`, peek(), "ARCH_SYNTAX");
      return take();
    };
    const typed = (type, label = type) => {
      if (peek().type !== type) fail5(`Expected: ${label}; found: ${peek().value || "end of input"}`, peek(), "ARCH_SYNTAX");
      return take();
    };
    const word = () => typed("word", "identifier").value;
    const text = () => {
      if (!["word", "string"].includes(peek().type)) fail5("Expected a string or word", peek(), "ARCH_SYNTAX");
      return take().value;
    };
    const scalar = () => {
      if (is("[")) {
        take();
        const values = [];
        if (!is("]")) {
          if (is("[")) fail5("Nested lists are not allowed", peek());
          values.push(scalar());
          while (is(",")) {
            take();
            if (is("[")) fail5("Nested lists are not allowed", peek());
            values.push(scalar());
            if (values.length > 4e3) fail5("At most 4000 list entries are allowed", peek());
          }
        }
        expect("]");
        return values;
      }
      if (peek().type === "number" || peek().type === "string") return take().value;
      const value2 = word();
      return value2 === "true" ? true : value2 === "false" ? false : value2;
    };
    const point2 = () => {
      expect("(");
      const x = typed("number");
      expect(",");
      const y = typed("number");
      expect(")");
      for (const token of [x, y]) if (Math.abs(token.value) > 1e7) fail5("Coordinate outside the range ±10000000", token);
      return { x: x.value, y: y.value };
    };
    const list2 = (fn) => {
      const result = [fn()];
      while (is(",")) {
        take();
        result.push(fn());
      }
      return result;
    };
    const block = (fn) => {
      expect("{");
      while (!is("}")) {
        if (peek().type === "eof") fail5("Unclosed block; expected: }", peek(), "ARCH_SYNTAX");
        fn();
      }
      expect("}");
    };
    const property = (object, allowed) => {
      const key = typed("word");
      if (!allowed.includes(key.value)) fail5(`Unknown attribute: ${key.value}`, key);
      if (Object.hasOwn(object, key.value)) fail5(`Duplicate attribute: ${key.value}`, key);
      if (["showIcon", "showLabel", "showStereotype", "showDescription", "showTechnology"].includes(key.value)) {
        object[key.value] = scalar();
        return;
      }
      object[key.value] = ["opacity", "fontSize", "width", "height"].includes(key.value) ? typed("number").value : text();
    };
    const modelProperty = (object, builtins, relation = false) => {
      const key = typed("word");
      object.attributes ?? (object.attributes = dict());
      object.attributeLocs ?? (object.attributeLocs = dict());
      if (Object.hasOwn(object.attributes, key.value) || (builtins.includes(key.value) || relation && key.value === "type") && Object.hasOwn(object, key.value))
        fail5(`Duplicate attribute: ${key.value}`, key);
      object.attributeLocs[key.value] = key;
      if (builtins.includes(key.value) || relation && key.value === "type") object[key.value] = key.value === "opacity" ? typed("number").value : text();
      else object.attributes[key.value] = scalar();
    };
    if (peek().type === "directive") {
      const directive = take();
      if (/^@meta\b/.test(directive.value)) fail5("@meta requires architecture source; place @meta json or @meta dsl inside an architecture or view", directive, "ARCH_META");
      typed("eof", "end of input");
      return helpDocument(parseHelpCommand(directive.value));
    }
    expect("architecture");
    const model = { title: typed("string", "architecture title").value, description: "", nodes: [], edges: [], views: [] };
    let hasModel = false, hasDescription = false;
    const element = (parent = null, depth = 0) => {
      if (depth > 32) fail5("Packages may be nested at most 32 levels deep", peek());
      const token = typed("word");
      if (token.value === "relation") {
        const edge = { id: word(), source: word(), loc: token };
        expect("->");
        edge.target = word();
        edge.title = typed("string", "relationship label").value;
        if (is("{")) block(() => modelProperty(edge, EDGE_PROPERTIES, true));
        model.edges.push(edge);
        return;
      }
      const node = { type: token.value, id: word(), title: typed("string", "element title").value, parent, loc: token };
      model.nodes.push(node);
      if (is("{")) block(() => {
        if (is("relation") || peek().type === "word" && tokens2[cursor + 1]?.type === "word" && tokens2[cursor + 2]?.type === "string") element(node.id, depth + 1);
        else modelProperty(node, NODE_PROPERTIES);
      });
    };
    const readRouting = (item, reference2 = false, defaults = false) => block(() => {
      const attr = typed("word");
      const allowed = reference2 ? ["from", "to", "via", "curve", "path"] : ["from", "to", "via", "curve", "label", "path", "icon", "iconPosition", "showIcon", "showLabel"];
      if (!allowed.includes(attr.value)) fail5(`Unknown routing attribute: ${attr.value}`, attr);
      if (Object.hasOwn(item, attr.value)) fail5(`Duplicate routing attribute: ${attr.value}`, attr);
      if (["showIcon", "showLabel"].includes(attr.value)) item[attr.value] = scalar();
      else if (attr.value === "via") item.via = list2(point2);
      else if (attr.value === "to" && (reference2 || defaults && peek().type === "number")) item.to = typed("number", "position along the relationship (0 to 1)").value;
      else if (attr.value === "label") {
        if (is("none")) {
          take();
          item.label = "none";
        } else item.label = point2();
      } else if (["from", "to"].includes(attr.value) && is("(")) item[attr.value] = point2();
      else item[attr.value] = text();
    });
    const readView = () => {
      const token = expect("view");
      const view = {
        id: word(),
        title: typed("string", "view title").value,
        places: dict(),
        styles: dict(),
        routes: dict(),
        loc: token
      };
      const seen = /* @__PURE__ */ new Set();
      block(() => {
        if (peek().type === "directive") {
          const directive = take();
          if (!/^@meta\b/.test(directive.value)) fail5("Only @meta directives are allowed inside a view", directive, "ARCH_META");
          if (seen.has("meta")) fail5("Only one meta directive is allowed per view", directive, "ARCH_META");
          seen.add("meta");
          view.meta = metaCommand(directive.value, directive);
          return;
        }
        const key = typed("word");
        if (key.value === "route" && peek().type === "word" && tokens2[cursor + 1]?.type === "->") {
          const nodeId = word();
          expect("->");
          const edgeId = word();
          view.referenceRoutes ?? (view.referenceRoutes = []);
          if (view.referenceRoutes.some((route2) => route2.nodeId === nodeId && route2.edgeId === edgeId))
            fail5(`Duplicate reference route: ${nodeId} -> ${edgeId}`, key);
          const route = { nodeId, edgeId, loc: key };
          readRouting(route, true);
          view.referenceRoutes.push(route);
        } else if (["place", "style", "route"].includes(key.value)) {
          const id = word(), collection2 = view[{ place: "places", style: "styles", route: "routes" }[key.value]];
          if (Object.hasOwn(collection2, id)) fail5(`Duplicate ${key.value}-statement: ${id}`, key);
          const item = { loc: key };
          if (key.value === "place") {
            expect("at");
            item.at = point2();
            if (is("size")) {
              take();
              item.size = point2();
            }
          } else if (key.value === "style") {
            block(() => property(item, ["template", "accent", "icon", "iconPosition", "backgroundColor", "opacity", "display", "fontSize", "width", "height", "showIcon", "showLabel", "showStereotype", "showDescription", "showTechnology"]));
          } else readRouting(item);
          collection2[id] = item;
        } else {
          if (seen.has(key.value)) fail5(`Duplicate view option: ${key.value}`, key);
          seen.add(key.value);
          if (key.value === "meta") view.meta = text();
          else if (key.value === "diagram") {
            view.diagram = { type: word() };
            if (is("{")) block(() => {
              const option = typed("word");
              if (Object.hasOwn(view.diagram, option.value)) fail5(`Duplicate diagram option: ${option.value}`, option);
              view.diagram[option.value] = scalar();
            });
          } else if (key.value === "routes") {
            view.routeDefaults = { loc: key };
            readRouting(view.routeDefaults, false, true);
          } else if (["include", "exclude"].includes(key.value)) view[key.value] = list2(word);
          else if (key.value === "spacing") view.spacing = typed("number").value;
          else if (["direction", "theme", "viewpoint", "referenceDisplay", "referenceOccurrences"].includes(key.value)) view[key.value] = word();
          else fail5(`Unknown view option: ${key.value}`, key);
        }
      });
      view.direction ?? (view.direction = "right");
      view.theme ?? (view.theme = "light");
      view.spacing ?? (view.spacing = 80);
      model.views.push(view);
    };
    const readConfig = () => {
      const loc = expect("config");
      if (model.config) fail5("Only one config block is allowed", loc);
      const definition = { id: "inline", nodeTypes: dict(), relationTypes: dict(), viewpoints: dict(), styleGroups: dict() };
      const config = { loc, definition }, seen = /* @__PURE__ */ new Set();
      const once = (object, key, loc2) => {
        if (Object.hasOwn(object, key)) fail5(`Duplicate profile option: ${key}`, loc2);
      };
      const readAttribute = (attributes2, keyword) => {
        const name = word();
        once(attributes2, name, keyword);
        const rule = dict();
        block(() => {
          const key = typed("word");
          once(rule, key.value, key);
          if (key.value === "enum") rule.enum = list2(scalar);
          else if (key.value === "targets") rule.targets = list2(text);
          else if (["type", "required", "min", "max", "minLength", "maxLength", "format", "many", "minItems", "maxItems", "uniqueItems"].includes(key.value)) rule[key.value] = scalar();
          else fail5(`Unknown attribute rule: ${key.value}`, key);
        });
        attributes2[name] = rule;
      };
      block(() => {
        const key = typed("word");
        if (["type", "relation", "viewpoint", "styleGroup"].includes(key.value)) {
          const name = word(), collection2 = definition[{ type: "nodeTypes", relation: "relationTypes", viewpoint: "viewpoints", styleGroup: "styleGroups" }[key.value]];
          once(collection2, name, key);
          const rule = dict();
          block(() => {
            const attr = typed("word");
            if (attr.value === "attribute" && key.value !== "viewpoint") {
              rule.attributes ?? (rule.attributes = dict());
              readAttribute(rule.attributes, attr);
            } else if (attr.value === "attributes" && key.value !== "viewpoint") {
              once(rule, "attributes", attr);
              rule.attributes = dict();
              block(() => {
                const keyword = expect("attribute");
                readAttribute(rule.attributes, keyword);
              });
            } else if (["incoming", "outgoing"].includes(attr.value) && key.value === "relation") {
              once(rule, attr.value, attr);
              const count = dict();
              block(() => {
                const bound = typed("word");
                once(count, bound.value, bound);
                if (!["min", "max"].includes(bound.value)) fail5("Expected: min or max", bound);
                count[bound.value] = typed("number").value;
              });
              rule[attr.value] = count;
            } else {
              once(rule, attr.value, attr);
              const listKeys = key.value === "type" ? ["contains"] : key.value === "relation" ? ["from", "to"] : ["nodes", "relations", "requiredNodes", "requiredRelations"];
              const scalarKeys = key.value === "type" ? ["extends", "template", "container", "abstract", "icon", "accent", "backgroundColor", "styleGroup"] : key.value === "relation" ? ["extends", "style", "abstract", "allowSelf", "acyclic"] : key.value === "styleGroup" ? ["backgroundColor"] : [];
              if (attr.value === "extends") {
                const parents = list2(text);
                rule.extends = parents.length === 1 ? parents[0] : parents;
              } else if (listKeys.includes(attr.value)) rule[attr.value] = list2(text);
              else if (scalarKeys.includes(attr.value)) rule[attr.value] = scalar();
              else fail5(`Unknown profile rule: ${attr.value}`, attr);
            }
          });
          collection2[name] = rule;
        } else {
          if (seen.has(key.value)) fail5(`Duplicate profile option: ${key.value}`, key);
          seen.add(key.value);
          if (key.value === "profile") config.profile = text();
          else if (key.value === "views") config.views = scalar();
          else if (["id", "title", "version", "extends", "defaultRelation", "requireViewpoint"].includes(key.value)) definition[key.value] = scalar();
          else fail5(`Unknown config option: ${key.value}`, key);
        }
      });
      const hasDefinition = Object.keys(definition.nodeTypes).length || Object.keys(definition.relationTypes).length || Object.keys(definition.viewpoints).length || Object.keys(definition.styleGroups).length || definition.extends;
      if (config.profile && (hasDefinition || [...seen].some((key) => !["profile", "views"].includes(key)))) fail5("Choose either config profile or an inline profile definition", loc);
      if (config.profile || !hasDefinition && seen.size === 1 && seen.has("views")) delete config.definition;
      model.config = config;
    };
    block(() => {
      if (peek().type === "directive") {
        const directive = take();
        if (/^@meta\b/.test(directive.value)) {
          const format = metaCommand(directive.value, directive);
          model.views.push({
            id: `meta-${format}`,
            title: `Architecture as ${format.toUpperCase()}`,
            meta: format,
            direction: "right",
            theme: "light",
            spacing: 80,
            places: dict(),
            styles: dict(),
            routes: dict(),
            loc: directive
          });
          return;
        }
        if (model.help) fail5("Only one @help command is allowed per architecture", directive, "ARCH_HELP");
        model.help = parseHelpCommand(directive.value);
      } else if (is("description")) {
        if (hasDescription) fail5("Duplicate architecture description", peek());
        take();
        model.description = text();
        hasDescription = true;
      } else if (is("model")) {
        if (hasModel) fail5("Only one model block is allowed", peek());
        take();
        block(() => element());
        hasModel = true;
      } else if (is("view")) readView();
      else if (is("config")) readConfig();
      else fail5("Expected: model, view, config, description, @help or @meta", peek(), "ARCH_SYNTAX");
    });
    typed("eof", "end of input");
    if (model.help) return { ...model, ...helpDocument(model.help), title: model.title, config: model.config };
    if (!hasModel) fail5("Missing model block");
    if (model.nodes.length > 1e3 || model.edges.length > 4e3) fail5("At most 1000 elements and 4000 relationships are allowed");
    if (!model.views.length) model.views.push({
      id: "default",
      title: model.title,
      direction: "right",
      theme: "light",
      spacing: 80,
      places: dict(),
      styles: dict(),
      routes: dict()
    });
    return model;
  }
  function parse(source, options = {}) {
    const model = parseDocument(source);
    model.profile = resolveProfile(model, options);
    for (const edge of model.edges) if (edge.type === void 0 && model.profile.defaultRelation !== null) edge.type = model.profile.defaultRelation;
    validateModel(model);
    return model;
  }
  function validateModel(model, options = {}) {
    if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views) || !model.views.length)
      fail5("Invalid model; use parse(source)");
    const profile = resolveProfile(model, options);
    if (model.kind === "help") {
      request(model.help?.topic, model.help?.parameters);
      return model;
    }
    const ids = /* @__PURE__ */ new Set(), nodes = new Map(model.nodes.map((n) => [n.id, n]));
    for (const item of [...model.nodes, ...model.edges]) {
      if (ids.has(item.id)) fail5(`Duplicate ID: ${item.id}`, item.loc);
      ids.add(item.id);
    }
    for (const node of model.nodes) {
      if (node.parent && !nodes.has(node.parent)) fail5(`Unknown container: ${node.parent}`, node.loc);
      const ancestry = /* @__PURE__ */ new Set([node.id]);
      let parent = nodes.get(node.parent);
      while (parent) {
        if (ancestry.has(parent.id)) fail5(`Cyclic package hierarchy: ${node.id}`, node.loc);
        ancestry.add(parent.id);
        parent = nodes.get(parent.parent);
      }
    }
    for (const edge of model.edges) {
      for (const id of [edge.source, edge.target]) if (!nodes.has(id)) fail5(`Unknown endpoint: ${id}`, edge.loc);
    }
    const views = /* @__PURE__ */ new Set();
    for (const view of model.views) {
      if (views.has(view.id)) fail5(`Duplicate view ID: ${view.id}`, view.loc);
      views.add(view.id);
      if (!["right", "down"].includes(view.direction)) fail5("direction must be right or down", view.loc);
      if (!["light", "dark"].includes(view.theme)) fail5("theme must be light or dark", view.loc);
      if (validateMetaView(view)) continue;
      if (view.referenceDisplay !== void 0 && !["labels", "nodes", "both"].includes(view.referenceDisplay)) fail5("referenceDisplay must be labels, nodes or both", view.loc);
      if (view.referenceOccurrences !== void 0 && !["shared", "perEdge"].includes(view.referenceOccurrences)) fail5("referenceOccurrences must be shared or perEdge", view.loc);
      if (!Number.isFinite(view.spacing) || view.spacing < 24 || view.spacing > 400) fail5("spacing must be between 24 and 400", view.loc);
      for (const key of ["include", "exclude"]) if (view[key] !== void 0 && (!Array.isArray(view[key]) || view[key].some((id) => typeof id !== "string")))
        fail5(`${key} requires a list of element IDs`, view.loc);
      for (const id of [...view.include ?? [], ...view.exclude ?? [], ...Object.keys(view.places), ...Object.keys(view.styles)])
        if (!nodes.has(id)) fail5(`Unknown element in view ${view.id}: ${id}`, view.loc);
      for (const [id, place] of Object.entries(view.places))
        if (place.size && (place.size.x < 160 || place.size.y < 96)) fail5(`Size of ${id} must be at least (160, 96)`, place.loc);
      for (const [id, style] of Object.entries(view.styles)) {
        for (const [field, min, max] of [["fontSize", 6, 64], ["width", 160, 1e7], ["height", 96, 1e7]]) if (style[field] !== void 0 && (!Number.isFinite(style[field]) || style[field] < min || style[field] > max)) fail5(`${field} must be a number between ${min} and ${max}`, style.loc);
        for (const key of ["showIcon", "showLabel", "showStereotype", "showDescription", "showTechnology"]) if (style[key] !== void 0 && typeof style[key] !== "boolean") fail5(`${key} must be true or false`, style.loc);
        if (style.iconPosition !== void 0 && !["top", "left", "bottom", "right"].includes(style.iconPosition)) fail5("iconPosition must be top, left, bottom or right", style.loc);
        if (style.display !== void 0 && !["standard", "logo"].includes(style.display)) fail5("display must be standard or logo", style.loc);
        if (style.display === "logo" && profile.nodeTypes[nodes.get(id).type]?.container) fail5("logo display is only supported for non-container elements", style.loc);
        if (style.opacity !== void 0 && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) fail5("opacity must be a number between 0 and 1", style.loc);
        if (style.template !== void 0 && (!TEMPLATES.includes(style.template) || !!profile.nodeTypes[nodes.get(id).type]?.container !== (style.template === "package")))
          fail5(`Invalid template for ${id}: ${style.template}`, style.loc);
        if (style.accent !== void 0 && !normalizeColor(style.accent)) fail5("accent requires a hex color or CSS3 color name", style.loc);
        if (style.backgroundColor !== void 0 && !normalizeColor(style.backgroundColor)) fail5("backgroundColor requires a hex color or CSS3 color name", style.loc);
      }
      const edges = new Map(model.edges.map((e) => [e.id, e]));
      const referenceRoutes = view.referenceRoutes ?? [], referenceKeys = /* @__PURE__ */ new Set();
      for (const route of referenceRoutes) {
        if (!nodes.has(route.nodeId)) fail5(`Unknown reference element: ${route.nodeId}`, route.loc);
        const edge = edges.get(route.edgeId);
        if (!edge) fail5(`Unknown relationship: ${route.edgeId}`, route.loc);
        const key = JSON.stringify([route.nodeId, route.edgeId]);
        if (referenceKeys.has(key)) fail5(`Duplicate reference route: ${route.nodeId} -> ${route.edgeId}`, route.loc);
        referenceKeys.add(key);
        const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
        if (!relationshipReferences(edge, rule).some((item) => item.id === route.nodeId) || profile.nodeTypes[nodes.get(route.nodeId).type]?.container)
          fail5(`Element ${route.nodeId} is not a graphical reference of relationship ${route.edgeId}`, route.loc);
        if (route.to !== void 0 && (!Number.isFinite(route.to) || route.to < 0 || route.to > 1))
          fail5("Reference route to must be a number between 0 and 1", route.loc);
      }
      for (const [id, route] of Object.entries(view.routes)) if (!edges.has(id)) fail5(`Unknown relationship: ${id}`, route.loc);
      const checkRouting = (route, reference2 = false, defaults = false, combined = true) => {
        if (!route) return;
        for (const key of ["from", ...!reference2 ? ["to"] : []]) if (typeof route[key] === "string" && !["auto", "top", "right", "bottom", "left"].includes(route[key]))
          fail5(`Unknown port: ${route[key]}`, route.loc);
        if ((reference2 || defaults) && typeof route.to === "number" && (!Number.isFinite(route.to) || route.to < 0 || route.to > 1))
          fail5("Reference route to must be a number between 0 and 1", route.loc);
        for (const key of ["showIcon", "showLabel"]) if (route[key] !== void 0 && typeof route[key] !== "boolean") fail5(`${key} must be true or false`, route.loc);
        if (route.label !== void 0 && route.label !== "none" && (!route.label || typeof route.label !== "object" || !["x", "y"].every((key) => Number.isFinite(route.label[key]) && Math.abs(route.label[key]) <= 1e7))) fail5("label must be none or a point (X, Y)", route.loc);
        if (route.icon !== void 0 && (typeof route.icon !== "string" || route.icon !== "none" && !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(route.icon))) fail5("icon must be PACK.NAME or none", route.loc);
        if (route.iconPosition !== void 0 && !["top", "left", "bottom", "right"].includes(route.iconPosition)) fail5("iconPosition must be top, left, bottom or right", route.loc);
        if (route.curve !== void 0 && !["orthogonal", "straight", "rounded", "bezier"].includes(route.curve)) fail5(`Unknown curve: ${route.curve}`, route.loc);
        if (combined && route.curve === "bezier" && route.via && route.via.length !== 2) fail5("bezier requires exactly two control points", route.loc);
      };
      checkRouting(view.routeDefaults, false, true, false);
      for (const route of Object.values(view.routes)) checkRouting(route, false, false, false);
      for (const route of referenceRoutes) checkRouting(route, true, false, false);
      const referenceRouteMap = new Map(referenceRoutes.map((route) => [JSON.stringify([route.nodeId, route.edgeId]), route]));
      for (const edge of model.edges) {
        checkRouting(routingOptions(view, view.routes[edge.id]));
        const rule = profile.relationTypes[edge.type ?? profile.defaultRelation] ?? {};
        for (const item of relationshipReferences(edge, rule))
          checkRouting(routingOptions(view, referenceRouteMap.get(JSON.stringify([item.id, edge.id])), true), true);
      }
    }
    viewIds(model.config?.views, model.views, model.config?.loc);
    const diagnostics = profileDiagnostics(model, profile);
    if (diagnostics.length) {
      const first = diagnostics[0], error = new ArchError(first.message, first, first.code);
      error.diagnostics = diagnostics;
      throw error;
    }
    for (const view of model.views) validateDiagramView(model, profile, view);
    return model;
  }
  function validate(sourceOrModel, options = {}) {
    let model, profile;
    try {
      model = typeof sourceOrModel === "string" || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
      if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views))
        throw new ArchError("Invalid model; use parse(source)", {}, "ARCH_VALIDATION");
      profile = resolveProfile(model, options);
      validateModel(model, { profile });
      return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      return {
        valid: false,
        profile: profile ? { id: profile.id, version: profile.version } : null,
        diagnostics: error.diagnostics ?? [{ severity: "error", code: error.code, message: error.message, line: error.line, column: error.column, ...error.path !== void 0 ? { path: error.path } : {} }]
      };
    }
  }

  // src/reference-nodes.js
  var import_svgpath = __toESM(require_svgpath2(), 1);
  var distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  var overlap = (a, b, gap = 18) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  var point = (x, y) => ({ x, y });
  function pathSamples(d) {
    const path = (0, import_svgpath.default)(d).abs().unarc().unshort(), result = [];
    let current = point(0, 0), start = current;
    for (const s of path.segments) {
      const before = current, command = s[0];
      if (command === "M") {
        current = point(s[1], s[2]);
        start = current;
        result.push({ ...current, move: true });
        continue;
      }
      if (command === "Z") current = start;
      else if (command === "L") current = point(s[1], s[2]);
      else if (command === "H") current = point(s[1], before.y);
      else if (command === "V") current = point(before.x, s[1]);
      else if (command === "C" || command === "Q") {
        const p1 = point(s[1], s[2]), p2 = point(s[3], s[4]), end = command === "C" ? point(s[5], s[6]) : p2;
        const length = distance(before, p1) + distance(p1, p2) + (command === "C" ? distance(p2, end) : 0);
        const steps = Math.min(256, 2 * Math.ceil(Math.max(24, Math.ceil(length / 20)) / 2));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps, u = 1 - t;
          result.push(command === "C" ? point(u ** 3 * before.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * end.x, u ** 3 * before.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * end.y) : point(u * u * before.x + 2 * u * t * p1.x + t * t * end.x, u * u * before.y + 2 * u * t * p1.y + t * t * end.y));
        }
        current = end;
        continue;
      } else continue;
      result.push({ ...current });
    }
    return result;
  }
  function pointOnPath(samples, fraction) {
    const segments = samples.slice(1).map((p, i) => ({ a: samples[i], b: p, length: p.move ? 0 : distance(samples[i], p) }));
    let remaining = segments.reduce((sum, s) => sum + s.length, 0) * fraction;
    for (const segment of segments) if (segment.length) {
      if (remaining <= segment.length) {
        const t = remaining / segment.length;
        return { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t, dx: segment.b.x - segment.a.x, dy: segment.b.y - segment.a.y };
      }
      remaining -= segment.length;
    }
    return { ...samples.at(-1) ?? point(0, 0), dx: 1, dy: 0 };
  }
  function horizontalPath(samples) {
    const a = samples[0] ?? point(0, 0), b = samples.at(-1) ?? a;
    const tangent = distance(a, b) > 0.01 ? { dx: b.x - a.x, dy: b.y - a.y } : pointOnPath(samples, 0.5);
    return Math.abs(tangent.dx) >= Math.abs(tangent.dy);
  }
  function segmentHits(a, b, box) {
    const left = box.x + 0.5, right = box.x + box.width - 0.5, top = box.y + 0.5, bottom = box.y + box.height - 0.5;
    const dx = b.x - a.x, dy = b.y - a.y;
    let lo = 0, hi = 1;
    for (const [p, q] of [[-dx, a.x - left], [dx, right - a.x], [-dy, a.y - top], [dy, bottom - a.y]]) {
      if (!p) {
        if (q < 0) return false;
        continue;
      }
      const t = q / p;
      if (p < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
    return hi >= lo;
  }
  function connector(card, anchor, obstacles) {
    obstacles = [...obstacles, card];
    const ports = [point(card.x + card.width / 2, card.y + card.height), point(card.x + card.width / 2, card.y), point(card.x, card.y + card.height / 2), point(card.x + card.width, card.y + card.height / 2)];
    const xs = [anchor.x, ...obstacles.flatMap((b) => [b.x - 16, b.x + b.width + 16])].sort((a, b) => Math.abs(a - anchor.x) - Math.abs(b - anchor.x)).slice(0, 24);
    const ys = [anchor.y, ...obstacles.flatMap((b) => [b.y - 16, b.y + b.height + 16])].sort((a, b) => Math.abs(a - anchor.y) - Math.abs(b - anchor.y)).slice(0, 24);
    const candidates = [];
    for (const p of ports) {
      candidates.push([p, anchor], [p, point(p.x, anchor.y), anchor], [p, point(anchor.x, p.y), anchor]);
      for (const x of xs) candidates.push([p, point(x, p.y), point(x, anchor.y), anchor]);
      for (const y of ys) candidates.push([p, point(p.x, y), point(anchor.x, y), anchor]);
    }
    const length = (path) => path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
    candidates.sort((a, b) => length(a) - length(b));
    return candidates.find((path) => !path.slice(1).some((p, i) => obstacles.some((box) => segmentHits(path[i], p, box)))) ?? candidates[0];
  }
  function attachReferenceNodes(nodes, edges, view, wrapText, routeConnector) {
    const byId = new Map(nodes.map((n) => [n.id, n])), occurrences = [], boxes = nodes.filter((n) => !n.container && !n.referenceOnly);
    const containers = nodes.filter((n) => n.container), headers = containers.map((n) => ({ ...n, height: n.headerHeight }));
    for (const edge of edges) {
      if (edge.referenceItems?.length && !edge.labelExplicit && (edge.labelLines.length || edge.labelIcon)) {
        if (horizontalPath(pathSamples(edge.d))) edge.label.y += edge.labelHeight / 2 + 14;
        else edge.label.x += edge.labelWidth / 2 + 14;
      }
    }
    const labels = edges.filter((e) => e.labelLines.length || e.labelIcon).map((e) => ({ x: e.label.x - e.labelWidth / 2, y: e.label.y - e.labelHeight / 2, width: e.labelWidth, height: e.labelHeight }));
    const groups = /* @__PURE__ */ new Map(), edgesById = new Map(edges.map((edge) => [edge.id, edge]));
    const routes = new Map((view.referenceRoutes ?? []).map((route) => [JSON.stringify([route.nodeId, route.edgeId]), route]));
    for (const edge of edges) {
      if (!edge.referenceItems?.length) continue;
      const samples = pathSamples(edge.d);
      const rowWidth = edge.referenceItems.reduce((sum, item) => sum + byId.get(item.id).width, 0) + 28 * (edge.referenceItems.length - 1);
      let rowLeft = pointOnPath(samples, 0.5).x - rowWidth / 2;
      for (const [index, item] of edge.referenceItems.entries()) {
        const route = routingOptions(view, routes.get(JSON.stringify([item.id, edge.id])), true);
        const original = byId.get(item.id), anchor = pointOnPath(samples, route?.to ?? (index + 1) / (edge.referenceItems.length + 1));
        const explicit = !original.referenceOnly;
        const key = JSON.stringify([item.id, explicit || edge.referenceOccurrences !== "perEdge" ? null : edge.id]);
        if (!groups.has(key)) groups.set(key, []);
        const occurrence = {
          edgeId: edge.id,
          attribute: item.attribute,
          nodeId: item.id,
          anchor,
          explicit,
          route,
          horizontal: horizontalPath(samples),
          preferredX: rowLeft
        };
        groups.get(key).push(occurrence);
        occurrences.push(occurrence);
        rowLeft += original.width + 28;
      }
    }
    const cardCounts = /* @__PURE__ */ new Map();
    for (const group of groups.values()) cardCounts.set(group[0].nodeId, (cardCounts.get(group[0].nodeId) ?? 0) + 1);
    const cards = [];
    for (const group of groups.values()) {
      const first = group[0], original = byId.get(first.nodeId);
      let card;
      if (first.explicit) card = original;
      else {
        const identityLines = cardCounts.get(first.nodeId) > 1 ? wrapText(`ID: ${original.id}`, original.width - 20, 11) : [];
        const height = original.height + (identityLines.length ? identityLines.length * 16 + 8 : 0);
        const anchor = point(group.reduce((sum, o) => sum + o.anchor.x, 0) / group.length, group.reduce((sum, o) => sum + o.anchor.y, 0) / group.length);
        const horizontal = first.horizontal, preferredX = group.reduce((sum, o) => sum + o.preferredX, 0) / group.length;
        const endpoints = group.flatMap((o) => {
          const edge = edgesById.get(o.edgeId);
          return [byId.get(edge.source), byId.get(edge.target)];
        });
        const gap = horizontal ? Math.max(80, anchor.y - Math.min(...endpoints.map((n) => n.y)) + 32) : 80;
        const obstacles = [...boxes, ...original.parent ? headers : containers, ...labels, ...cards];
        for (let level = 0; !card; level++) for (const side of [-1, 1]) {
          const candidate = {
            ...original,
            parent: null,
            height,
            referenceContentHeight: original.height,
            referenceIdentityLines: identityLines,
            x: horizontal ? preferredX : anchor.x + (side < 0 ? -gap - original.width : gap) + side * level * (original.width + 28),
            y: horizontal ? anchor.y + (side < 0 ? -gap - height : gap) + side * level * (height + 28) : anchor.y - height / 2
          };
          if (!obstacles.some((b) => overlap(candidate, b))) {
            card = candidate;
            break;
          }
        }
      }
      cards.push(card);
      const edgeIds = [...new Set(group.map((o) => o.edgeId))];
      for (const occurrence of group) Object.assign(occurrence, { node: card, edgeIds });
    }
    for (const occurrence of occurrences) {
      const obstacles = [...boxes, ...headers, ...cards].filter((box) => box !== occurrence.node);
      if (occurrence.route) {
        const routed = routeConnector(occurrence.node, occurrence.anchor, occurrence.route);
        occurrence.points = routed.points;
        occurrence.d = routed.d;
      } else occurrence.points = connector(occurrence.node, occurrence.anchor, obstacles);
    }
    for (const node of nodes.filter((n) => n.referenceOnly)) {
      const first = occurrences.find((o) => o.nodeId === node.id);
      if (first) {
        node.x = first.node.x;
        node.y = first.node.y;
      }
    }
    return occurrences;
  }

  // src/source.js
  var copy2 = (value2) => JSON.parse(JSON.stringify(value2));
  var own3 = (value2, key) => Object.hasOwn(value2, key);
  var sourceFormat = (source) => isJSONDocument(source) || typeof source === "string" && /^\s*[\[{]/.test(source) ? "json" : "dsl";
  var clean = (value2) => JSON.parse(JSON.stringify(value2, (key, value3) => ["loc", "attributeLocs"].includes(key) ? void 0 : value3));
  var collection = (entries) => new Set(entries.map(([id]) => id)).size === entries.length ? Object.fromEntries(entries) : entries.map(([id, value2]) => ({ id, ...value2 }));
  function jsonSource(model) {
    if (model.kind === "help" && !model.config && model.title === "arch.js Help") {
      return { "@help": [model.help.topic, ...model.help.parameters.map((p) => JSON.stringify(p))].join(" ").trim() };
    }
    const a = { name: model.title };
    if (model.description) a.description = model.description;
    if (model.config) {
      const config = {}, original = model.config;
      if (own3(original, "profile")) config.profile = original.profile;
      if (own3(original, "views")) config.views = copy2(original.views);
      if (original.definition) {
        for (const [key, value2] of Object.entries(original.definition)) {
          const mapped = { nodeTypes: "type", relationTypes: "relation", viewpoints: "viewpoint", styleGroups: "styleGroup" }[key];
          if (mapped) {
            if (Object.keys(value2).length) config[mapped] = Object.fromEntries(Object.entries(value2).map(([name, rule]) => {
              const result = copy2(rule);
              if (result.attributes) {
                result.attribute = result.attributes;
                delete result.attributes;
              }
              return [name, result];
            }));
          } else config[key] = copy2(value2);
        }
      }
      a.config = config;
    }
    if (model.kind === "help") {
      a["@help"] = [model.help.topic, ...model.help.parameters.map((p) => JSON.stringify(p))].join(" ").trim();
      return { architecture: a };
    }
    const props = (item, builtins, reserved) => {
      const result = /* @__PURE__ */ Object.create(null);
      for (const key of builtins) if (own3(item, key)) result[key] = copy2(item[key]);
      for (const [key, value2] of Object.entries(item.attributes ?? {})) {
        if (reserved.includes(key)) {
          result.attributes ?? (result.attributes = /* @__PURE__ */ Object.create(null));
          result.attributes[key] = copy2(value2);
        } else result[key] = copy2(value2);
      }
      return result;
    };
    const ancestors = /* @__PURE__ */ new Set();
    const nodes = (parent) => model.nodes.filter((n) => (n.parent ?? null) === parent).map((n) => {
      if (ancestors.has(n.id)) throw new ArchError(`Cannot translate cyclic or ambiguous package ID: ${n.id}`, n.loc, "ARCH_VALIDATION");
      ancestors.add(n.id);
      const result = { type: n.type, name: n.title, ...props(n, NODE_PROPERTIES, ["id", "type", "name", "elements", "relations", "attributes"]) };
      const children = nodes(n.id);
      if (children.length) result.elements = collection(children);
      ancestors.delete(n.id);
      return [n.id, result];
    });
    a.model = { elements: collection(nodes(null)) };
    if (model.edges.length) a.model.relations = collection(model.edges.map((e) => [e.id, {
      from: e.source,
      to: e.target,
      name: e.title,
      ...e.type !== void 0 ? { type: e.type } : {},
      ...props(e, EDGE_PROPERTIES, ["id", "from", "to", "name", "type", "attributes"])
    }]));
    a.views = collection(model.views.map((v) => {
      const result = { name: v.title };
      if (v.meta !== void 0) result["@meta"] = v.meta;
      for (const key of ["direction", "theme", "spacing", "viewpoint", "include", "exclude", "referenceDisplay", "referenceOccurrences", "diagram"]) if (v[key] !== void 0) result[key] = clean(v[key]);
      if (Object.keys(v.places).length) result.place = Object.fromEntries(Object.entries(v.places).map(([id, p]) => [id, { at: [p.at.x, p.at.y], ...p.size ? { size: [p.size.x, p.size.y] } : {} }]));
      if (Object.keys(v.styles).length) result.style = clean(v.styles);
      const route = (item) => Object.fromEntries(Object.entries(item).filter(([key]) => !["loc", "nodeId", "edgeId"].includes(key)).map(([key, value2]) => [
        key,
        key === "via" ? value2.map((p) => [p.x, p.y]) : value2 && typeof value2 === "object" && own3(value2, "x") ? [value2.x, value2.y] : value2
      ]));
      if (v.routeDefaults) result.routes = route(v.routeDefaults);
      if (Object.keys(v.routes).length || v.referenceRoutes?.length) result.route = Object.fromEntries([
        ...Object.entries(v.routes).map(([id, r]) => [id, route(r)]),
        ...(v.referenceRoutes ?? []).map((r) => [`${r.nodeId} -> ${r.edgeId}`, route(r)])
      ]);
      return [v.id, result];
    }));
    return { architecture: a };
  }
  function prettyDSL(source) {
    const lines = source.split("\n"), result = [];
    let depth = 0;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (lines[i + 1]?.trim() === "{") {
        line += " {";
        i++;
      }
      if (line.endsWith("{") && lines[i + 1]?.trim() === "}") {
        line += "}";
        i++;
      }
      if (line === "}") depth--;
      result.push("  ".repeat(Math.max(0, depth)) + line);
      if (line.endsWith("{")) depth++;
    }
    return result.join("\n") + "\n";
  }
  function translate(source, options = {}) {
    const format = options.format ?? (sourceFormat(source) === "json" ? "dsl" : "json");
    if (!["dsl", "json"].includes(format)) throw new ArchError("Translation format must be dsl or json");
    const model = parseDocument(source);
    const output = format === "dsl" && sourceFormat(source) === "json" ? prettyDSL(jsonToDSL(source).source) : modelSource(model, format);
    if (output.length > 2e6) throw new ArchError("Translated source exceeds 2 MB; split the architecture into smaller documents");
    return output;
  }
  function modelSource(model, format) {
    if (!["dsl", "json"].includes(format)) throw new ArchError("Translation format must be dsl or json");
    const output = format === "json" ? JSON.stringify(jsonSource(model), null, 2) + "\n" : prettyDSL(jsonToDSL(jsonSource(model)).source);
    if (output.length > 2e6) throw new ArchError("Translated source exceeds 2 MB; split the architecture into smaller documents");
    return output;
  }
  var styleKeys = ["template", "accent", "icon", "iconPosition", "backgroundColor", "opacity", "display", "fontSize", "width", "height", "showIcon", "showLabel", "showStereotype", "showDescription", "showTechnology"];
  var routingKeys = ["from", "to", "via", "curve", "path", "label", "icon", "iconPosition", "showIcon", "showLabel"];
  var viewKeys = ["name", "@meta", "meta", "diagram", "direction", "theme", "spacing", "viewpoint", "include", "exclude", "place", "style", "routes", "route", "referenceDisplay", "referenceOccurrences"];
  var configKeys = ["profile", "views", "id", "title", "version", "extends", "defaultRelation", "requireViewpoint", "type", "relation", "viewpoint", "styleGroup"];
  var profileKeys = ["extends", "template", "container", "abstract", "contains", "attribute", "attributes", "icon", "accent", "backgroundColor", "styleGroup", "from", "to", "style", "allowSelf", "acyclic", "incoming", "outgoing", "nodes", "relations", "requiredNodes", "requiredRelations"];
  function distance2(a, b) {
    a = String(a).slice(0, 100).toLowerCase();
    b = String(b).slice(0, 100).toLowerCase();
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
      row = next;
    }
    return row[b.length];
  }
  function jsonKeys(path = "") {
    if (path === "/architecture") return ["name", "description", "config", "model", "views", "@help", "@meta"];
    if (path === "/architecture/model") return ["elements", "relations"];
    if (path === "/architecture/config") return configKeys;
    if (/\/style\/[^/]+$/.test(path)) return styleKeys;
    if (/\/(?:route\/[^/]+|routes)$/.test(path)) return routingKeys;
    if (/\/place\/[^/]+$/.test(path)) return ["at", "size"];
    if (/\/views\/[^/]+$/.test(path)) return viewKeys;
    return path === "" ? ["architecture", "@help"] : void 0;
  }
  function corrections(diagnostic, model, source, format, options) {
    const candidates = [], message = diagnostic.message.split(" (JSON path ")[0];
    const tokenAtError = typeof source === "string" && diagnostic.line ? source.split("\n")[diagnostic.line - 1]?.slice(Math.max(0, (diagnostic.column ?? 1) - 1)).match(/^[A-Za-z_][A-Za-z0-9_.-]*/)?.[0] : "";
    const add = (label, example, detail = "") => {
      if (!candidates.some((c) => c.label === label)) candidates.push({ label, example, detail });
    };
    const nearest = (bad, values, label = "Use") => [...new Set(values)].sort((a, b) => distance2(bad, a) - distance2(bad, b) || a.localeCompare(b)).slice(0, 6).forEach((value2) => add(`${label} ${value2}`, value2));
    let profile;
    try {
      profile = resolveProfile(model ?? {}, options);
    } catch {
    }
    const found = message.match(/Unknown (?:element|relationship|node) type (?:in profile [^:]+: )?([^\s(]+)/);
    if (found && profile) nearest(found[1], Object.keys(message.includes("relationship") ? profile.relationTypes : profile.nodeTypes), "Type");
    if (Array.isArray(diagnostic.candidates)) for (const type of diagnostic.candidates.slice(0, 8)) add(`Use concrete type ${type}`, format === "json" ? `"type": "${type}"` : `${type} ${diagnostic.elementId ?? "element"} "Title"`);
    const unknownProfile = message.match(/Unknown profile: ([^\s(]+)/);
    if (unknownProfile) nearest(unknownProfile[1], getProfiles(), "Registered profile");
    const unknownKey = message.match(/Unknown (?:JSON field|view option|routing attribute|attribute rule|profile rule|config option|attribute): ([^\s(]+)/);
    if (unknownKey) {
      const key = unknownKey[1], parent = diagnostic.path?.replace(/\/[^/]*$/, "");
      const contextual = message.includes("routing") ? routingKeys : message.includes("view option") ? viewKeys.filter((k) => k !== "name") : message.includes("config") ? configKeys : message.includes("attribute rule") ? ["type", "required", "enum", "min", "max", "minLength", "maxLength", "format", "targets", "many", "minItems", "maxItems", "uniqueItems"] : message.includes("profile rule") ? profileKeys : styleKeys;
      const values = format === "json" && diagnostic.path ? jsonKeys(parent) ?? contextual : contextual;
      nearest(key, values, "Field");
    }
    const endpoint = message.match(/Unknown (?:endpoint|reference element|element in view [^:]+): ([^\s(]+)/);
    if (endpoint && model) nearest(endpoint[1], model.nodes.map((n) => n.id), "Element ID");
    const missing = message.match(/Missing required attribute (\w+)/);
    if (missing) {
      const item = model?.nodes.find((n) => n.id === diagnostic.elementId) ?? model?.edges.find((e) => e.id === diagnostic.elementId);
      const rule = (profile?.nodeTypes[item?.type] ?? profile?.relationTypes[item?.type])?.attributes?.[missing[1]];
      const value2 = rule?.enum?.[0] ?? (rule?.type === "boolean" ? true : ["number", "integer"].includes(rule?.type) ? rule.min ?? 0 : rule?.type === "reference" ? model?.nodes.find((n) => !rule.targets || rule.targets.includes(n.type))?.id ?? "elementId" : "value");
      const serialized = JSON.stringify(rule?.many ? [value2] : value2);
      add(`Provide ${missing[1]}`, format === "json" ? `"${missing[1]}": ${serialized}` : `${missing[1]} ${serialized}`, "Check the attribute type and profile constraints.");
    }
    for (const [term, values] of [["direction", ["right", "down"]], ["theme", ["light", "dark"]], ["iconPosition", ["top", "left", "bottom", "right"]], ["referenceDisplay", ["labels", "nodes", "both"]], ["referenceOccurrences", ["shared", "perEdge"]], ["curve", ["straight", "orthogonal", "rounded", "bezier"]]])
      if (message.includes(term) && (message.includes("must") || message.includes("Unknown"))) for (const value2 of values) add(`${term}: ${value2}`, format === "json" ? `"${term}": "${value2}"` : `${term} ${value2}`);
    if (/spacing must/.test(message)) add("Use spacing between 24 and 400", format === "json" ? '"spacing": 80' : "spacing 80");
    if (/Unknown diagram type/.test(message)) nearest(message.split(" ").at(-1), DIAGRAMS, "Diagram");
    const diagramOption = message.match(/Option (\w+) does not apply to (\w+)/);
    if (diagramOption) nearest(diagramOption[1], DIAGRAM_OPTIONS[diagramOption[2]] ?? [], "Diagram field");
    if (/Duplicate (?:JSON key|ID|view ID)/.test(message)) add("Use a unique name or ID", format === "json" ? '"newId": { "name": "Title" }' : 'service newId "Title"', "Rename the duplicate and update references, or combine its properties.");
    if (/Unknown attribute for/.test(message) && profile) {
      const match = message.match(/Unknown attribute for ([^:]+): ([^\s(]+)/), rule = profile.nodeTypes[match?.[1]] ?? profile.relationTypes[match?.[1]];
      if (match) nearest(match[2], [...Object.keys(rule?.attributes ?? {}), ...NODE_PROPERTIES, ...EDGE_PROPERTIES], "Attribute");
    }
    if (format === "json" && /Invalid JSON/.test(message)) {
      add("Use double-quoted property names and strings", '{ "architecture": { "name": "Test", "model": {} } }');
      if (/comma|property name|after property|after array|after JSON|Unexpected/.test(message)) add("Check commas and closing brackets", '"name": "Test",\n"model": {}', "Separate object properties with commas; remove a comma before } or ].");
      if (/end|unterminated|Expected.*[}\]]/i.test(message)) add("Close the string, object or array", '{ "architecture": { "name": "Test", "model": {} } }', "Match each opening quote/bracket with its closing character.");
    }
    if (/Missing model block/.test(message)) add("Add a model block", format === "json" ? '"model": {}' : "model { }");
    if (/Unclosed block/.test(message)) add("Close the block", "}", "Add the missing closing brace after its contents.");
    if (/Unclosed string|Invalid string/.test(message)) add("Use a closed, escaped string", '"Title with \\"quotes\\""', 'Close the double quote; escape inner quotes with \\".');
    if (/Expected: architecture/.test(message)) add("Start an architecture document", 'architecture "Test" {\n  model {}\n}');
    if (/Expected: (?:element title|architecture title|relationship label|view title)/.test(message)) add("Quote the title", '"Title"');
    if (/Expected: model, view, config/.test(message)) nearest(tokenAtError ?? "", ["model", "view", "config", "description"]);
    if (/Expected: at/.test(message)) add("Specify the placement position", "place elementId at (0, 0)");
    if (/Expected: ->/.test(message)) add("Connect the endpoints with ->", 'relation flow sourceId -> targetId "Label"');
    if (/Expected an object/.test(message)) add("Use an object for this block", format === "json" ? "{}" : "model {}");
    if (/Expected a coordinate pair/.test(message)) add("Use two numeric coordinates", "[0, 0]");
    if (/Expected a string/.test(message)) add("Provide a double-quoted string", '"Title"');
    if (/Expected an identifier|Expected: identifier/.test(message)) add("Use a declared identifier", "elementId", "Start with a letter or underscore; use letters, digits, _, . and -.");
    const punctuation = message.match(/^Expected: ([(){}\[\],])/);
    if (punctuation) add(`Insert ${punctuation[1]}`, punctuation[1], "Check the surrounding block, list or coordinate pair.");
    if (/Expected: number/.test(message)) add("Use a numeric value", "0", "Coordinates use (x, y) in DSL and [x, y] in JSON.");
    if (/Unicode character that is invalid in SVG/.test(message)) add("Remove the invalid control or surrogate character", '"Readable title"', "Use valid Unicode text without isolated surrogate code units or forbidden control characters.");
    if (/Unknown help topic/.test(message)) nearest("", Object.keys(topics), "Help topic");
    if (/@meta|meta must be/.test(message)) for (const format2 of ["json", "dsl"]) add(`Show architecture as ${format2.toUpperCase()}`, `@meta ${format2}`, "Place the directive inside an architecture or view.");
    if (/requires the connected renderer|only supported for connected/.test(message)) add("Use a connected view", format === "json" ? '"diagram": "connected"' : "diagram connected", "Alternatively remove Connected-only presentation options from this view.");
    if (!candidates.length) add("Compare with a valid example", format === "json" ? '{ "architecture": { "name": "Test", "model": {} } }' : 'architecture "Test" {\n  model {}\n}', "Inspect @help syntax, @help json, or the selected profile. Suggested examples require review.");
    return candidates.slice(0, 8);
  }
  function inspectSource(source, options = {}) {
    const format = sourceFormat(source), target = options.format ?? (format === "json" ? "dsl" : "json");
    const result = { sourceFormat: format, targetFormat: target, output: null, valid: false, diagnostics: [] };
    let model;
    try {
      model = parseDocument(source);
      result.title = model.title;
      result.views = model.views.map((v) => ({ id: v.id, title: v.title }));
      result.kind = model.kind ?? "architecture";
      if (model.config?.views !== void 0) result.configuredViews = copy2(model.config.views);
      result.output = translate(source, { ...options, format: target });
      const report = validate(model, options);
      result.valid = report.valid;
      result.diagnostics = report.diagnostics;
      result.profile = report.profile;
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      result.diagnostics = error.diagnostics ?? [{ severity: "error", code: error.code, message: error.message, line: error.line, column: error.column, ...error.path !== void 0 ? { path: error.path } : {} }];
    }
    result.diagnostics = result.diagnostics.map((d) => ({ ...d, candidates: corrections(d, model, source, format, options) }));
    return result;
  }

  // src/meta.js
  var escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var cells = (char) => char.codePointAt(0) > 255 ? 2 : 1;
  function layoutMeta(model, profile, view) {
    const source = modelSource(model, view.meta), rows = [];
    let y = 82;
    for (const [index, line] of source.trimEnd().split("\n").entries()) {
      let part = "", width = 0, continuation = false;
      for (const char of line.replace(/\t/g, "  ")) {
        if (width + cells(char) > 112) {
          rows.push({ line: index + 1, text: part, y, continuation });
          y += 19;
          part = "";
          width = 0;
          continuation = true;
        }
        part += char;
        width += cells(char);
      }
      rows.push({ line: index + 1, text: part, y, continuation });
      y += 19;
    }
    return {
      kind: "meta",
      title: model.title,
      description: model.description,
      profile: { id: profile.id, version: profile.version },
      view,
      nodes: [],
      edges: [],
      format: view.meta,
      source,
      rows,
      bounds: { x: 0, y: 0, width: 1040, height: y + 26 }
    };
  }
  function metaSVG(graph, { theme, idPrefix }) {
    const dark = theme === "dark", bg = dark ? "#111827" : "#fafbfe", card = dark ? "#172033" : "#fff", text = dark ? "#e2e8f0" : "#334155", muted = dark ? "#94a3b8" : "#64748b", border = dark ? "#334155" : "#e2e8f0";
    const { width, height } = graph.bounds;
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-arch-meta="${graph.format}" data-diagram="meta" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;background:${bg}"><title id="${idPrefix}-title">${escape(graph.title)} — ${escape(graph.view.title)}</title><desc id="${idPrefix}-desc">Architecture source as ${graph.format.toUpperCase()}</desc><rect width="${width}" height="${height}" fill="${bg}"/><rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="10" fill="${card}" stroke="${border}"/><text x="34" y="44" fill="${text}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="650">${graph.format.toUpperCase()} · ${escape(graph.view.title)}</text><path d="M16 57 H${width - 16}" stroke="${border}"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="12">${graph.rows.map((row) => `<g class="arch-meta-row" data-source-line="${row.line}">${row.continuation ? "" : `<text x="66" y="${row.y}" fill="${muted}" text-anchor="end">${row.line}</text>`}<text class="arch-meta-code" x="86" y="${row.y}" fill="${text}" xml:space="preserve">${escape(row.text)}</text></g>`).join("")}</g></svg>`;
  }

  // src/geometry.js
  var num = (n) => String(Math.round(n * 1e3) / 1e3);
  var pt = (p) => `${num(p.x)} ${num(p.y)}`;
  var fail6 = (message, loc) => {
    throw new ArchError(message, loc, "ARCH_VALIDATION");
  };
  function inspectPath(path, loc) {
    if (typeof path !== "string" || !path.trim() || path.length > 1e5) fail6("Invalid SVG path", loc);
    const pattern = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
    const tokens2 = path.match(pattern) ?? [];
    if (path.replace(pattern, "").replace(/[\s,]/g, "") || !/^[Mm]$/.test(tokens2[0] ?? "")) fail6("SVG path must start with M and contain valid path data", loc);
    const arities = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
    const points = [];
    let index = 0, command, current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = "";
    while (index < tokens2.length) {
      if (/^[A-Za-z]$/.test(tokens2[index])) command = tokens2[index++];
      else if (!command) fail6("Missing SVG path command", loc);
      const upper = command.toUpperCase(), relative = command !== upper;
      if (upper === "Z") {
        current = start;
        points.push(current);
        previousControl = null;
        previousCommand = upper;
        command = null;
        continue;
      }
      const count = arities[upper], args = tokens2.slice(index, index + count).map(Number);
      if (args.length !== count || args.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7)) fail6("Invalid number or size of SVG path parameters", loc);
      index += count;
      const origin = current;
      const pair = (offset) => ({ x: args[offset] + (relative ? origin.x : 0), y: args[offset + 1] + (relative ? origin.y : 0) });
      if (upper === "H") current = { x: args[0] + (relative ? origin.x : 0), y: origin.y };
      else if (upper === "V") current = { x: origin.x, y: args[0] + (relative ? origin.y : 0) };
      else if (upper === "A") {
        if (args[0] < 0 || args[1] < 0 || ![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) fail6("Invalid SVG arc parameters", loc);
        current = pair(5);
        const angle = args[2] * Math.PI / 180;
        const dx = (origin.x - current.x) / 2, dy = (origin.y - current.y) / 2;
        const xp = Math.cos(angle) * dx + Math.sin(angle) * dy;
        const yp = -Math.sin(angle) * dx + Math.cos(angle) * dy;
        const correction = args[0] && args[1] ? Math.max(1, Math.hypot(xp / args[0], yp / args[1])) : 0;
        const radius = correction * Math.max(args[0], args[1]) * 2;
        if (!Number.isFinite(radius) || radius > 1e10) fail6("SVG arc exceeds the supported coordinate range", loc);
        for (const p of [origin, current]) points.push({ x: p.x - radius, y: p.y - radius }, { x: p.x + radius, y: p.y + radius });
      } else {
        for (let j = 0; j < count; j += 2) points.push(pair(j));
        current = pair(count - 2);
        if (upper === "S" && ["C", "S"].includes(previousCommand) || upper === "T" && ["Q", "T"].includes(previousCommand)) {
          if (previousControl) points.push({ x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y });
        }
      }
      if (upper === "M") {
        start = current;
        command = relative ? "l" : "L";
      }
      if (["C", "S", "Q"].includes(upper)) previousControl = pair(count - 4);
      else if (upper === "T" && ["Q", "T"].includes(previousCommand) && previousControl)
        previousControl = { x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y };
      else previousControl = null;
      previousCommand = upper;
      points.push(current);
    }
    return points;
  }
  function textLength(text) {
    return [...String(text)].reduce((sum, c) => sum + (/[MWmw@#%&]/.test(c) ? 1 : /[il.,' :!]/.test(c) ? 0.3 : c.codePointAt(0) > 12287 ? 1.15 : /[A-Z]/.test(c) ? 0.76 : c.codePointAt(0) > 767 ? 0.9 : 0.62), 0);
  }
  function wrap(text, width, fontSize = 13) {
    if (!text) return [];
    const result = [];
    for (const paragraph of String(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && textLength(`${line} ${word}`) * fontSize > width) {
          result.push(line);
          line = "";
        }
        for (const char of word) {
          if (textLength(line + char) * fontSize > width && line) {
            result.push(line);
            line = "";
          }
          line += char;
        }
        line += " ";
      }
      result.push(line.trimEnd());
    }
    return result.map((line) => line.trim());
  }
  function singleLine(text, width, fontSize) {
    const full = String(text ?? "").replace(/\s+/gu, " ").trim();
    if (textLength(full) * fontSize <= width) return full;
    const budget = Math.max(0, width / fontSize - textLength("…"));
    let result = "", used = 0;
    for (const char of full) {
      const units = textLength(char);
      if (used + units > budget) break;
      result += char;
      used += units;
    }
    return result.trimEnd() + "…";
  }
  var intersects = (a, b, margin = 24) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x && a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;
  function arrange(items, edges, direction, spacing, places, nodesById) {
    if (!items.length) return;
    const itemIds = new Set(items.map((n) => n.id)), incoming = new Map(items.map((n) => [n.id, /* @__PURE__ */ new Set()]));
    const outgoing = new Map(items.map((n) => [n.id, /* @__PURE__ */ new Set()]));
    const representative = (id) => {
      let node = nodesById.get(id);
      while (node && !itemIds.has(node.id)) node = nodesById.get(node.parent);
      return node?.id;
    };
    for (const edge of edges) {
      const a = representative(edge.source), b = representative(edge.target);
      if (a && b && a !== b) {
        incoming.get(b).add(a);
        outgoing.get(a).add(b);
      }
    }
    const remaining = new Set(itemIds), ranks = new Map(items.map((n) => [n.id, 0]));
    while (remaining.size) {
      const ready = [...remaining].filter((id) => [...incoming.get(id)].every((a) => !remaining.has(a)));
      for (const id of ready.length ? ready : [remaining.values().next().value]) {
        remaining.delete(id);
        for (const target of outgoing.get(id)) if (remaining.has(target)) ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
      }
    }
    const down = direction === "down", primarySize = down ? "height" : "width", secondarySize = down ? "width" : "height";
    const rankWidths = /* @__PURE__ */ new Map();
    for (const item of items) rankWidths.set(ranks.get(item.id), Math.max(rankWidths.get(ranks.get(item.id)) ?? 0, item[primarySize]));
    const offsets = /* @__PURE__ */ new Map();
    let offset = 0;
    for (const rank of [...rankWidths.keys()].sort((a, b) => a - b)) {
      offsets.set(rank, offset);
      offset += rankWidths.get(rank) + spacing;
    }
    const used = items.filter((n) => places[n.id]).map((n) => Object.assign(n, places[n.id].at));
    const stacks = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (places[item.id]) continue;
      const rank = ranks.get(item.id), primary = offsets.get(rank);
      let secondary = stacks.get(rank) ?? 0;
      const setPosition = () => {
        item.x = down ? secondary : primary;
        item.y = down ? primary : secondary;
      };
      setPosition();
      let collision;
      while (collision = used.find((other) => intersects(item, other))) {
        secondary = (down ? collision.x + collision.width : collision.y + collision.height) + spacing / 2;
        setPosition();
      }
      stacks.set(rank, secondary + item[secondarySize] + spacing / 2);
      used.push(item);
    }
  }
  function port(box, side, other) {
    if (typeof side === "object") return side;
    if (!side || side === "auto") {
      const dx = other.x + other.width / 2 - box.x - box.width / 2;
      const dy = other.y + other.height / 2 - box.y - box.height / 2;
      side = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "bottom" : "top";
    }
    return {
      left: { x: box.x, y: box.y + box.height / 2 },
      right: { x: box.x + box.width, y: box.y + box.height / 2 },
      top: { x: box.x + box.width / 2, y: box.y },
      bottom: { x: box.x + box.width / 2, y: box.y + box.height }
    }[side];
  }
  function polyPath(points, rounded) {
    let d = `M ${pt(points[0])}`;
    for (let i = 1; i < points.length; i++) {
      const before = points[i - 1], current = points[i], after = points[i + 1];
      if (!rounded || !after) {
        d += ` L ${pt(current)}`;
        continue;
      }
      const a = Math.hypot(current.x - before.x, current.y - before.y), b = Math.hypot(after.x - current.x, after.y - current.y);
      if (!a || !b) continue;
      const r = Math.min(10, a / 2, b / 2);
      const enter = { x: current.x + (before.x - current.x) * r / a, y: current.y + (before.y - current.y) * r / a };
      const leave = { x: current.x + (after.x - current.x) * r / b, y: current.y + (after.y - current.y) * r / b };
      d += ` L ${pt(enter)} Q ${pt(current)} ${pt(leave)}`;
    }
    return d;
  }
  function middle(points) {
    const lengths2 = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let left = lengths2.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < lengths2.length; i++) {
      if (left <= lengths2[i]) {
        const ratio = lengths2[i] ? left / lengths2[i] : 0;
        return { x: points[i].x + (points[i + 1].x - points[i].x) * ratio, y: points[i].y + (points[i + 1].y - points[i].y) * ratio };
      }
      left -= lengths2[i];
    }
    return points[0];
  }
  function routeEdge(edge, source, target, route, parallel) {
    const curve = route.curve ?? "orthogonal";
    let a = port(source, route.from, target), b = port(target, route.to, source), points = [a], d;
    if (route.path !== void 0) {
      const pathPoints = inspectPath(route.path, route.loc);
      return { ...edge, d: route.path, points: pathPoints, label: route.label ?? middle([a, b]) };
    }
    if (route.via) points.push(...route.via);
    else if (source.id === target.id) {
      a = port(source, route.from ?? "right", target);
      b = port(target, route.to ?? "top", source);
      const reach = 48 + parallel * 24;
      points = [a, { x: a.x + reach, y: a.y }, { x: a.x + reach, y: source.y - reach }, { x: b.x, y: source.y - reach }];
    } else if (curve !== "straight") {
      const shift = parallel * 22;
      if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
        const x = (a.x + b.x) / 2 + shift;
        if (parallel && a.y === b.y) {
          const stub = Math.sign(b.x - a.x || 1) * 24;
          points.push(
            { x: a.x + stub, y: a.y },
            { x: a.x + stub, y: a.y + shift },
            { x: b.x - stub, y: b.y + shift },
            { x: b.x - stub, y: b.y }
          );
        } else points.push({ x, y: a.y }, { x, y: b.y });
      } else {
        const y = (a.y + b.y) / 2 + shift;
        if (parallel && a.x === b.x) {
          const stub = Math.sign(b.y - a.y || 1) * 24;
          points.push(
            { x: a.x, y: a.y + stub },
            { x: a.x + shift, y: a.y + stub },
            { x: b.x + shift, y: b.y - stub },
            { x: b.x, y: b.y - stub }
          );
        } else points.push({ x: a.x, y }, { x: b.x, y });
      }
    } else if (parallel) points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + parallel * 28 });
    points.push(b);
    if (route.via && ["orthogonal", "rounded"].includes(curve)) {
      const orthogonal = [points[0]];
      for (const next of points.slice(1)) {
        const previous = orthogonal.at(-1);
        if (previous.x !== next.x && previous.y !== next.y) orthogonal.push({ x: next.x, y: previous.y });
        orthogonal.push(next);
      }
      points = orthogonal;
    }
    if (curve === "bezier" && source.id !== target.id) {
      const controls = route.via ?? points.slice(1, 3);
      d = `M ${pt(a)} C ${pt(controls[0])} ${pt(controls[1])} ${pt(b)}`;
    } else d = polyPath(points, curve === "rounded");
    let label = route.label ?? middle(points);
    if (!route.label && curve === "bezier" && source.id !== target.id) {
      const controls = route.via ?? points.slice(1, 3);
      label = {
        x: (a.x + 3 * controls[0].x + 3 * controls[1].x + b.x) / 8,
        y: (a.y + 3 * controls[0].y + 3 * controls[1].y + b.y) / 8
      };
    }
    return { ...edge, d, points, label };
  }
  function layout(model, options = {}) {
    validateModel(model, options);
    const profile = resolveProfile(model, options);
    const view = options.view ? model.views.find((v) => v.id === options.view) : model.views[0];
    if (!view) fail6(`Unknown view: ${options.view}`);
    if (view.meta !== void 0) return layoutMeta(model, profile, view);
    const visible = visibleNodeIds(model, view);
    const nodes = model.nodes.filter((n) => visible.has(n.id)).map((n) => {
      const definition = profile.nodeTypes[n.type], style = view.styles[n.id] ?? {};
      const template = style.template ?? definition.template;
      const width = style.width ?? view.places[n.id]?.size?.x ?? 220;
      const fontSize = style.fontSize ?? 15, scale = fontSize / 15;
      const textStyle = { title: fontSize, badge: 9 * scale, description: 12 * scale, technology: 10 * scale, titleLeading: 20 * scale, descriptionLeading: 17 * scale, technologyLeading: 13 * scale };
      const position = style.iconPosition ?? "left", top = template === "database" ? 34 : 18;
      const sideInset = ["component", "queue", "node", "artifact", "process"].includes(template) ? 34 : 18;
      const iconBox = { x: position === "left" ? 18 : position === "right" ? width - sideInset - 27 : (width - 27) / 2, y: top, size: 27 };
      const showIcon = style.showIcon !== false;
      const badgeX = position === "left" && showIcon ? 54 : 20;
      const badgeWidth = position === "left" && showIcon ? width - 82 : position === "right" && showIcon ? iconBox.x - badgeX - 9 : width - 40;
      const titleLines = style.showLabel === false ? [] : wrap(n.title, width - 40, textStyle.title), descLines = style.showDescription === false ? [] : wrap(n.description, width - 40, textStyle.description);
      const badgeText = String(n.stereotype ?? n.type), badgeLines = style.showStereotype !== false && badgeText.trim() ? [singleLine(badgeText.toUpperCase(), badgeWidth, textStyle.badge)] : [];
      const technologyLines = style.showTechnology === false ? [] : wrap(n.technology, width - 40, textStyle.technology);
      const textTop = top + (position === "top" && showIcon ? 35 : 0), bottomReserve = position === "bottom" && showIcon ? 39 : 0;
      textStyle.badgeX = badgeX;
      textStyle.badgeY = textTop + Math.max(18, textStyle.badge);
      const headerEnd = Math.max(badgeLines.length ? textStyle.badgeY : top, showIcon ? iconBox.y + iconBox.size : top);
      textStyle.titleY = badgeLines.length ? Math.max(textTop + 44, textStyle.badgeY + textStyle.title + 11) : Math.max(textTop + textStyle.title, headerEnd + textStyle.title + 8);
      const titleEnd = titleLines.length ? textStyle.titleY + (titleLines.length - 1) * textStyle.titleLeading : headerEnd;
      textStyle.descriptionY = titleLines.length ? titleEnd + 25 * scale : headerEnd + textStyle.description + 12;
      const bodyEnd = descLines.length ? textStyle.descriptionY + (descLines.length - 1) * textStyle.descriptionLeading : titleEnd;
      const minHeight = style.height ?? view.places[n.id]?.size?.y ?? 0;
      const height = style.display === "logo" ? Math.max(minHeight, 96) : Math.max(
        minHeight,
        96,
        bodyEnd + (technologyLines.length ? 26 * scale + (technologyLines.length - 1) * textStyle.technologyLeading : 0) + 22 + bottomReserve
      );
      if (position === "bottom") iconBox.y = height - 18 - iconBox.size;
      textStyle.technologyY = height - 18 - bottomReserve - (technologyLines.length - 1) * textStyle.technologyLeading;
      return {
        ...n,
        icon: n.icon ?? definition.icon,
        ...style,
        accent: normalizeColor(style.accent ?? n.accent ?? definition.accent),
        backgroundColor: normalizeColor(style.backgroundColor ?? definition.backgroundColor ?? profile.styleGroups?.[definition.styleGroup]?.backgroundColor),
        container: definition.container,
        template,
        width,
        height,
        textStyle,
        iconBox,
        titleLines,
        badgeText,
        badgeLines,
        descLines,
        technologyLines,
        x: 0,
        y: 0
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const modelNodes = new Map(model.nodes.map((n) => [n.id, n]));
    const edges = model.edges.filter((e) => visible.has(e.source) && visible.has(e.target)).map((edge) => {
      const type = edge.type ?? profile.defaultRelation;
      const rule = profile.relationTypes[type];
      const referenceDisplay = view.referenceDisplay ?? rule.referenceDisplay ?? "labels";
      const referenceItems = referenceDisplay === "labels" ? [] : relationshipReferences(edge, rule).filter((item) => byId.has(item.id) && !byId.get(item.id).container);
      const referenceOccurrences = view.referenceOccurrences ?? rule.referenceOccurrences ?? "shared";
      return { ...edge, type, style: rule.style, referenceDisplay, referenceOccurrences, referenceItems, labelText: relationshipLabel(edge, rule, modelNodes) };
    });
    if (view.diagram && view.diagram.type !== "connected") return layoutDiagram(model, profile, view, nodes, edges);
    const referenced = new Set(edges.flatMap((e) => e.referenceItems.map((item) => item.id)));
    const endpoints = new Set(edges.flatMap((e) => [e.source, e.target]));
    for (const node of nodes) if (referenced.has(node.id) && !endpoints.has(node.id) && !node.parent && !node.container && !view.places[node.id]) node.referenceOnly = true;
    const process = (parent) => {
      const children = nodes.filter((n) => n.parent === parent && !n.referenceOnly);
      for (const child2 of children) if (child2.container) process(child2.id);
      arrange(children, edges, view.direction, view.spacing, view.places, byId);
      if (parent) {
        const box = byId.get(parent);
        const minX2 = Math.min(0, ...children.map((n) => n.x)), minY2 = Math.min(0, ...children.map((n) => n.y));
        box.width = Math.max(box.width, ...children.map((n) => n.x + 28 - minX2 + n.width + 28));
        const scale = box.textStyle.title / 15;
        box.packageBadge = box.showStereotype === false ? "" : singleLine(box.type === "package" ? "PACKAGE" : "CONTAINER", Math.max(20, box.width * 0.4), box.textStyle.badge);
        const badgeWidth = textLength(box.packageBadge) * box.textStyle.badge;
        box.packageTitleSize = 14 * scale;
        const position = box.iconPosition ?? "left";
        const showIcon = box.showIcon !== false, offset = position === "top" && showIcon ? 35 : 0;
        box.packageTitleX = position === "left" && showIcon ? 53 : 20;
        box.packageBadgeX = box.width - (position === "right" && showIcon ? 53 : 18);
        box.packageTitleY = Math.max(32, 17 + box.packageTitleSize) + offset;
        box.packageBadgeY = Math.max(32, 17 + box.textStyle.badge) + offset;
        box.titleLines = box.showLabel === false ? [] : wrap(box.title, Math.max(10, box.packageBadgeX - badgeWidth - 12 - box.packageTitleX), box.packageTitleSize);
        const textEnd = Math.max(17, box.packageBadge ? box.packageBadgeY : 0, box.titleLines.length ? box.packageTitleY + (box.titleLines.length - 1) * box.textStyle.titleLeading : 0);
        box.iconBox = { x: position === "left" ? 20 : position === "right" ? box.width - 42 : (box.width - 22) / 2, y: position === "bottom" ? textEnd + 12 : 17, size: 22 };
        box.headerHeight = Math.max(56, textEnd + 24, showIcon ? box.iconBox.y + box.iconBox.size + 17 : 0);
        box.contentOffset = { x: 28 - minX2, y: box.headerHeight + 16 - minY2 };
        box.width = Math.max(box.width, ...children.map((n) => n.x + box.contentOffset.x + n.width + 28));
        box.height = Math.max(box.height, ...children.map((n) => n.y + box.contentOffset.y + n.height + 28));
      }
    };
    process(null);
    const absolute = (parent, x, y) => {
      for (const node of nodes.filter((n) => n.parent === parent)) {
        node.x += x;
        node.y += y;
        if (node.container) absolute(node.id, node.x + node.contentOffset.x, node.y + node.contentOffset.y);
      }
    };
    absolute(null, 0, 0);
    const parallel = /* @__PURE__ */ new Map();
    const routedEdges = edges.map((edge) => {
      const key = [edge.source, edge.target].sort().join("\0"), count = parallel.get(key) ?? 0;
      parallel.set(key, count + 1);
      const route = routingOptions(view, view.routes[edge.id]) ?? {};
      const labelHidden = route.label === "none";
      const result = routeEdge(edge, byId.get(edge.source), byId.get(edge.target), { ...route, label: labelHidden ? void 0 : route.label }, count);
      result.labelHidden = labelHidden;
      result.labelExplicit = route.label !== void 0;
      const omit = edge.referenceDisplay === "nodes" ? new Set(edge.referenceItems.map((item) => `${item.attribute}\0${item.id}`)) : /* @__PURE__ */ new Set();
      const displayText = relationshipLabel(edge, profile.relationTypes[edge.type], modelNodes, omit);
      result.labelLines = labelHidden || route.showLabel === false ? [] : wrap(displayText, displayText === edge.title ? 160 : 200, 11);
      result.labelWidth = labelHidden ? 0 : Math.max(28, ...result.labelLines.map((line) => textLength(line) * 11 + 18));
      result.labelHeight = labelHidden ? 0 : result.labelLines.length * 15 + 8;
      result.labelTextOffset = { x: 0, y: 0 };
      if (!labelHidden && route.showIcon !== false && route.icon && route.icon !== "none") {
        result.labelIcon = route.icon;
        result.labelIconPosition = route.iconPosition ?? "left";
        result.labelIconLoc = route.loc;
        const size = 16, hasText = result.labelLines.length > 0, gap = hasText ? 6 : 0;
        const textWidth = hasText ? result.labelWidth - 18 : 0, textHeight = result.labelLines.length * 15;
        const horizontal = ["left", "right"].includes(result.labelIconPosition);
        const before = ["left", "top"].includes(result.labelIconPosition), sign = before ? 1 : -1;
        const width = horizontal ? textWidth + size + gap : Math.max(textWidth, size);
        const height = horizontal ? Math.max(textHeight, size) : textHeight + size + gap;
        result.labelWidth = width + 18;
        result.labelHeight = height + 8;
        result.labelTextOffset = horizontal ? { x: sign * (size + gap) / 2, y: 0 } : { x: 0, y: sign * (size + gap) / 2 };
        result.labelIconBox = {
          x: horizontal ? before ? -width / 2 : width / 2 - size : -size / 2,
          y: horizontal ? -size / 2 : before ? -height / 2 : height / 2 - size,
          size
        };
      }
      if (!result.labelLines.length && !result.labelIcon) {
        result.labelWidth = 0;
        result.labelHeight = 0;
      }
      return result;
    });
    const referenceNodes = attachReferenceNodes(nodes, routedEdges, view, wrap, (card, anchor, route) => routeEdge({}, card, { id: null, ...anchor, width: 0, height: 0 }, { ...route, to: { x: anchor.x, y: anchor.y } }, 0));
    const extents = nodes.flatMap((n) => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
    for (const occurrence of referenceNodes) {
      extents.push({ x: occurrence.node.x, y: occurrence.node.y }, { x: occurrence.node.x + occurrence.node.width, y: occurrence.node.y + occurrence.node.height }, ...occurrence.points);
    }
    for (const edge of routedEdges) {
      extents.push(...edge.points);
      if (edge.labelLines.length || edge.labelIcon) extents.push(
        { x: edge.label.x - edge.labelWidth / 2, y: edge.label.y - edge.labelHeight / 2 },
        { x: edge.label.x + edge.labelWidth / 2, y: edge.label.y + edge.labelHeight / 2 }
      );
    }
    const minX = Math.min(0, ...extents.map((p) => p.x)) - 48, minY = Math.min(0, ...extents.map((p) => p.y)) - 48;
    const maxX = Math.max(160, ...extents.map((p) => p.x)) + 48, maxY = Math.max(96, ...extents.map((p) => p.y)) + 48;
    return {
      title: model.title,
      description: model.description,
      profile: { id: profile.id, version: profile.version },
      view,
      nodes,
      edges: routedEdges,
      referenceNodes,
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    };
  }

  // src/iconify.js
  var import_xmldom = __toESM(require_lib(), 1);
  var import_svgpath2 = __toESM(require_svgpath2(), 1);
  var own4 = (o, k) => Object.hasOwn(o, k);
  var record3 = (o) => o && typeof o === "object" && !Array.isArray(o);
  var esc2 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var tags = /* @__PURE__ */ new Set([
    "svg",
    "g",
    "defs",
    "use",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "mask",
    "pattern",
    "title",
    "desc",
    "filter",
    "feFlood",
    "feBlend",
    "feGaussianBlur",
    "feOffset",
    "feColorMatrix",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feComposite"
  ]);
  var numeric = /* @__PURE__ */ new Set([
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "fx",
    "fy",
    "fr",
    "width",
    "height",
    "stroke-width",
    "stroke-miterlimit",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "stop-opacity",
    "flood-opacity",
    "offset",
    "dx",
    "dy",
    "k1",
    "k2",
    "k3",
    "k4"
  ]);
  var lengths = /* @__PURE__ */ new Set(["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "width", "height", "stroke-width", "dx", "dy"]);
  var vectors = /* @__PURE__ */ new Set(["points", "viewBox", "stdDeviation", "radius", "values"]);
  var enums = {
    "stroke-linecap": ["butt", "round", "square"],
    "stroke-linejoin": ["miter", "round", "bevel"],
    "fill-rule": ["nonzero", "evenodd"],
    "clip-rule": ["nonzero", "evenodd"],
    gradientUnits: ["userSpaceOnUse", "objectBoundingBox"],
    maskUnits: ["userSpaceOnUse", "objectBoundingBox"],
    maskContentUnits: ["userSpaceOnUse", "objectBoundingBox"],
    clipPathUnits: ["userSpaceOnUse", "objectBoundingBox"],
    filterUnits: ["userSpaceOnUse", "objectBoundingBox"],
    primitiveUnits: ["userSpaceOnUse", "objectBoundingBox"],
    patternUnits: ["userSpaceOnUse", "objectBoundingBox"],
    patternContentUnits: ["userSpaceOnUse", "objectBoundingBox"],
    spreadMethod: ["pad", "reflect", "repeat"],
    "mask-type": ["alpha", "luminance"],
    "color-interpolation-filters": ["sRGB", "linearRGB", "auto"],
    "color-interpolation": ["sRGB", "linearRGB", "auto"],
    type: ["matrix", "saturate", "hueRotate", "luminanceToAlpha"],
    operator: ["over", "in", "out", "atop", "xor", "arithmetic", "erode", "dilate"],
    mode: ["normal", "multiply", "screen", "darken", "lighten", "overlay"],
    display: ["none", "inline"],
    visibility: ["visible", "hidden", "collapse"]
  };
  var paints = /* @__PURE__ */ new Set(["fill", "stroke", "color", "stop-color", "flood-color"]);
  var reference = /* @__PURE__ */ new Set(["href", "xlink:href", "clip-path", "mask", "filter"]);
  var transforms = /* @__PURE__ */ new Set(["transform", "gradientTransform", "patternTransform"]);
  var number = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
  function numbers(value2) {
    const parts = value2.trim().split(/[\s,]+/);
    if (!parts.length || parts.length > 2e4 || parts.some((p) => !number.test(p) || !Number.isFinite(Number(p)) || Math.abs(Number(p)) > 1e15)) throw Error("Invalid SVG numbers");
    return parts;
  }
  function enableBackground(value2) {
    value2 = value2.trim();
    if (["accumulate", "inherit", "new"].includes(value2)) return value2;
    const match = value2.match(/^new\s+([\s\S]+)$/);
    if (!match) throw Error("Invalid SVG enable-background");
    const rect = numbers(match[1]);
    if (rect.length !== 4 || Number(rect[2]) < 0 || Number(rect[3]) < 0) throw Error("Invalid SVG enable-background");
    return `new ${rect.join(" ")}`;
  }
  function transform(value2) {
    const pattern = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)\s*,?/g;
    let end = 0, count = 0;
    for (const m of value2.matchAll(pattern)) {
      if (m.index !== end) throw Error("Invalid SVG transform");
      const n = numbers(m[2]).length, allowed = { matrix: [6], translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewX: [1], skewY: [1] };
      if (!allowed[m[1]].includes(n) || ++count > 64) throw Error("Invalid SVG transform arity");
      end = m.index + m[0].length;
    }
    if (!count || end !== value2.length) throw Error("Invalid SVG transform");
    return value2;
  }
  function iconPaint(value2) {
    if (typeof value2 !== "string") return void 0;
    if (/^(none|inherit|transparent)$/i.test(value2)) return value2.toLowerCase();
    if (/^currentcolor$/i.test(value2)) return "currentColor";
    const hex = normalizeColor(value2);
    if (hex) return hex;
    if (/^#(?:[a-f\d]{4}|[a-f\d]{8})$/i.test(value2)) return value2;
    const fn = value2.match(/^(rgba?|hsla?)\(([-+\d.eE%,\s/]+)\)$/i);
    if (fn) {
      const values = fn[2].trim().split(/[\s,/]+/);
      if ([3, 4].includes(values.length) && values.every((v) => number.test(v.replace(/%$/, "")) && Number.isFinite(Number(v.replace(/%$/, ""))))) return value2;
    }
    return void 0;
  }
  var freeze2 = (o) => {
    if (o && typeof o === "object") {
      Object.values(o).forEach(freeze2);
      Object.freeze(o);
    }
    return o;
  };
  function parseBody(body) {
    if (typeof body !== "string" || !body.length || body.length > 1e6) throw Error("Invalid Iconify SVG body");
    body = body.replace(/^\s*<\?xml\s+[^?]*\?>/i, "").replace(/^\s*<!DOCTYPE\s+svg\s+PUBLIC\s+(["'])-\/\/W3C\/\/DTD SVG 1\.1\/\/EN\1\s+(["'])https?:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd\2\s*>/i, "");
    if (/<!DOCTYPE|<!ENTITY|<\?/i.test(body)) throw Error("Invalid Iconify SVG body");
    const doc = new import_xmldom.DOMParser({ onError: (level, message) => {
      throw Error(`Invalid SVG XML: ${message}`);
    } }).parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`, "image/svg+xml");
    const ids = /* @__PURE__ */ new Map(), links = /* @__PURE__ */ new Map();
    let count = 0;
    const read = (element, depth = 0) => {
      if (depth > 64 || ++count > 4096) throw Error("SVG exceeds complexity limit");
      const tag = element.tagName;
      if (!tags.has(tag)) throw Error(`Unsupported SVG element: ${tag}`);
      const node = { tag, attrs: /* @__PURE__ */ Object.create(null), children: [] }, refs = [];
      links.set(node, refs);
      const apply = (key, value2, override = false) => {
        if (key === "xlink:href") key = "href";
        if (key.startsWith("data-")) return;
        if (override) {
          delete node.attrs[key];
          for (let i = refs.length - 1; i >= 0; i--) if (refs[i].key === key) refs.splice(i, 1);
        }
        if (/^url\(#[^\s\"'()<>]+$/.test(value2)) value2 += ")";
        const local = value2.match(/^url\(\s*([\"'])(#[^\s\"'()<>]+)\1\s*\)$/);
        if (local) value2 = `url(${local[2]})`;
        if (key === "xmlns" || key === "xmlns:xlink") {
          if (value2 !== (key === "xmlns" ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xlink")) throw Error("Invalid SVG namespace");
          return;
        }
        if (key.startsWith("xmlns:")) return;
        if (key === "xml:space" && ["default", "preserve"].includes(value2)) return;
        if (tag === "svg" && key === "version" && ["1.0", "1.1", "2.0"].includes(value2)) return;
        if (key === "class") return;
        if (key === "id") {
          if (!value2 || /[\s"'()<>]/.test(value2) || ids.has(value2)) throw Error("Invalid/duplicate SVG ID");
          ids.set(value2, node);
        } else if (key === "d") {
          const path = (0, import_svgpath2.default)(value2);
          if (path.err) throw Error(path.err);
          value2 = path.round(6).toString();
        } else if (numeric.has(key)) {
          const v = value2.trim().replace(lengths.has(key) ? /(?:px|%)$/ : /%$/, "");
          numbers(v);
          if (numbers(v).length !== 1) throw Error(`Invalid ${key}`);
        } else if (vectors.has(key)) {
          const n = numbers(value2);
          if (key === "viewBox" && n.length !== 4) throw Error("Invalid viewBox");
          if (key === "points" && (n.length < 4 || n.length % 2)) throw Error("Invalid points");
        } else if (transforms.has(key)) transform(value2);
        else if (key === "enable-background") value2 = enableBackground(value2);
        else if (own4(enums, key)) {
          if (!enums[key].includes(value2)) throw Error(`Invalid SVG ${key}`);
        } else if (key === "preserveAspectRatio") {
          if (!/^(none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value2)) throw Error("Invalid preserveAspectRatio");
        } else if (["in", "in2", "result"].includes(key)) {
          if (!/^[\w.-]+$/.test(value2)) throw Error("Invalid filter input");
        } else if (paints.has(key) || reference.has(key)) {
          if (/^url\(#[^\s"'()<>]+\)$/.test(value2)) {
            const id = value2.slice(5, -1);
            refs.push({ key, id });
          } else if (["href", "xlink:href"].includes(key) && /^#[^\s"'()<>]+$/.test(value2)) refs.push({ key, id: value2.slice(1) });
          else if (paints.has(key)) {
            value2 = iconPaint(value2);
            if (!value2) throw Error(`Invalid SVG paint: ${key}`);
          } else if (value2 !== "none") throw Error(`External/invalid SVG reference: ${key}`);
        } else throw Error(`Unsupported SVG attribute: ${key}`);
        if (own4(node.attrs, key)) throw Error(`Duplicate SVG attribute: ${key}`);
        node.attrs[key] = value2;
      };
      for (const attribute of Array.from(element.attributes)) if (attribute.name !== "style") apply(attribute.name, attribute.value);
      if (element.hasAttribute("style")) for (const declaration of element.getAttribute("style").split(";").filter((s) => s.trim())) {
        const match = declaration.match(/^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/);
        if (!match || !paints.has(match[1]) && !numeric.has(match[1]) && !own4(enums, match[1]) && match[1] !== "enable-background") throw Error("Unsupported SVG style");
        apply(match[1], match[2], true);
      }
      for (const child2 of Array.from(element.childNodes)) {
        if (child2.nodeType === 1) node.children.push(read(child2, depth + 1));
        else if (child2.nodeType === 3 || child2.nodeType === 4) {
          if (["title", "desc"].includes(tag)) node.children.push(child2.nodeValue);
          else if (child2.nodeValue.trim()) throw Error("Unexpected SVG text");
        } else if (child2.nodeType !== 8) throw Error("Unsupported SVG node");
      }
      return node;
    };
    const tree = read(doc.documentElement);
    const state = /* @__PURE__ */ new Map(), cost = /* @__PURE__ */ new Map();
    const visit = (node) => {
      if (state.get(node) === 1) throw Error("Cyclic SVG reference");
      if (state.get(node) === 2) return cost.get(node);
      state.set(node, 1);
      let size = 1;
      for (const child2 of node.children) if (typeof child2 !== "string") size += visit(child2);
      for (const { id, key } of links.get(node)) {
        const target = ids.get(id);
        if (!target) continue;
        const allowed = { fill: ["linearGradient", "radialGradient", "pattern"], stroke: ["linearGradient", "radialGradient", "pattern"], "clip-path": ["clipPath"], mask: ["mask"], filter: ["filter"] };
        if (allowed[key] && !allowed[key].includes(target.tag)) throw Error("Invalid SVG reference target");
        size += visit(target);
      }
      if (size > 1e5) throw Error("SVG reference expansion exceeds limit");
      state.set(node, 2);
      cost.set(node, size);
      return size;
    };
    visit(tree);
    return tree;
  }
  function merged(parent, child2) {
    const out = { ...parent };
    for (const key of ["left", "top", "width", "height"]) if (child2[key] !== void 0) out[key] = child2[key];
    for (const key of ["hFlip", "vFlip"]) if (child2[key] !== void 0) {
      if (typeof child2[key] !== "boolean") throw Error(`Invalid ${key}`);
      out[key] = !!parent[key] !== child2[key];
    }
    if (child2.rotate !== void 0) {
      if (!Number.isSafeInteger(child2.rotate)) throw Error("Invalid icon rotation");
      out.rotate = ((parent.rotate ?? 0) + child2.rotate) % 4;
    }
    return out;
  }
  function readIconify(pack) {
    if (!record3(pack.icons) || pack.aliases !== void 0 && !record3(pack.aliases)) throw Error("Invalid Iconify collection");
    const names2 = [...Object.keys(pack.icons), ...Object.keys(pack.aliases ?? {})];
    if (!names2.length || names2.length > 2e4 || new Set(names2).size !== names2.length) throw Error("Invalid Iconify names/count");
    const resolved = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Set();
    const resolve = (id, depth = 0) => {
      if (resolved.has(id)) return resolved.get(id);
      if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id) || pending.has(id) || depth > 64) throw Error(`Invalid/cyclic Iconify alias: ${id}`);
      pending.add(id);
      let data;
      if (own4(pack.icons, id)) {
        const icon = pack.icons[id];
        if (!record3(icon)) throw Error(`Invalid icon ${id}`);
        const tree = parseBody(icon.body), full = tree.children.length === 1 && tree.children[0].tag === "svg" ? tree.children[0] : null;
        const viewBox = full?.attrs.viewBox?.trim().split(/[\s,]+/).map(Number);
        const absolute = (key) => {
          const raw = full?.attrs[key];
          return raw && /^[-+\d.eE]+(?:px)?$/.test(raw) ? Number(raw.replace(/px$/, "")) : void 0;
        };
        const defaults = { left: 0, top: 0, width: absolute("width") ?? viewBox?.[2] ?? 16, height: absolute("height") ?? viewBox?.[3] ?? 16, rotate: 0, hFlip: false, vFlip: false };
        if (full) {
          full.attrs.width = "100%";
          full.attrs.height = "100%";
        }
        const props = Object.fromEntries(Object.keys(defaults).map((key) => [key, icon[key] ?? pack[key] ?? defaults[key]]));
        data = { ...merged({}, props), tree };
      } else {
        const alias = pack.aliases?.[id];
        if (!record3(alias) || typeof alias.parent !== "string") throw Error(`Unknown Iconify alias parent: ${id}`);
        data = merged(resolve(alias.parent, depth + 1), alias);
      }
      for (const key of ["left", "top", "width", "height"]) if (!Number.isFinite(data[key]) || Math.abs(data[key]) > 4096 || ["width", "height"].includes(key) && data[key] <= 0) throw Error(`Invalid Iconify dimension: ${id}.${key}`);
      pending.delete(id);
      resolved.set(id, data);
      return data;
    };
    const result = /* @__PURE__ */ new Map();
    for (const id of names2) {
      try {
        const d = resolve(id), rotation = ((d.rotate ?? 0) % 4 + 4) % 4;
        let transform2 = `translate(${-d.left} ${-d.top})`;
        if (d.hFlip) transform2 = `matrix(-1 0 0 1 ${d.width} 0) ${transform2}`;
        if (d.vFlip) transform2 = `matrix(1 0 0 -1 0 ${d.height}) ${transform2}`;
        const rotations = ["", `matrix(0 1 -1 0 ${d.height} 0)`, `matrix(-1 0 0 -1 ${d.width} ${d.height})`, `matrix(0 -1 1 0 0 ${d.width})`];
        result.set(id, freeze2({ width: rotation % 2 ? d.height : d.width, height: rotation % 2 ? d.width : d.height, tree: d.tree, transform: `${rotations[rotation]} ${transform2}` }));
      } catch (error) {
        throw Error(`${id}: ${error.message}`);
      }
    }
    return result;
  }
  function iconifyMarkup(icon, scope) {
    const ids = /* @__PURE__ */ new Map();
    let next = 0;
    const collect = (node) => {
      if (own4(node.attrs, "id") && !ids.has(node.attrs.id)) ids.set(node.attrs.id, `${scope}-${next++}`);
      for (const [key, v] of Object.entries(node.attrs)) {
        const ref = /^url\(#/.test(v) ? v.slice(5, -1) : ["href", "xlink:href"].includes(key) && v.startsWith("#") ? v.slice(1) : null;
        if (ref && !ids.has(ref)) ids.set(ref, `${scope}-${next++}`);
      }
      node.children.filter((c) => typeof c !== "string").forEach(collect);
    };
    collect(icon.tree);
    const write = (node) => {
      if (typeof node === "string") return esc2(node);
      const attrs = Object.entries(node.attrs).map(([key, v]) => {
        if (key === "id") v = ids.get(v);
        else if (/^url\(#/.test(v)) v = `url(#${ids.get(v.slice(5, -1))})`;
        else if (["href", "xlink:href"].includes(key) && v.startsWith("#")) v = `#${ids.get(v.slice(1))}`;
        return ` ${key === "xlink:href" ? "href" : key}="${esc2(v)}"`;
      }).join("");
      const tag = node === icon.tree ? "g" : node.tag;
      return `<${tag}${attrs}>${node.children.map(write).join("")}</${tag}>`;
    };
    return `<svg width="${icon.width}" height="${icon.height}" viewBox="0 0 ${icon.width} ${icon.height}" overflow="hidden"><g fill="currentColor" stroke="none" transform="${esc2(icon.transform)}">${write(icon.tree)}</g></svg>`;
  }

  // src/icons.js
  var packs = /* @__PURE__ */ new Map();
  var paintDefaults = Object.freeze({
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    linecap: "round",
    linejoin: "round",
    fillRule: "nonzero",
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1
  });
  var paintKeys = Object.keys(paintDefaults);
  function registerIconPack(name, pack) {
    const error = (message) => {
      throw new ArchError(message, {}, "ARCH_ICON");
    };
    if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) error("Invalid icon pack name");
    if (!pack || !pack.icons || typeof pack.icons !== "object" || Array.isArray(pack.icons)) error("icon pack requires an icons object");
    if (Object.values(pack.icons).some((icon) => icon && Object.hasOwn(icon, "body"))) {
      try {
        const converted = readIconify(pack);
        packs.set(name, converted);
        return;
      } catch (cause) {
        error(`Iconify ${name}: ${cause.message}`);
      }
    }
    const result = /* @__PURE__ */ new Map();
    if (Object.keys(pack.icons).length > 2e4) error("At most 20000 icons are allowed per pack");
    for (const [id, icon] of Object.entries(pack.icons)) {
      if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id) || !icon) error(`Invalid icon: ${id}`);
      const width = icon.width ?? pack.width ?? 24, height = icon.height ?? pack.height ?? 24;
      if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 4096)) error(`Invalid icon size: ${id}`);
      if (!Array.isArray(icon.paths) || !icon.paths.length || icon.paths.length > 64) error(`Invalid paths for icon: ${id}`);
      const paths = icon.paths.map((path) => {
        const value2 = typeof path === "string" ? { d: path } : path;
        if (!value2 || typeof value2 !== "object" || Object.keys(value2).some((key) => !["d", ...paintKeys].includes(key)))
          error(`Invalid path object: ${id}`);
        inspectPath(value2.d);
        const paint = Object.fromEntries(paintKeys.map((key) => [key, value2[key] ?? paintDefaults[key]]));
        for (const key of ["fill", "stroke"]) {
          const color = iconPaint(paint[key]);
          if (!color) error(`Invalid icon color: ${id}.${key}`);
          paint[key] = color;
        }
        if (!["butt", "round", "square"].includes(paint.linecap) || !["miter", "round", "bevel"].includes(paint.linejoin) || !["nonzero", "evenodd"].includes(paint.fillRule)) error(`Invalid paint style: ${id}`);
        if (!Number.isFinite(paint.strokeWidth) || paint.strokeWidth < 0 || paint.strokeWidth > 64 || ["opacity", "fillOpacity", "strokeOpacity"].some((key) => !Number.isFinite(paint[key]) || paint[key] < 0 || paint[key] > 1))
          error(`Invalid stroke width or opacity: ${id}`);
        return Object.freeze({ d: value2.d, ...paint });
      });
      result.set(id, Object.freeze({ width, height, paths: Object.freeze(paths) }));
    }
    if (!result.size) error("icon pack is empty");
    packs.set(name, result);
  }
  function getIconPacks() {
    return [...packs.keys()];
  }
  function getIconNames(pack) {
    if (!packs.has(pack)) throw new ArchError(`Unknown icon pack: ${pack}`, {}, "ARCH_ICON");
    return [...packs.get(pack).keys()].sort();
  }
  function getIcon(name, loc) {
    const [pack, id, ...rest] = String(name).split(".");
    const result = !rest.length && packs.get(pack)?.get(id);
    if (!result) throw new ArchError(`Unknown icon: ${name}`, loc, "ARCH_ICON");
    return result;
  }
  registerIconPack("core", { icons: {
    person: { paths: ["M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M4 21v-2a8 8 0 0 1 16 0v2"] },
    system: { paths: ["M3 4h18v13H3Z", "M8 21h8M12 17v4M7 8h10M7 12h6"] },
    browser: { paths: ["M3 4h18v16H3ZM3 9h18M7 6.5h.01M10 6.5h.01", "m9 12-3 2 3 2m6-4 3 2-3 2"] },
    service: { paths: ["m12 2 9 5v10l-9 5-9-5V7Z", "m3 7 9 5 9-5M12 12v10M8 4l9 5"] },
    component: { paths: ["M8 3h13v18H8v-4M8 13V9M8 5V3", "M3 5h8v4H3ZM3 13h8v4H3Z"] },
    database: { paths: ["M21 5c0 4-18 4-18 0s18-4 18 0ZM3 5v14c0 4 18 4 18 0V5", "M3 12c0 4 18 4 18 0"] },
    queue: { paths: ["M3 5h18v14H3ZM8 5v14M16 5v14", "m10 10 3 2-3 2"] },
    interface: { paths: ["M16 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM16 12h6M1 12h5"] },
    capability: { paths: ["m12 2 2.8 6 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 8.9 9.2 8Z"] },
    process: { paths: ["M3 5h13l5 7-5 7H3l5-7Z"] },
    artifact: { paths: ["M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8M8 16h6"] },
    node: { paths: ["M3 4h18v16H3ZM3 9h18M7 6.5h.01M7 13h.01M7 17h.01M11 13h6M11 17h6"] },
    package: { paths: ["M3 7V4h7l3 3h8v13H3ZM3 7h18"] },
    cloud: { paths: ["M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-1A5 5 0 0 0 6 18Z"] },
    shield: { paths: ["m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z", "m8 12 3 3 5-6"] },
    globe: { paths: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20", "M12 2c6 6 6 14 0 20-6-6-6-14 0-20Z"] }
  } });
  var defaultIcon = (type) => `core.${type === "application" ? "browser" : type}`;

  // src/svg.js
  var escape2 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var serial = 0;
  var iconSerial = 0;
  var accents = {
    person: "#64748b",
    system: "#4f46e5",
    application: "#6366f1",
    service: "#0d9488",
    component: "#8b5cf6",
    database: "#d97706",
    queue: "#db8b22",
    interface: "#0891b2",
    capability: "#9333ea",
    process: "#0284c7",
    artifact: "#64748b",
    node: "#475569",
    package: "#64748b"
  };
  function iconMarkup(name, x, y, size, loc, scope = `arch-icon-${++iconSerial}`) {
    const icon = getIcon(name, loc), scale = size / Math.max(icon.width, icon.height);
    return `<g data-icon="${escape2(name)}" transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})">${icon.tree ? iconifyMarkup(icon, scope) : icon.paths.map((p) => `<path d="${escape2(p.d)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="${p.linecap}" stroke-linejoin="${p.linejoin}" fill-rule="${p.fillRule}" opacity="${p.opacity}" fill-opacity="${p.fillOpacity}" stroke-opacity="${p.strokeOpacity}"/>`).join("")}</g>`;
  }
  function renderIconToString(name, { size = 24, title = name, idPrefix = `arch-icon-${++iconSerial}` } = {}) {
    if (!Number.isFinite(size) || size <= 0 || size > 512) throw new ArchError("icon size must be greater than 0 and at most 512");
    if (typeof idPrefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(idPrefix)) throw new ArchError("Invalid idPrefix");
    const icon = getIcon(name), longest = Math.max(icon.width, icon.height);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" width="${num(size * icon.width / longest)}" height="${num(size * icon.height / longest)}" role="img" aria-label="${escape2(title)}"><title>${escape2(title)}</title>${iconMarkup(name, 0, 0, longest, void 0, idPrefix)}</svg>`;
  }
  function linesMarkup(lines, x, y, size, color, weight = 400, lineHeight = 17, anchor = "start") {
    return `<text x="${num(x)}" y="${num(y)}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${num(x)}" dy="${i ? lineHeight : 0}">${escape2(line)}</tspan>`).join("")}</text>`;
  }
  function nodeMarkup(node, palette, prefix, backdrop = palette.bg, iconScope = prefix) {
    const { width: w, height: h } = node;
    let accent = node.accent ?? accents[node.template] ?? accents.node;
    if (palette.dark) {
      const hex = accent.slice(1), full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
      accent = "#" + full.match(/../g).map((c) => Math.round(parseInt(c, 16) * 0.62 + 255 * 0.38).toString(16).padStart(2, "0")).join("");
    }
    const opacity = node.opacity ?? (node.backgroundColor ? 0.2 : 1);
    if (node.backgroundColor || node.opacity !== void 0) {
      const visibleColor = composite(node.backgroundColor ?? (node.container ? palette.package : palette.card), backdrop, opacity);
      const text = foreground(visibleColor);
      palette = { ...palette, card: node.backgroundColor ?? palette.card, package: node.backgroundColor ?? palette.package, text, muted: text, border: text };
      if (contrast(accent, visibleColor) < 4.5 || contrast(accent, composite(accent, visibleColor, 0.1)) < 4.5) accent = text;
    }
    const fillOpacity = node.backgroundColor || node.opacity !== void 0 ? ` fill-opacity="${num(opacity)}"` : "";
    const title = `<title>${escape2(node.title)} — ${escape2(node.type)}${node.stereotype && node.stereotype !== node.type ? ` [${escape2(node.stereotype)}]` : ""}${node.description ? `: ${escape2(node.description)}` : ""}</title>`;
    const attrs = `data-node="${escape2(node.id)}" data-type="${escape2(node.type)}" data-template="${node.template}" data-icon-position="${node.iconPosition ?? (node.display === "logo" ? "center" : "left")}" transform="translate(${num(node.x)} ${num(node.y)})"`;
    const iconName = node.icon ?? defaultIcon(node.template);
    if (node.display === "logo") {
      let logo = "";
      if (node.showIcon !== false) {
        const icon = getIcon(iconName, node.loc), scale = Math.min((w - 32) / icon.width, (h - 32) / icon.height);
        const width = icon.width * scale, height = icon.height * scale;
        const x = node.iconPosition === "left" ? 16 : node.iconPosition === "right" ? w - 16 - width : (w - width) / 2;
        const y = node.iconPosition === "top" ? 16 : node.iconPosition === "bottom" ? h - 16 - height : (h - height) / 2;
        logo = `<g color="${accent}">${iconMarkup(iconName, x, y, Math.max(width, height), node.loc, `${iconScope}-${node.id}-logo`)}</g>`;
      }
      return `<g class="arch-node" ${attrs} data-display="logo" tabindex="0" role="group" aria-label="${escape2(`${node.title}, ${node.type}`)}">${title}
      <g filter="url(#${prefix}-shadow)"><rect x="0.75" y="0.75" width="${num(w - 1.5)}" height="${num(h - 1.5)}" rx="13" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/></g>${logo}</g>`;
    }
    const iconBox = node.iconBox;
    let nodeIcon = "";
    if (node.showIcon !== false) {
      const shapeIcon = getIcon(iconName, node.loc), glyphSize = node.container ? 22 : 17, glyphScale = glyphSize / Math.max(shapeIcon.width, shapeIcon.height);
      nodeIcon = iconMarkup(iconName, iconBox.x + (iconBox.size - shapeIcon.width * glyphScale) / 2, iconBox.y + (iconBox.size - shapeIcon.height * glyphScale) / 2, glyphSize, node.loc, `${iconScope}-${node.id}-icon`);
    }
    if (node.container) {
      return `<g class="arch-package" ${attrs}>${title}
      <rect width="${num(w)}" height="${num(h)}" rx="18" fill="${palette.package}"${fillOpacity} stroke="${palette.border}" stroke-dasharray="5 4"/>
      <path d="M 0 ${num(node.headerHeight)} H ${num(w)}" stroke="${palette.border}"/>
      <g color="${accent}">${nodeIcon}</g>
      ${node.titleLines.length ? linesMarkup(node.titleLines, node.packageTitleX, node.packageTitleY, node.packageTitleSize, palette.text, 650, node.textStyle.titleLeading) : ""}
      ${node.packageBadge ? linesMarkup([node.packageBadge], node.packageBadgeX, node.packageBadgeY, node.textStyle.badge, palette.muted, 600, 17, "end") : ""}
    </g>`;
    }
    let shape;
    const standard = `<rect x="0.75" y="0.75" width="${num(w - 1.5)}" height="${num(h - 1.5)}" rx="13" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`;
    switch (node.template) {
      case "database":
        shape = `<path d="M1 15 C1 -3 ${num(w - 1)} -3 ${num(w - 1)} 15 V${num(h - 15)} C${num(w - 1)} ${num(h + 3)} 1 ${num(h + 3)} 1 ${num(h - 15)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>
        <path d="M1 15 C1 33 ${num(w - 1)} 33 ${num(w - 1)} 15" fill="none" stroke="${palette.border}"/>`;
        break;
      case "process":
        shape = `<path d="M1 1 H${num(w - 20)} L${num(w - 1)} ${num(h / 2)} L${num(w - 20)} ${num(h - 1)} H1 L13 ${num(h / 2)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`;
        break;
      case "artifact":
        shape = `<path d="M1 1 H${num(w - 23)} L${num(w - 1)} 23 V${num(h - 1)} H1Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/><path d="M${num(w - 23)} 1 V23 H${num(w - 1)}" fill="none" stroke="${palette.border}"/>`;
        break;
      case "interface":
        shape = standard.replace('rx="13"', 'rx="36"');
        break;
      case "capability":
        shape = standard.replace('rx="13"', 'rx="24"');
        break;
      default:
        shape = standard;
    }
    const extras = {
      system: `<rect x="5" y="5" width="${num(w - 10)}" height="${num(h - 10)}" rx="9" fill="none" stroke="${palette.border}" opacity=".65"/>`,
      component: `<path d="M${num(w - 22)} 18h12v8h-12ZM${num(w - 22)} 31h12v8h-12Z" fill="${palette.card}"${fillOpacity} stroke="${accent}"/>`,
      queue: `<path d="M${num(w - 17)} 14V${num(h - 14)}M${num(w - 12)} 14V${num(h - 14)}" stroke="${accent}" opacity=".35"/>`,
      node: `<circle cx="${num(w - 18)}" cy="22" r="3" fill="${accent}"/>`
    }[node.template] ?? "";
    const fonts = node.textStyle;
    const badge = node.badgeLines.length ? `<text data-node-badge="true" x="${num(fonts.badgeX)}" y="${num(fonts.badgeY)}" fill="${accent}" font-size="${num(fonts.badge)}" font-weight="650"><title>${escape2(node.badgeText)}</title>${node.badgeLines.map((line) => `<tspan x="${num(fonts.badgeX)}" dy="0">${escape2(line)}</tspan>`).join("")}</text>` : "";
    return `<g class="arch-node" ${attrs} tabindex="0" role="group" aria-label="${escape2(`${node.title}, ${node.type}`)}">${title}
    <g filter="url(#${prefix}-shadow)">${shape}</g>${extras}
    ${node.showIcon !== false ? `<rect x="${num(iconBox.x)}" y="${num(iconBox.y)}" width="27" height="27" rx="7" fill="${accent}" opacity=".1"/>` : ""}
    <g color="${accent}">${nodeIcon}</g>
    ${badge}
    ${node.titleLines.length ? linesMarkup(node.titleLines, 20, fonts.titleY, fonts.title, palette.text, 650, fonts.titleLeading) : ""}
    ${node.descLines.length ? linesMarkup(node.descLines, 20, fonts.descriptionY, fonts.description, palette.muted, 400, fonts.descriptionLeading) : ""}
    ${node.technologyLines.length ? linesMarkup(node.technologyLines, 20, fonts.technologyY, fonts.technology, accent, 500, fonts.technologyLeading) : ""}
  </g>`;
  }
  function toSVG(graph, options = {}) {
    const theme = options.theme ?? graph.view.theme;
    if (!["light", "dark"].includes(theme)) throw new ArchError("theme must be light or dark");
    const prefix = options.idPrefix ?? `arch-${++serial}`;
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) throw new ArchError("Invalid idPrefix");
    if (graph.kind === "meta") return metaSVG(graph, { theme, idPrefix: prefix });
    if (graph.view.diagram && graph.view.diagram.type !== "connected") return toDiagramSVG(graph, { theme, idPrefix: prefix });
    const palette = theme === "dark" ? { dark: true, bg: "#111827", card: "#1e293b", package: "#162032", border: "#3b4960", text: "#f1f5f9", muted: "#a4b2c7", edge: "#9caac0" } : { bg: "#fafbfe", card: "#ffffff", package: "#f0f3fa", border: "#d8dfec", text: "#1e293b", muted: "#738198", edge: "#94a3b8" };
    const b = graph.bounds;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node])), backdrops = /* @__PURE__ */ new Map();
    const backdropFor = (node) => {
      if (backdrops.has(node.id)) return backdrops.get(node.id);
      const parent = nodeById.get(node.parent);
      const color = parent ? composite(parent.backgroundColor ?? palette.package, backdropFor(parent), parent.opacity ?? (parent.backgroundColor ? 0.2 : 1)) : palette.bg;
      backdrops.set(node.id, color);
      return color;
    };
    const definitions = `<defs>
    <filter id="${prefix}-shadow" x="-15%" y="-15%" width="130%" height="145%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity=".045"/></filter>
    <marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 8 4-8 4" fill="none" stroke="${palette.edge}" stroke-width="1.5"/></marker>
    <marker id="${prefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 11 6 1 11Z" fill="${palette.bg}" stroke="${palette.edge}"/></marker>
    <marker id="${prefix}-diamond" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="10" markerHeight="8" orient="auto"><path d="m1 5 6-4 6 4-6 4Z" fill="${palette.edge}"/></marker>
  </defs>`;
    const edgePaths = graph.edges.map((edge) => {
      const dash = ["dependency", "realization"].includes(edge.style) ? ' stroke-dasharray="6 5"' : "";
      const start = edge.style === "composition" ? ` marker-start="url(#${prefix}-diamond)"` : "";
      const end = ["association", "composition"].includes(edge.style) ? "" : ` marker-end="url(#${prefix}-${["realization", "generalization"].includes(edge.style) ? "triangle" : "arrow"})"`;
      return `<g class="arch-edge" data-edge="${escape2(edge.id)}" data-type="${escape2(edge.type)}" data-style="${edge.style}"><title>${escape2(edge.labelText || edge.title || edge.type)}</title><path d="${escape2(edge.d)}" fill="none" stroke="${palette.edge}" stroke-width="1.5" stroke-linejoin="round"${dash}${start}${end}/></g>`;
    }).join("");
    const edgeLabels = graph.edges.filter((e) => e.labelLines.length || e.labelIcon).map((edge) => {
      const { x, y } = edge.label, offset = edge.labelTextOffset ?? { x: 0, y: 0 };
      let icon = "";
      if (edge.labelIcon) {
        const box = edge.labelIconBox, shape = getIcon(edge.labelIcon, edge.labelIconLoc), scale = box.size / Math.max(shape.width, shape.height);
        const ix = x + box.x + (box.size - shape.width * scale) / 2, iy = y + box.y + (box.size - shape.height * scale) / 2;
        icon = `<g class="arch-edge-label-icon" aria-hidden="true" color="${palette.muted}">${iconMarkup(edge.labelIcon, ix, iy, box.size, edge.labelIconLoc, `${prefix}-edge-${edge.id}-icon`)}</g>`;
      }
      const position = edge.labelIcon ? ` data-icon-position="${edge.labelIconPosition}" aria-label="${escape2(edge.labelText || edge.title || edge.type)}"` : "";
      const text = edge.labelLines.length ? linesMarkup(edge.labelLines, x + offset.x, y + offset.y - (edge.labelLines.length - 1) * 7.5 + 3.5, 11, palette.muted, 450, 15, "middle") : "";
      return `<g class="arch-edge-label" data-label-for="${escape2(edge.id)}"${position}><rect x="${num(x - edge.labelWidth / 2)}" y="${num(y - edge.labelHeight / 2)}" width="${num(edge.labelWidth)}" height="${num(edge.labelHeight)}" rx="5" fill="${palette.bg}" stroke="${palette.border}" stroke-width=".6"/>${icon}${text}</g>`;
    }).join("");
    const referenceConnectors = (graph.referenceNodes ?? []).map((occurrence) => {
      const d = occurrence.d ?? occurrence.points.map((p, i) => `${i ? "L" : "M"} ${num(p.x)} ${num(p.y)}`).join(" ");
      return `<path class="arch-reference-connector" data-reference-for="${escape2(occurrence.edgeId)}" data-reference-node="${escape2(occurrence.nodeId)}" d="${escape2(d)}" fill="none" stroke="${palette.edge}" stroke-width="1.5" stroke-linejoin="round" marker-end="url(#${prefix}-arrow)"/>`;
    }).join("");
    const renderedCards = /* @__PURE__ */ new Set();
    const referenceCards = (graph.referenceNodes ?? []).filter((occurrence) => {
      if (occurrence.explicit || renderedCards.has(occurrence.node)) return false;
      renderedCards.add(occurrence.node);
      return true;
    }).map((occurrence, index) => {
      const card = occurrence.node, identity = card.referenceIdentityLines ?? [];
      const footer = identity.length ? `<g data-reference-id="${escape2(occurrence.nodeId)}"><rect x="${num(card.x)}" y="${num(card.y + card.referenceContentHeight)}" width="${num(card.width)}" height="${num(card.height - card.referenceContentHeight)}" rx="4" fill="${palette.bg}" stroke="${palette.border}"/>${linesMarkup(identity, card.x + 10, card.y + card.referenceContentHeight + 16, 11, palette.text, 500, 16)}</g>` : "";
      return `<g class="arch-edge-reference" data-reference-for="${escape2(occurrence.edgeIds.join(" "))}" data-reference-node="${escape2(occurrence.nodeId)}" data-reference-attribute="${escape2(occurrence.attribute)}">${nodeMarkup({ ...card, height: card.referenceContentHeight ?? card.height }, palette, prefix, palette.bg, `${prefix}-reference-${index}`)}${footer}</g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-diagram" data-arch-svg="${theme}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" viewBox="${num(b.x)} ${num(b.y)} ${num(b.width)} ${num(b.height)}" width="${num(b.width)}" height="${num(b.height)}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:${palette.bg};color:${palette.text}">
    <title id="${prefix}-title">${escape2(graph.title)} — ${escape2(graph.view.title)}</title>
    <desc id="${prefix}-desc">${escape2(graph.description || `${graph.nodes.length} architecture elements, ${graph.edges.length} relationships`)}</desc>
    ${definitions}<style>#${prefix}-diagram .arch-node{outline:none}#${prefix}-diagram .arch-node:focus>g:first-of-type{filter:none}#${prefix}-diagram .arch-node:focus{outline:2px solid #818cf8;outline-offset:5px;border-radius:12px}</style>
    <rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" fill="${palette.bg}"/>
    ${graph.nodes.filter((n) => n.container).map((n) => nodeMarkup(n, palette, prefix, backdropFor(n))).join("")}
    ${edgePaths}${referenceConnectors}${graph.nodes.filter((n) => !n.container && !n.referenceOnly).map((n) => nodeMarkup(n, palette, prefix, backdropFor(n))).join("")}${referenceCards}${edgeLabels}
  </svg>`;
  }

  // src/multi-view.js
  function stackViews(model, layouts) {
    const padding = 24, gap = 24, width = Math.max(...layouts.map((graph) => graph.bounds.width));
    let y = padding;
    const sections = layouts.map((graph) => {
      const lines = wrap(graph.view.title.trim() || graph.view.id, Math.max(40, width - 24), 16);
      const headingHeight = Math.max(1, lines.length) * 22 + 12;
      const section = { graph, x: padding, y, titleLines: lines, headingHeight };
      y += headingHeight + graph.bounds.height + gap;
      return section;
    });
    const unique = (key) => [...new Map(layouts.flatMap((graph) => graph[key]).map((item) => [item.id, item])).values()];
    return {
      kind: "views",
      title: model.title,
      description: model.description,
      profile: layouts[0].profile,
      view: layouts[0].view,
      layouts,
      sections,
      nodes: unique("nodes"),
      edges: unique("edges"),
      bounds: { x: 0, y: 0, width: width + 2 * padding, height: y - gap + padding }
    };
  }
  var serial2 = 0;
  function viewsSVG(graph, options = {}) {
    const prefix = options.idPrefix ?? `arch-views-${++serial2}`;
    if (typeof prefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) throw new ArchError("Invalid idPrefix");
    const theme = options.theme ?? graph.view.theme, bg = theme === "dark" ? "#111827" : "#fafbfe";
    const b = graph.bounds;
    const sections = graph.sections.map((section, index) => {
      const { graph: child2, x, y, titleLines, headingHeight } = section;
      const childTheme = options.theme ?? child2.view.theme, dark = childTheme === "dark";
      const childSVG = toSVG(child2, { ...options, idPrefix: `${prefix}-view-${index + 1}` }).replace(/^<svg\b/, `<svg x="${num(x)}" y="${num(y + headingHeight)}" data-view-id="${escape2(child2.view.id)}"`);
      const heading = titleLines.map((line, row) => `<tspan x="${num(x + 12)}" dy="${row ? 22 : 0}">${escape2(line)}</tspan>`).join("");
      return `<g data-arch-view="${escape2(child2.view.id)}"><rect x="${num(x)}" y="${num(y)}" width="${num(b.width - 48)}" height="${num(headingHeight + child2.bounds.height)}" fill="${dark ? "#111827" : "#fafbfe"}"/><text x="${num(x + 12)}" y="${num(y + 21)}" font-size="16" font-weight="650" fill="${dark ? "#e2e8f0" : "#334155"}">${heading}</text>${childSVG}</g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-diagram" data-arch-svg="${theme}" data-arch-views="${graph.layouts.length}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" viewBox="0 0 ${num(b.width)} ${num(b.height)}" width="${num(b.width)}" height="${num(b.height)}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:${bg}"><title id="${prefix}-title">${escape2(graph.title)}</title><desc id="${prefix}-desc">${escape2(graph.description || `${graph.layouts.length} selected architecture views`)}</desc><rect width="${num(b.width)}" height="${num(b.height)}" fill="${bg}"/>${sections}</svg>`;
  }

  // src/help.js
  var fail7 = (message) => {
    throw new ArchError(message, {}, "ARCH_HELP");
  };
  var list = (values) => values?.length ? values.join(", ") : "(none)";
  var pageSize = 100;
  function parseHelp(source, options = {}) {
    return { ...helpDocument(parseHelpCommand(source)), profile: resolveProfile({}, options) };
  }
  function profileFor(model, options, id) {
    const profile = resolveProfile(model, options);
    return id && id !== "." ? getProfile(id) : profile;
  }
  function helpContent(model, options = {}) {
    if (!model || model.kind !== "help" || !model.help || typeof model.help.topic !== "string" || !Array.isArray(model.help.parameters)) fail7('Invalid help document; use parse("@help").');
    const { topic, parameters: args } = request(model.help?.topic, model.help?.parameters);
    const profile = profileFor(model, options), sections = [];
    const section = (title, ...lines) => sections.push({ title, lines: lines.flat() });
    const selectProfile = () => profileFor(model, options, args[0]);
    const definitions = (key, label) => {
      const p = selectProfile(), entries = Object.entries(p[key]);
      const target = args[0] || ".";
      section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, `Without PROFILE, use the selected document/API profile (default: default). ${entries.length} ${label}.`);
      if (args[1]) {
        const rule = p[key][args[1]];
        if (!Object.hasOwn(p[key], args[1])) fail7(`Unknown name in ${label}: ${args[1]}. Use @help ${topic} ${target}.`);
        if (key === "nodeTypes") section("Allowed relationships", `@help connections ${target} ${args[1]}`);
        if (key !== "viewpoints" && rule.abstract) {
          const candidates = concreteSubtypes(args[1], p[key]);
          section("Concrete subtypes", candidates.length ? candidates.map((name) => key === "nodeTypes" ? `${name} ID "Title"  · template ${p[key][name].template}` : `relation ID SOURCE -> TARGET "Label" { type ${name} }`) : ["No concrete subtypes are defined in this profile."]);
          section("Candidate details", `@help ${topic} ${target} NAME`, "These candidates are concrete descendants. Attribute, container, endpoint and viewpoint rules still apply.");
        }
        section(args[1], JSON.stringify(rule, null, 2).split("\n"));
        if (key !== "viewpoints") section("Built-in attributes", key === "nodeTypes" ? list(NODE_PROPERTIES) : list(EDGE_PROPERTIES), "Additional attributes and constraints are listed above under attributes.");
      } else {
        section(label, entries.length ? entries.map(([name, rule]) => key === "nodeTypes" ? `${name}${rule.abstract ? " [abstract]" : ""} · template ${rule.template}${rule.container ? " · container" : ""}` : key === "relationTypes" ? `${name}${rule.abstract ? " [abstract]" : ""} · style ${rule.style}` : `${name}${rule.title ? ` · ${rule.title}` : ""}`) : ["(none)"]);
        section("Show details", `@help ${topic} ${target} NAME`, "Use . as PROFILE to inspect the selected document/API profile, including inline definitions.", "Abstract types support inheritance and cannot be instantiated directly.");
        if (key === "relationTypes") section("Filter by node type", `@help connections ${target} NODE_TYPE`);
      }
    };
    if (!topic) {
      section(
        "Getting started",
        "Write one help command in an arch code block, either on its own or on a separate line inside architecture.",
        "Inside architecture, help replaces the diagram output. The model block is optional in help mode.",
        "Square brackets in this reference indicate optional parameters. Names are case-sensitive.",
        `Selected profile: ${profile.id} · ${profile.version}`
      );
      section("Topics", Object.entries(topics).map(([key, [description]]) => `${syntax(key)}  —  ${description}`));
      section("Examples", "@help iconpacks", "@help iconpacks core", "@help profiles", "@help types default service", "@help connections default service", "@help diagrams sequence");
    } else if (topic === "meta") {
      section(
        "Architecture source views",
        'Add view source "Architecture as JSON" { @meta json } or use @meta dsl.',
        'Equivalent JSON view: { "name": "Architecture as JSON", "@meta": "json" }. The meta keyword/field is also accepted.',
        "With config { views all }, diagram and source views render together in one SVG, in the selected order.",
        "An architecture-level @meta json or @meta dsl adds a selectable view named meta-json or meta-dsl.",
        "Source views show the entire normalized architecture, including their own directives exactly once. No recursive rendering.",
        "Only format and theme apply. Filters, viewpoints, diagram settings and node/route styles do not apply.",
        "Model rules and other views are still validated. Meta views do not require domain viewpoints.",
        "@meta requires architecture source; a context-free standalone @meta command cannot translate an absent model."
      );
      section(
        "Meta view",
        "In the editor View menu, choose Meta view · JSON for DSL input or Meta view · DSL for JSON input.",
        "The translation updates while editing. Copy or download the translated source; SVG export is available in diagram views.",
        "Syntax errors show a source excerpt, original line/column, JSON pointer where available, and correction candidates.",
        "Use the line button to focus the source editor at the error. Corrections are suggestions and are never applied automatically.",
        "Syntactically readable models still show their translation when profile rules fail. Abstract-type candidates come from the selected profile."
      );
      section(
        "JavaScript API",
        'arch.translate(source, { format: "json" | "dsl" }) → source string',
        "format defaults to the other source notation. Translation checks syntax and structure, not profile completeness.",
        "arch.inspectSource(source, { profile, format }) → { sourceFormat, targetFormat, output, valid, diagnostics, ... }",
        "diagnostics[].candidates → { label, example, detail }[]; source line/column and path are retained.",
        "output is null for untranslatable syntax. Semantic issues can coexist with a translated output.",
        "Inspection validates the model but does not perform an SVG render; icon/path rendering errors can still occur later."
      );
      section(
        "Boundaries",
        "Conversion normalizes formatting and explicit defaults. Comments and original whitespace are not retained.",
        "Nested nodes, routes, reference connectors, profiles and all diagram settings retain their meaning.",
        "Unknown words are ranked by spelling; concrete candidates use the profile. Every proposed correction still requires review.",
        "The editor-only Meta view option is separate from declared @meta views. Only declared source views are included by config.views all."
      );
    } else if (topic === "json") {
      section(
        "Equivalent JSON input",
        "Use a JSON string or an object with an architecture wrapper in parse, validate, layout, render or renderToString.",
        "The same profiles, model rules, views, layout and SVG renderers apply. JSON is a source format, not the internal parsed model.",
        "Use an arch Markdown fence or data-arch for JSON diagrams. Ordinary json fences remain code."
      );
      section(
        "Complete example",
        '{ "architecture": {',
        '  "name": "Portal",',
        '  "config": { "views": "all" },',
        '  "model": {',
        '    "elements": {',
        '      "user": { "type": "person", "name": "User" },',
        '      "api": { "type": "service", "name": "API" }',
        "    },",
        '    "relations": { "calls": { "from": "user", "to": "api", "name": "Calls" } }',
        "  },",
        '  "views": { "overview": { "name": "Overview", "routes": { "curve": "straight" } } }',
        "} }"
      );
      section(
        "Mapping",
        "Architecture, element, relationship and view titles use name. Object keys are IDs.",
        "elements, relations and views may alternatively be arrays with an id in each entry; arrays define explicit order.",
        "Packages nest elements and relations inside the container element. All identifiers and model limits remain unchanged.",
        "Model properties such as description, technology and conveyed are direct fields. An attributes object handles custom names that collide with JSON structure.",
        "place: { ID: { at: [x,y], size: [width,height] } }; style: { ID: { ... } }.",
        "routes: { ... } defines shared defaults; route: { RELATION_ID: { ... } } overrides individual fields.",
        'Reference route key: "ELEMENT_ID -> RELATION_ID". via is [[x,y],[x,y]], label is [x,y] or "none".',
        'diagram: { type: "sequence", participants: ["user","api"] }; include/exclude use ID arrays.',
        "Inline config uses type, relation, viewpoint, styleGroup and attribute objects keyed by name, matching DSL keywords.",
        'Help: { "@help": "json" } or architecture-level "@help": "profiles". A help query omits the @help prefix.'
      );
      section(
        "Diagnostics and boundaries",
        "Strict JSON: no comments, trailing commas, duplicate keys, null attribute values or executable values.",
        "JSON errors report a JSON pointer and source line/column. Object input locations refer to its compact JSON serialization.",
        "Field order follows the input; use arrays or config.views for explicit view order. Unknown settings are errors.",
        "Source JSON and parsed model JSON are different shapes. Use @help meta for translation, source downloads and correction candidates."
      );
    } else if (topic === "syntax") {
      section(
        "Basic rules",
        'A diagram document contains architecture "Title" { ... } with exactly one model block.',
        "Identifiers: [A-Za-z_][A-Za-z0-9_.-]*. Use double-quoted text with JSON escapes.",
        "Comments start with # or //. Whitespace and semicolons separate statements.",
        'Attribute value lists: ["A", "B"]. Include/exclude and routing lists: a, b.'
      );
      section("Complete starter example (default profile)", 'architecture "Portal" {', "  model {", '    person user "User"', '    application app "Portal"', '    relation uses user -> app "Uses" { type flow }', "  }", '  view overview "Overview" { direction right theme light }', "}");
      section("Learn more", "@help model", "@help views", "@help config", "@help json");
    } else if (topic === "model") {
      section(
        "Elements and relationships",
        'TYPE ID "Title" { ATTRIBUTE VALUE ... }',
        'relation ID SOURCE -> TARGET "Label" { type RELATION ... }',
        `Selected profile: ${profile.id}. Node types: @help types. Relationship types: @help relations.`,
        `Default relationship type: ${profile.defaultRelation ?? "(none; set type explicitly)"}`
      );
      section(
        "Built-in attributes",
        `Nodes: ${list(NODE_PROPERTIES)}`,
        `Relationships: ${list(EDGE_PROPERTIES)}; also type to select the relationship type.`,
        "Built-in attributes are scalar strings; additional attributes must be defined in the profile.",
        "stereotype is a label; TYPE determines the semantic type.",
        "icon uses PACK.NAME, for example core.service. tags is a string."
      );
      section("Carried information", "Profiles can configure relationship referenceLabels, for example conveyed → Conveys.", "Connected views support referenceDisplay labels | nodes | both. referenceOccurrences shared (default) reuses one card across edges; perEdge repeats cards with visible element IDs. Graphical cards point to the carrying edge and reuse the original node styles; these connectors are visual annotations, not model relationships.");
      section("Containers", 'package platform "Platform" { service api "API" }', "Only container types in the selected profile support nesting.", "IDs are document-wide. Relationships reference element IDs.");
    } else if (topic === "profiles") {
      if (!args.length) section("Registered profiles", getProfiles().map((id) => {
        const p = getProfile(id);
        return `${id} · ${p.version} · ${Object.keys(p.nodeTypes).length} node types · ${Object.keys(p.relationTypes).length} relationship types · ${Object.keys(p.viewpoints).length} viewpoints`;
      }));
      else {
        const p = getProfile(args[0]);
        section(
          p.title,
          `ID: ${p.id}`,
          `Version: ${p.version}`,
          `Default relationship type: ${p.defaultRelation ?? "(none)"}`,
          `Viewpoint required: ${p.requireViewpoint ? "yes" : "no"}`,
          `Node types: ${Object.keys(p.nodeTypes).length}; relationship types: ${Object.keys(p.relationTypes).length}; viewpoints: ${Object.keys(p.viewpoints).length}.`
        );
        if (p.description) section("Scope", p.description);
        if (p.sources?.length) section("Sources", p.sources);
        if (p.limitations?.length) section("Limits of validation", p.limitations);
        section("Contents and rules", `@help types ${p.id}`, `@help relations ${p.id}`, `@help viewpoints ${p.id}`);
        section("Style groups", Object.entries(p.styleGroups).map(([name, rule]) => `${name}: ${rule.backgroundColor ?? "(neutral)"}`));
      }
      section(
        "Selection and registration",
        "config { profile PROFILE }  // inside architecture",
        "API options.profile takes precedence over the document profile.",
        "Help lists registered profiles; it does not load files.",
        "@help config"
      );
    } else if (topic === "types") definitions("nodeTypes", "node types");
    else if (topic === "relations") definitions("relationTypes", "relationship types");
    else if (topic === "viewpoints") definitions("viewpoints", "viewpoints");
    else if (topic === "connections") {
      const p = selectProfile(), target = args[0] || ".";
      section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, "Use . as PROFILE for the selected document/API profile, including inline definitions.");
      if (!args[1]) section("Choose a node type", `@help connections ${target} NODE_TYPE`, `Available node types: ${list(Object.keys(p.nodeTypes).sort())}`);
      else {
        if (!Object.hasOwn(p.nodeTypes, args[1])) fail7(`Unknown node type: ${args[1]}. Use @help types ${target}.`);
        const connections = typeConnections(args[1], p);
        section(
          "Selected node type",
          `${connections.type}${connections.abstract ? " [abstract; choose a concrete subtype to instantiate]" : ""}`,
          "The lists include concrete relationship types and concrete counterpart node types, accounting for inheritance and pair exclusions."
        );
        section(
          "Relationship overview",
          `Outgoing: ${list(connections.outgoing.map((item) => item.type))}`,
          `Incoming: ${list(connections.incoming.map((item) => item.type))}`
        );
        for (const direction of ["outgoing", "incoming"]) {
          const lines = connections[direction].flatMap((item) => [
            direction === "outgoing" ? `${item.type}: ${connections.type} -> ${list(item.counterparts)}` : `${item.type}: ${list(item.counterparts)} -> ${connections.type}`,
            `  allowSelf: ${item.allowSelf}; acyclic: ${item.acyclic}; details: @help relations ${target} ${item.type}`
          ]);
          section(direction === "outgoing" ? "Outgoing relationships (this type is the source)" : "Incoming relationships (this type is the target)", lines.length ? lines : ["(none)"]);
        }
        section(
          "Model example",
          'relation LINK_ID SOURCE_ID -> TARGET_ID "Label" { type RELATION_TYPE }',
          "These lists describe endpoint type compatibility. Required attributes, self-links, cardinalities, cycles, containers and viewpoint rules still apply.",
          "An abstract selected type shows its inherited compatibility; query a concrete subtype for its exact rules.",
          `@help types ${target} ${connections.type}`
        );
      }
    } else if (topic === "iconpacks") {
      const names2 = getIconPacks();
      if (!args.length) section("Registered icon packs", names2.map((name) => `${name} · ${getIconNames(name).length} icons and aliases`));
      else {
        const [name, filter = "*", page = "1"] = args;
        if (!names2.includes(name)) fail7(`Unknown icon pack: ${name}. Registered: ${list(names2)}.`);
        if (!/^[1-9][0-9]*$/.test(page) || !Number.isSafeInteger(Number(page))) fail7("PAGE must be a positive integer.");
        const icons = getIconNames(name).filter((id) => filter === "*" || id.toLowerCase().includes(filter.toLowerCase()));
        const pages = Math.max(1, Math.ceil(icons.length / pageSize)), current = Number(page);
        if (current > pages) fail7(`Page ${page} does not exist. Valid range: 1–${pages}.`);
        section(`Icon pack ${name}`, `${icons.length} matches · Filter: ${filter} · Page ${current}/${pages} · up to ${pageSize} names per page.`);
        section("Valid icon references", icons.length ? icons.slice((current - 1) * pageSize, current * pageSize).map((id) => `${name}.${id}`) : ["(no matches)"]);
        if (current < pages) section("Next page", `@help iconpacks ${name} ${JSON.stringify(filter)} ${current + 1}`);
      }
      section(
        "Usage and search",
        "icon core.service  // in the model or a view style",
        "@help iconpacks PACK",
        "@help iconpacks PACK FILTER",
        '@help iconpacks PACK "*" 2',
        "FILTER performs a case-insensitive substring search. * lists all names.",
        "Only successfully registered packs are listed. Help does not download packs or access the preview configuration."
      );
    } else if (topic === "diagrams") {
      const selected2 = args.length ? [args[0]] : DIAGRAMS;
      if (selected2.some((type) => !DIAGRAMS.includes(type))) fail7(`Unknown diagram type. Valid types: ${list(DIAGRAMS)}.`);
      const notes = {
        connected: ["Default renderer. Use place, style and route to control the presentation."],
        sequence: ["participants/messages: ordered lists of node/edge IDs.", "asyncMessages/returns: subsets of messages; a message cannot be both async and return."],
        state: ["initial: node ID; finals: list of node IDs. Initial has no incoming edges; finals have no outgoing edges."],
        activity: ["lanes: list of node IDs; laneAttribute: assignment attribute (default owner).", "decisions/forks require at least two outgoing edges; joins require at least two incoming edges."],
        matrix: ["rows/columns: lists of node IDs (at most 100 each); relations: relationship types.", "Without a selection, uses all visible elements/relationships. Cells count directed relationships."],
        heatmap: ["valueAttribute is required; numeric values between min and max (defaults 0 and 5).", "parentAttribute is optional; otherwise uses the model hierarchy. colorLow/colorHigh: hex or CSS3 name."],
        timeline: ["startAttribute/endAttribute: attribute names (defaults start/end).", "Both ISO date values are required; start must not be after end."],
        class: ["attributes/methods/functions/interfaces/ports/parameters: lists of element IDs.", "ownerAttribute/signatureAttribute: attribute names (defaults owner/signature).", "Parameters belong to methods/functions; other details belong to classes.", "propertyFields [FIELD, FIELD]: display actual attribute values/reference IDs on each class card; different from member element IDs."]
      };
      for (const type of selected2) section(type, `diagram ${type}${DIAGRAM_OPTIONS[type].length ? " { ... }" : ""}`, `Valid options: ${list(DIAGRAM_OPTIONS[type])}`, notes[type]);
      section("Lists and layout", "Diagram lists use square brackets: participants [user, app].", "All referenced elements must be visible.", "place and route apply only to connected; style is also available in other diagrams.");
    } else if (topic === "views") {
      section(
        "View",
        'view ID "Title" { ... }',
        "direction right | down  (default right)",
        "theme light | dark  (default light)",
        "spacing NUMBER  (24–400; default 80)",
        "include ID, ID  // without include: all elements",
        "exclude ID, ID  // exclusions always win, including descendants",
        "viewpoint NAME  // from the selected profile",
        "referenceDisplay labels | nodes | both  // connected only; otherwise uses profile setting",
        "referenceOccurrences shared | perEdge  // graphical references; default shared",
        "routes { curve straight }  // defaults for all connected routes; individual route properties win",
        "diagram TYPE { ... }  // default connected"
      );
      section("Rendered views", "config { views all }  // all views in declaration order", "config { views [detail, overview] }  // selected IDs in this order", "config { views overview }  // one view", "Without a selection, the first view is rendered. Multiple views are stacked with headings inside one standalone SVG.", "API precedence: options.view, then options.views, then config.views, then the first view. The preview dropdown offers Configured views and individual views.");
      section("Selection", "Including a container includes its descendants. Required ancestor containers are added automatically.", "Edges appear only when both endpoints are visible.", "Without a view block, the default view is created automatically.", "@help routing", "@help styles", "@help diagrams");
    } else if (topic === "routing") {
      section("Position and size (connected only)", "place ID at (X, Y)", "place ID at (X, Y) size (WIDTH, HEIGHT)", "Coordinates: ±10000000; minimum size (160, 96). Positions inside containers are relative to their content.");
      section(
        "Routing defaults (connected only)",
        "routes {",
        "  curve straight",
        "  from auto",
        "}",
        "Defaults apply to every relationship and reference connector in this view, including routes without an individual block. Specific route properties override matching defaults, regardless of declaration order. Other defaults remain inherited.",
        "Available fields: from, to, via, curve, label, path, icon, iconPosition, showIcon, showLabel. A target port/point in to applies to relationships; a fraction from 0 to 1 applies to reference connectors. label, icon, iconPosition, showIcon and showLabel apply only to relationship labels.",
        "Specific from/to/via/curve settings replace an inherited free path; an explicit path still controls the complete route. Empty routes {} keeps the existing automatic routing."
      );
      section(
        "Edge routing (connected only)",
        "route EDGE_ID {",
        "  from right",
        "  to left",
        "  via (270, 100), (270, 180)",
        "  curve rounded",
        "  label (300, 140)",
        "}",
        "from/to: auto | top | right | bottom | left, or an absolute point (X, Y).",
        "curve: orthogonal | straight | rounded | bezier. With via, bezier requires exactly two control points.",
        'path "M 0 0 L 100 100" replaces the calculated path; label (X, Y) positions the edge label; label none hides its text, frame and icon.'
      );
      section("Independent label fields", "routes { icon core.cloud showIcon true showLabel false }", "route EDGE_ID { showIcon false showLabel true }", "showIcon and showLabel are booleans (default true). showLabel controls visible text; showIcon controls the configured icon. Both false removes the label frame. label none hides the entire label regardless of these switches.");
      section("Hide relationship labels", "routes { label none }", "route EDGE_ID { label none }", "A local label (X, Y) overrides a global label none and shows the label again, including any inherited icon. Hidden labels occupy no layout space; relationship titles and references remain in the model and edge tooltip.");
      section(
        "Icons on relationship labels",
        "routes { icon core.cloud iconPosition left }",
        "route EDGE_ID { icon core.shield iconPosition top }",
        "icon: PACK.NAME from a registered pack, or none to disable an inherited icon. iconPosition: top | left | bottom | right (default left).",
        "Icons appear inside the label frame relative to its text. Layout reserves space for the icon, multiline text and export bounds. An icon also works without label text.",
        "Local route settings override view defaults per property. Label icons do not apply to reference connectors or change node icon positions."
      );
      section(
        "Reference connector routing (connected only)",
        "route NODE_ID -> EDGE_ID {",
        "  from bottom",
        "  to 0.5",
        "  via (400, -80), (400, 100)",
        "  curve rounded",
        "}",
        "NODE_ID must be a graphical reference of EDGE_ID, configured by the profile referenceLabels. Works with shared and perEdge cards.",
        "from: a card port (auto, top, right, bottom, left) or an absolute point. to: fraction from 0 (relationship source) to 1 (target), measured along the rendered relationship path. Default: automatic attachment position.",
        "via and curve work like ordinary edge routes. Manual routes replace automatic obstacle avoidance. Coordinates are absolute, including inside containers.",
        'path "M 0 0 L 100 100" overrides the whole connector, including its endpoints. No connector label is supported.',
        "Hidden references, hidden carrying relationships and labels-only presentation do not draw connectors; their stored routes remain available."
      );
    } else if (topic === "styles") {
      section(
        "View style",
        "style NODE_ID {",
        "  template component",
        "  icon core.service",
        "  accent SlateBlue",
        "  backgroundColor Gold",
        "  opacity 0.45",
        "}",
        "Valid fields: template, icon, iconPosition, accent, backgroundColor, opacity, display, fontSize, width, height, showIcon, showLabel, showStereotype, showDescription, showTechnology.",
        "fontSize: title size from 6 to 64 (default 15); other node texts scale proportionally. width/height: minimum dimensions (at least 160/96). These overrides require a connected view and take precedence over place size; content may increase height.",
        "The type/stereotype badge stays on one line with an ellipsis when needed; its tooltip keeps the complete text.",
        "display logo: connected view, non-container elements; show only a rectangle and an aspect-preserving icon. Centered by default; iconPosition aligns it inside the padded rectangle. display standard restores the usual card. Accessible title/type remain present.",
        "Containers use template package; other elements use a non-container template.",
        "opacity: number from 0 to 1, applied to fills only. Text, icons and borders remain opaque.",
        "Default: 0.2 with an explicit background, otherwise 1."
      );
      section("Node icon placement and visible fields", "style NODE_ID { iconPosition right showStereotype false showDescription false }", "iconPosition: top | left | bottom | right. Default: existing template placement; logo display stays centered unless a side is chosen. Package icons stay inside the header. Text and card/header sizes adapt to the placement.", "showIcon, showLabel, showStereotype, showDescription, showTechnology: true | false (default true). showLabel controls the node title. Hidden fields reserve no text space; model values and accessible tooltips remain present.", "Use standard display for independent text/icon visibility. Logo display still hides all text; showIcon false leaves its rectangle. These options require connected views and also apply to graphical reference cards.");
      section("Precedence", "View style overrides type presentation. Background: view, then type color, then style group, then theme.", "A model icon overrides the type icon; a view icon has the highest priority.", "Colors: hex (3/6 digits, quoted) or a CSS3 color name.", "@help colors", "@help templates");
    } else if (topic === "colors") {
      const filter = (args[0] ?? "").toLowerCase(), colors = Object.entries(CSS3_COLORS).sort(([a], [b]) => a.localeCompare(b)).filter(([name]) => name.includes(filter));
      section(
        "Colors",
        '147 CSS3 color names, case-insensitive. Alternatively use "#abc" or "#aabbcc".',
        "Valid for accent, backgroundColor and heatmap colorLow/colorHigh.",
        "Quote hex colors: an unquoted # starts a comment.",
        `${colors.length} matches${filter ? ` for ${filter}` : ""}.`
      );
      section("Name → Hex", colors.length ? colors.map(([name, hex]) => `${name}  ${hex}`) : ["(no matches)"]);
    } else if (topic === "templates") {
      section("Node templates", TEMPLATES);
      section("Edge styles", EDGE_STYLES);
      section("Semantic types", "Templates and edge styles control presentation. The profile defines the allowed model types.", "@help types", "@help relations");
    } else if (topic === "config") {
      section("Select a registered profile", 'architecture "Title" {', "  config { profile PROFILE }", "  model { ... }", "}", "options.profile overrides this selection. Register external profiles before rendering.");
      section("View selection", "config { views all }", "config { profile PROFILE views [overview, detail] }", "views accepts all, a view ID, or a nonempty unique list of IDs. Combine it with a registered or inline profile. Multiple selected views render below each other inside one SVG; view titles become headings.");
      section(
        "Custom inline profile",
        "config {",
        "  type actor { template person }",
        "  type product {",
        "    template application",
        "    attribute owner { type string required true }",
        "  }",
        "  relation uses { from actor to product style flow }",
        "  defaultRelation uses",
        "}",
        "Choose either config profile or an inline definition. Inline profiles are not registered globally."
      );
      section(
        "Inline rule fields",
        "Profile: id, title, version, extends, defaultRelation, requireViewpoint.",
        "type: extends, template, container, abstract, contains, icon, accent, backgroundColor, styleGroup, attribute/attributes.",
        "relation: extends, style, abstract, from, to, allowSelf, acyclic, incoming/outgoing { min ... max ... }, attribute/attributes.",
        "attribute: type, required, enum, min, max, minLength, maxLength, format, many, minItems, maxItems, uniqueItems, targets.",
        "Attribute types: string, number, integer, boolean, reference. Formats: date, date-time, uri.",
        "viewpoint: nodes, relations, requiredNodes, requiredRelations. styleGroup: backgroundColor.",
        "Multiple inheritance: extends A, B. Profile extends has exactly one registered parent.",
        "JSON profiles also support comparisons, pairs and connections. Details: @help types/relations/viewpoints PROFILE NAME."
      );
    } else if (topic === "api") {
      section(
        "Queries and rendering",
        'arch.help("types default service", options) → help text',
        "arch.parse(source, options) → architecture or help document",
        "arch.validate(sourceOrModel, options) → { valid, profile, diagnostics }",
        "arch.layout(sourceOrModel, options) → layout with bounds",
        "arch.renderToString(sourceOrModel, options) → SVG string",
        "arch.render(target, sourceOrModel, options) → SVG DOM element",
        "arch.renderAll({ root, selector, ...options }) → rendered SVG elements",
        "arch.renderMarkdown(markdown, options) → HTML with inline SVG"
      );
      section("Registration", "arch.registerProfile(name, definition)", "arch.getProfiles() → registered IDs", "arch.getProfile(name) → independent profile copy", "arch.registerIconPack(name, data)  // Iconify or converted paths", "arch.getIconPacks() → registered pack names", 'arch.renderIconToString("PACK.NAME", { size, title, idPrefix })');
      section("Options", "profile: registered profile ID or profile object; also applies to @help types/relations/viewpoints without an explicit ID.", "view: one view ID; views: all, a view ID or an array of IDs. Precedence: view > views > config.views > first view.", "theme: light | dark (overrides all selected views); idPrefix: unique SVG ID prefix. Multiple views return one SVG. layout returns kind views with layouts/sections and overall bounds; single-view layout stays unchanged.", "Help uses the help view. Registration does not load URLs. renderAll isolates errors per block.");
    }
    return { topic, profile, title: topic ? `Help · ${topic}` : "arch.js · Help", sections };
  }
  function help(query = "", options = {}) {
    if (typeof query !== "string") fail7("Help query must be a string.");
    const model = parseHelp(`@help${query ? ` ${query}` : ""}`, options), content = helpContent(model, options);
    return [content.title, ...content.sections.flatMap((s) => ["", s.title, ...s.lines])].join("\n");
  }
  function layoutHelp(model, options = {}) {
    const content = helpContent(model, options);
    if (options.view !== void 0 && options.view !== "help") fail7(`Unknown view: ${options.view}`);
    const rows = [];
    let y = 112;
    const clean2 = (text) => String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu, "�");
    for (const section of content.sections) {
      y += 24;
      for (const line of wrapLine(clean2(section.title), 78)) {
        rows.push({ kind: "heading", text: line, y });
        y += 25;
      }
      y += 6;
      for (const line of section.lines) for (const part of wrapLine(clean2(line), 104)) {
        rows.push({ kind: "body", text: part, y });
        y += 21;
      }
      y += 2;
    }
    return {
      ...content,
      kind: "help",
      nodes: [],
      edges: [],
      view: model.views?.[0] ?? { id: "help", theme: "light" },
      rows,
      bounds: { x: 0, y: 0, width: 960, height: y + 35 }
    };
  }
  function wrapLine(text, length) {
    const chars = [...text];
    if (!chars.length) return [""];
    const result = [];
    let start = 0;
    while (start < chars.length) {
      let end = start, cells2 = 0;
      while (end < chars.length && cells2 + (chars[end].codePointAt(0) > 255 ? 2 : 1) <= length) cells2 += chars[end++].codePointAt(0) > 255 ? 2 : 1;
      let cut = end;
      if (end < chars.length) {
        while (cut > start + (end - start) / 2 && !/\s/.test(chars[cut])) cut--;
        if (cut <= start + (end - start) / 2) cut = end;
      }
      result.push(chars.slice(start, cut).join(""));
      start = cut;
      if (chars[start] === " ") start++;
    }
    return result;
  }
  var serial3 = 0;
  function helpSVG(graph, options = {}) {
    const theme = options.theme ?? graph.view.theme;
    if (!["light", "dark"].includes(theme)) fail7("theme must be light or dark");
    const prefix = options.idPrefix ?? `arch-help-${++serial3}`;
    if (typeof prefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) fail7("Invalid idPrefix");
    const dark = theme === "dark", bg = dark ? "#111827" : "#fafbfe", card = dark ? "#1e293b" : "#ffffff", text = dark ? "#e2e8f0" : "#334155", muted = dark ? "#a4b2c7" : "#64748b", accent = dark ? "#a5b4fc" : "#4338ca";
    const { width, height } = graph.bounds;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" data-arch-svg="${theme}" data-arch-help="${escape2(graph.topic || "overview")}">
<title id="${prefix}-title">${escape2(graph.title)}</title><desc id="${prefix}-desc">arch.js language reference and registered extensions. Text can be selected and copied.</desc>
<rect width="${width}" height="${height}" rx="18" fill="${bg}"/>
<rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14" fill="${card}" stroke="${dark ? "#3b4960" : "#d8dfec"}"/>
<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" xml:space="preserve">
<text x="40" y="49" font-size="11" font-weight="700" letter-spacing="1.5" fill="${muted}">ARCH.JS / REFERENCE</text>
<text x="40" y="85" font-size="26" font-weight="700" fill="${accent}">${escape2(graph.title)}</text>
<path d="M40 104H920" stroke="${dark ? "#3b4960" : "#e2e8f0"}"/>
${graph.rows.map((row) => `<text x="40" y="${row.y}" style="white-space:pre" font-size="${row.kind === "heading" ? 17 : 13}" font-weight="${row.kind === "heading" ? 650 : 400}" fill="${row.kind === "heading" ? accent : text}">${escape2(row.text)}</text>`).join("\n")}
</g></svg>`;
  }

  // src/arch.js
  var version = "0.1.0";
  function layout2(model, options = {}) {
    if (typeof model === "string" || isJSONDocument(model)) model = parse(model, options);
    if (model?.kind === "help") return layoutHelp(model, options);
    const ids = selectedViewIds(model, options);
    const layouts = ids.map((view) => layout(model, { ...options, view }));
    return layouts.length === 1 ? layouts[0] : stackViews(model, layouts);
  }
  function validate2(sourceOrModel, options = {}) {
    let profile;
    try {
      const model = typeof sourceOrModel === "string" || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
      if (model?.kind !== "help") {
        const report = validate(model, options);
        profile = report.profile;
        if (report.valid) selectedViewIds(model, options);
        return report;
      }
      const content = helpContent(model, options);
      profile = content.profile;
      return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      return {
        valid: false,
        profile: profile ? { id: profile.id, version: profile.version } : null,
        diagnostics: [{ severity: "error", code: error.code, message: error.message, line: error.line, column: error.column, ...error.path !== void 0 ? { path: error.path } : {} }]
      };
    }
  }
  function renderToString(sourceOrModel, options = {}) {
    const model = typeof sourceOrModel === "string" || isJSONDocument(sourceOrModel) ? parse(sourceOrModel, options) : sourceOrModel;
    const graph = layout2(model, options);
    return graph.kind === "help" ? helpSVG(graph, options) : graph.kind === "views" ? viewsSVG(graph, options) : toSVG(graph, options);
  }
  function render(target, sourceOrModel, options = {}) {
    const element = typeof target === "string" ? globalThis.document?.querySelector(target) : target;
    if (!element || typeof element.replaceChildren !== "function") throw new ArchError("A valid DOM target element is required");
    const svg = renderToString(sourceOrModel, options);
    const template = element.ownerDocument.createElement("template");
    template.innerHTML = svg;
    element.replaceChildren(template.content.firstElementChild);
    return element.firstElementChild;
  }
  function renderAll(options = {}) {
    const { root = globalThis.document, selector = "pre > code.language-arch, [data-arch]", ...renderOptions } = options;
    if (!root?.querySelectorAll) throw new ArchError("A DOM root is required for renderAll");
    const results = [];
    for (const element of root.querySelectorAll(selector)) {
      const target = element.matches("pre > code") ? element.parentElement : element;
      if (!root.contains(element) || !target || target.dataset.archRendered) continue;
      const source = element.textContent;
      try {
        results.push(render(target, source, renderOptions));
      } catch (error) {
        const pre = target.ownerDocument.createElement("pre");
        pre.className = "arch-error";
        pre.setAttribute("role", "alert");
        pre.textContent = error.message;
        target.replaceChildren(pre);
      }
      target.dataset.archRendered = "true";
    }
    return results;
  }
  function renderMarkdown(markdown, options = {}) {
    if (typeof markdown !== "string") throw new ArchError("Markdown must be a string");
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const html = [], paragraph = [];
    const flush = () => {
      if (paragraph.length) html.push(`<p>${escape2(paragraph.splice(0).join(" "))}</p>`);
    };
    for (let i = 0; i < lines.length; i++) {
      const fence = lines[i].match(/^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/);
      if (fence) {
        flush();
        const body = [], opening = i, char = fence[1][0], length = fence[1].length;
        while (++i < lines.length && !new RegExp(`^\\s{0,3}${char}{${length},}\\s*$`).test(lines[i])) body.push(lines[i]);
        if (i >= lines.length) throw new ArchError("Unclosed Markdown code block", { line: opening + 1, column: 1 });
        if (fence[2] === "arch") html.push(`<figure class="arch-diagram">${renderToString(body.join("\n"), options)}</figure>`);
        else html.push(`<pre><code class="language-${escape2(fence[2])}">${escape2(body.join("\n"))}</code></pre>`);
      } else if (/^#{1,6} /.test(lines[i])) {
        flush();
        const heading = lines[i].match(/^(#{1,6}) (.*)$/);
        html.push(`<h${heading[1].length}>${escape2(heading[2])}</h${heading[1].length}>`);
      } else if (!lines[i].trim()) flush();
      else paragraph.push(lines[i]);
    }
    flush();
    return html.join("\n");
  }
  return __toCommonJS(arch_exports);
})();
