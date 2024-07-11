import React, { useState } from 'react';

export function ErrorDisplay({ error, context }) {
    const [isErrorCollapsed, setErrorCollapsed] = useState(true);
    const [isContextCollapsed, setContextCollapsed] = useState(true);

    const toggleErrorCollapse = () => setErrorCollapsed(!isErrorCollapsed);
    const toggleContextCollapse = () => setContextCollapsed(!isContextCollapsed);

    const displayContent = (content, isCollapsed) => {
        if (!content) return null;
        return isCollapsed ? `${content.substring(0, 128)}${content.length > 256 ? '...' : ''}` : content;
    };

    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h1 className="text-lg font-bold mb-2">Failed to load UI component</h1>
            <h2 className="text-lg font-bold mb-2">Error:</h2>
            <pre className="whitespace-pre-wrap" onClick={toggleErrorCollapse}>
                {displayContent(error, isErrorCollapsed)}
            </pre>
            {context && (
                <div className="mt-2">
                    <strong>Code context:</strong>
                    <pre className="whitespace-pre-wrap bg-red-200 p-1 mt-1" onClick={toggleContextCollapse}>
                        {displayContent(context, isContextCollapsed)}
                    </pre>
                </div>
            )}
        </div>
    );
}