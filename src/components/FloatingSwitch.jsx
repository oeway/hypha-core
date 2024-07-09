import React from "react";

export function FloatingSwitch({ mode, setMode }) {
    return (
        <div className="relative z-50 flex justify-center">
            <div className="absolute top-4 w-24 h-6">
                <div className="relative w-full h-full bg-gray-200 rounded-full shadow-inner"></div>
                <div className={`absolute top-0 left-0 w-1/2 h-full bg-blue-500 rounded-full shadow transition-transform duration-300 ${mode === "app" ? "transform translate-x-0" : "transform translate-x-full"}`}></div>
                <button
                    onClick={() => setMode("app")}
                    className="absolute top-0 left-0 w-1/2 h-full z-10 flex items-center justify-center text-xs font-semibold focus:outline-none"
                >
                    <span className={`${mode === "app" ? "text-white" : "text-black"}`}>App</span>
                </button>
                <button
                    onClick={() => setMode("script")}
                    className="absolute top-0 right-0 w-1/2 h-full z-10 flex items-center justify-center text-xs font-semibold focus:outline-none"
                >
                    <span className={`${mode === "script" ? "text-white" : "text-black"}`}>Script</span>
                </button>
            </div>
        </div>
    );
}
