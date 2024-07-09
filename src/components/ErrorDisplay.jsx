import React from "react";

export function ErrorDisplay ({ error, context }) {
    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h1 className="text-lg font-bold mb-2">Failed to load UI component</h1>
            <h2 className="text-lg font-bold mb-2">Error:</h2>
            <pre className="whitespace-pre-wrap">{error}</pre>
            {context && (
                <div className="mt-2">
                    <strong>Code context:</strong>
                    <pre className="whitespace-pre-wrap bg-red-200 p-1 mt-1">
                        {context}
                    </pre>
                </div>
            )}
        </div>
    );
};