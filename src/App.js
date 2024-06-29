import React, { useState, useEffect, useRef } from "react";
import { setupHyphaClients } from "./hypha-clients";
import { HyphaServer } from "./hypha-server";
import "./tailwind.css";

const App = () => {
  const containerRef = useRef(null);
  const [mainIframe, setMainIframe] = useState(null);
  const [sideIframes, setSideIframes] = useState([]);
  const [activeSideIframe, setActiveSideIframe] = useState(null);
  const [mainWidth, setMainWidth] = useState(50); // Percentage of the main window width
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const hyphaServer = new HyphaServer();
    hyphaServer.on("add_window", (config) => {
      const iframe = {
        src: config.src,
        id: config.window_id,
      };
      if (config.pos === "side") {
        setSideIframes((prev) => [...prev, iframe]);
        setActiveSideIframe(iframe.id);
      } else{
        setMainIframe(iframe);
      }
    });

    setupHyphaClients(hyphaServer);
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
    <div className="w-screen h-screen flex flex-col">
      <nav className="bg-gray-800 text-white flex items-center justify-between p-4">
        <div className="flex items-center">
          <img
            src="https://bioimage.io/static/img/bioimage-io-icon.svg"
            alt="BioImage.IO Logo"
            className="h-8 mr-2"
          />
          <span className="font-semibold text-xl tracking-tight">BioImage.IO Chatbot</span>
        </div>
        {sideIframes.length > 0 && (
          <div className="relative">
            <select
              className="appearance-none bg-gray-700 text-white py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-gray-600 focus:border-gray-500"
              onChange={(e) => setActiveSideIframe(e.target.value)}
              value={activeSideIframe}
            >
              {sideIframes.map((iframe) => (
                <option key={iframe.id} value={iframe.id}>
                  {iframe.id}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg
                className="fill-current h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M5.516 7.548l4.484 4.484 4.484-4.484-1.172-1.172-3.312 3.312-3.312-3.312z" />
              </svg>
            </div>
          </div>
        )}
      </nav>
      <div className="flex-grow flex" ref={containerRef}>
        {mainIframe && (
          <iframe
            src={mainIframe.src}
            className="h-full border-none"
            style={{ width: sideIframes.length > 0 ? `${mainWidth}%` : "100%" }}
            id={mainIframe.id}
          />
        )}
        {sideIframes.length > 0 && (
          <>
            <div
              className="w-1 bg-gray-400 cursor-col-resize"
              onMouseDown={handleMouseDown}
            />
            <div className="flex-grow relative h-full">
              {sideIframes.map((iframe) => (
                <iframe
                  key={iframe.id}
                  src={iframe.src}
                  className={`h-full w-full border-none ${iframe.id === activeSideIframe ? "block" : "hidden"}`}
                  id={iframe.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {isDragging && (
        <div
          className="fixed top-0 left-0 w-full h-full cursor-col-resize z-50"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      )}
    </div>
  );
};

export default App;
