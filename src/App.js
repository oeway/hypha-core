import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import { setupHyphaClients } from "./hypha";
import HyphaServer from "./hypha-server";

const App = () => {
  const containerRef = useRef(null);
  const [mainIframe, setMainIframe] = useState(null);
  const [sideIframes, setSideIframes] = useState([]);
  const [activeSideIframe, setActiveSideIframe] = useState(null);
  const [mainWidth, setMainWidth] = useState(50); // Percentage of the main window width
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const port = 8080;
    const hyphaServer = new HyphaServer(port);
    hyphaServer.start();

    hyphaServer.on("add_window", (config) => {
      const iframe = {
        src: config.src,
        id: config.window_id,
      };

      if (config.pos === "main") {
        setMainIframe(iframe);
      } else if (config.pos === "side") {
        setSideIframes((prev) => [...prev, iframe]);
        setActiveSideIframe(iframe.id);
      }
    });

    setupHyphaClients(hyphaServer.url);
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    document.onmousemove = handleMouseMove;
    document.onmouseup = handleMouseUp;
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    setMainWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.onmousemove = null;
    document.onmouseup = null;
  };

  return (
    <div className="container" style={{ width: "100vw", height: "100vh" }}>
      <div id="window-container" ref={containerRef} style={{ display: "flex", height: "100%", width: "100%" }}>
        {mainIframe && (
          <iframe
            src={mainIframe.src}
            style={{ width: sideIframes.length > 0 ? `${mainWidth}%` : "100%", height: "100%", border: "none" }}
            id={mainIframe.id}
          />
        )}
        {sideIframes.length > 0 && (
          <>
            <div
              style={{
                width: "5px",
                cursor: "col-resize",
                backgroundColor: "#ddd",
                zIndex: 1,
              }}
              onMouseDown={handleMouseDown}
            />
            <div style={{ width: `${100 - mainWidth}%`, height: "100%", position: "relative" }}>
              {sideIframes.map((iframe) => (
                <iframe
                  key={iframe.id}
                  src={iframe.src}
                  style={{
                    display: iframe.id === activeSideIframe ? "block" : "none",
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                  id={iframe.id}
                />
              ))}
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <select
                  onChange={(e) => setActiveSideIframe(e.target.value)}
                  value={activeSideIframe}
                >
                  {sideIframes.map((iframe) => (
                    <option key={iframe.id} value={iframe.id}>
                      {iframe.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
      {isDragging && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: "col-resize",
            zIndex: 2,
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      )}
    </div>
  );
};

export default App;
