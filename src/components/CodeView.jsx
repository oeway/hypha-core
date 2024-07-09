import React, { useEffect } from 'react';
import hljs from "highlight.js";
import "highlight.js/styles/default.css";

export function CodeView ({ script }) {
    useEffect(() => {
        hljs.highlightAll();
    }, [script]);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-0 w-full max-w-screen-lg mx-auto">
            <div className="w-full p-4 bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
                <pre className="w-full h-full">
                    <code className="whitespace-pre-wrap hljs language-javascript">{script}</code>
                </pre>
            </div>
        </div>
    );
};
