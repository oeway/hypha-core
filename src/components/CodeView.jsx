import React, { useRef, useEffect } from 'react';
import { UnControlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/mode/javascript/javascript';
import { on } from 'process';

export function CodeView({ script, testScript, onCodeChange }) {
    const editorRef = useRef(null);
    const testEditorRef = useRef(null);

    useEffect(() => {
        if (editorRef.current && testEditorRef.current) {
            // This setup assumes you want to run some action when either editor changes.
            // Adjust according to your actual needs.
            const runAction = () => onCodeChange(editorRef.current.getValue(), testEditorRef.current.getValue());
            editorRef.current.on('change', runAction);
            testEditorRef.current.on('change', runAction);
        }
    }, [onCodeChange]);

    return (
        <div className="justify-center h-screen bg-gray-900 text-white p-3 w-full max-w-screen-lg mx-auto">
            <h1 className="text-lg font-bold mb-2">Script</h1>
            <CodeMirror
                value={script}
                options={{
                    mode: 'javascript',
                    theme: 'material-darker',
                    lineNumbers: true,
                    readOnly: false,
                }}
                editorDidMount={editor => { editorRef.current = editor }}
                onChange={(editor, data, value) => {
                    onCodeChange(value, testEditorRef.current.getValue());
                }}
            />

            {testScript &&
                <>
                    <h1 className="text-lg font-bold mb-2">Test Script</h1>
                    <CodeMirror
                        value={testScript}
                        options={{
                            mode: 'javascript',
                            theme: 'material-darker',
                            lineNumbers: true,
                            readOnly: false,
                        }}
                        editorDidMount={editor => { testEditorRef.current = editor }}
                        onChange={(editor, data, value) => {
                            onCodeChange(editorRef.current.getValue(), value);
                        }}
                    />
                </>
            }
        </div>
    );
};