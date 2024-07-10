(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports);
    global.userScript = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  const {
    useState,
    useEffect
  } = React;
  const App = () => {
    const [count, setCount] = useState(0);
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-center h-screen bg-gradient-to-r from-blue-500 to-purple-500"
    }, /*#__PURE__*/React.createElement("h1", {
      className: "text-6xl font-bold text-black"
    }, "Hello World!"));
  };
  var _default = _exports.default = App;
});