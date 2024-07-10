import React, {useRef} from 'react';

import Editor from '@monaco-editor/react';

export function CodeView ({ script, testScript }) {
    const editorRef = useRef(null);
    const testEditorRef = useRef(null);
    function handleEditorDidMount(editor, monaco) {
        editorRef.current = editor;
    }
    function handleTestEditorDidMount(editor, monaco) {
        testEditorRef.current = editor;
    }
    return (
        <div className="justify-center h-screen bg-gray-900 text-white p-3 w-full max-w-screen-lg mx-auto">
            <h1 className="text-lg font-bold mb-2">Script</h1>
            <Editor
                height="calc(68vh - 150px)"
                theme="vs-dark"
                defaultLanguage="javascript"
                defaultValue={script}
                options={{readOnly: true}}
                // onChange={()=> editorRef.current && testEditorRef.current && onCodeChange(editorRef.current.getValue(), testEditorRef.current.getValue())} // Pass the function to handle changes
                onMount={handleEditorDidMount}
            />
            <h1 className="text-lg font-bold mb-2">Test Script</h1>
            <Editor
                height="32vh"
                theme="vs-dark"
                defaultLanguage="javascript"
                defaultValue={testScript}
                options={{readOnly: true}}
                // onChange={()=> editorRef.current && testEditorRef.current && onCodeChange(editorRef.current.getValue(), testEditorRef.current.getValue())} // Pass the function to handle changes
                onMount={handleTestEditorDidMount}
            />
        </div>
    );
};