import React, { useState, useEffect, StrictMode } from "react";
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel';
import * as Babel from "@babel/standalone";
import * as testingLibraryDom from "@testing-library/dom";
import testingLibraryUserEvent from "@testing-library/user-event";
import * as matchers from "@testing-library/jest-dom/matchers";
import { Assertion } from "chai";
import sourceMap from "source-map";
import mocha from "mocha";
import "mocha/mocha.css";
import { FloatingSwitch } from "./FloatingSwitch";
import { CodeView } from "./CodeView";
import { ErrorDisplay } from "./ErrorDisplay";
import { expect } from "chai";

mocha.setup('bdd');

// Extend Chai's expect with Testing Library's matchers
Object.keys(matchers).forEach((key) => {
    Assertion.addMethod(key, function (...args) {
        return matchers[key](this._obj, ...args);
    });
});

async function initializeSourceMap() {
    sourceMap.SourceMapConsumer.initialize({
        "lib/mappings.wasm": "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm",
    });
}
initializeSourceMap().catch(console.error);

const defaultScript = `
const { useState, useEffect } = React;
const App = () => {
    const [count, setCount] = useState(0);
    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-r from-blue-500 to-purple-500">
            <h1 className="text-6xl font-bold text-black">Hello World!</h1>
        </div>
    );
};
export default App;
`;

const defaultTestScript = `
const { screen, waitFor } = testingLibraryDom;
const userEvent = testingLibraryUserEvent;

describe('App Component', () => {
    it('renders hello world', () => {
        expect(screen.getByText(/hello world/i)).toBeInTheDocument();
    });
});
`;

async function handleError(error, sMap, originalScript) {
    let errorMessage = error.message;
    let errorContext = "";
    let errorLineNumber = null;

    if (sMap) {
        const smc = await new sourceMap.SourceMapConsumer(sMap);
        const scriptLines = originalScript.split("\n");

        for (let i = 0; i < scriptLines.length; i++) {
            if (scriptLines[i].includes("cons") && !scriptLines[i].includes("const")) {
                errorLineNumber = i + 1;
                break;
            }
        }

        if (errorLineNumber === null) {
            const stackLines = error.stack.split("\n");
            const match = stackLines[1].match(/\(eval at loadUI.+?<anonymous>:(\d+):(\d+)\)/);
            if (match) {
                const originalPosition = smc.originalPositionFor({
                    line: parseInt(match[1]),
                    column: parseInt(match[2]),
                });
                if (originalPosition && originalPosition.line) {
                    errorLineNumber = originalPosition.line;
                }
            }
        }

        if (errorLineNumber !== null) {
            const startLine = Math.max(0, errorLineNumber - 4);
            const endLine = Math.min(scriptLines.length - 1, errorLineNumber + 2);
            errorContext = scriptLines
                .slice(startLine, endLine + 1)
                .map((line, index) => {
                    const lineNumber = startLine + index + 1;
                    const marker = lineNumber === errorLineNumber ? "> " : "  ";
                    return `${marker}${lineNumber}: ${line}`;
                })
                .join("\n");

            errorMessage += ` (at line ${errorLineNumber})`;
        }

        smc.destroy();
    }

    return { errorMessage, errorContext };
}


class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error) {
        handleError(error, this.props.sourceMap, this.props.originalScript).then(({ errorMessage, errorContext }) => {
            this.props.setError(new Error('Script execution failed:\n' + errorMessage + '\n' + errorContext));
        });
    }

    render() {
        if (this.state.hasError) {
            return null; // The error will be displayed by handleError
        }

        return this.props.children;
    }
}

const Main = ({ Component, script, sMap, setError, setDone }) => {
    const [mode, setMode] = useState("app");
    useEffect(() => {
        setDone && setDone();
    }, [Component, mode, script, setDone]);

    return (
        <>
            <FloatingSwitch mode={mode} setMode={setMode} />
            <ErrorBoundary setError={setError} sourceMap={sMap} originalScript={script}>
                {mode === "app" ? (
                    <div className="w-full h-full  p-0 overflow-x-auto">
                        <StrictMode>
                            <Component />
                        </StrictMode>
                    </div>
                ) : <CodeView script={script} />}
            </ErrorBoundary>
        </>
    );
};


const ReactUI = ({ api }) => {
    const [script, setScript] = useState("");
    const [component, setComponent] = useState(null);
    const [error, setError] = useState(null);

    async function testApp(testScript) {
        try {
            const transformedTestScript = Babel.transform(testScript, {
                presets: ['react'],
                plugins: ['transform-modules-umd']
            }).code;

            const testFunc = new Function('React', 'testingLibraryDom', 'testingLibraryUserEvent', 'expect', 'describe', 'it', 'api', transformedTestScript);

            return new Promise((resolve, reject) => {
                // Reset Mocha's state
                mocha.suite.suites.length = 0;
                // Define a custom Mocha reporter
                class CustomReporter {
                    constructor(runner) {
                        const results = [];
                        runner.on('pass', function (test) {
                            results.push(`PASS: ${test.fullTitle()}`);
                        });
                        runner.on('fail', function (test, err) {
                            results.push(`FAIL: ${test.fullTitle()} - ${err.message}`);
                        });
                        runner.on('end', function () {
                            const report = results.join('\n');
                            resolve(report);
                        });
                    }
                }

                // Add the custom reporter
                mocha.reporter(CustomReporter);

                // Execute the test function
                testFunc(React, testingLibraryDom, testingLibraryUserEvent, expect, describe, it, api);

                // Run the tests
                mocha.run();
            });
        } catch (testError) {
            console.error("Failed to execute the test script:", testError.message);
            return Promise.reject(testError);
        }
    }

    async function renderApp(script, testScript) {
        setScript(script);
        let func, sMap, module, formattedScript;
        try {
            const transformed = Babel.transform(script, {
                presets: ['react'],
                plugins: ['transform-modules-umd'],
                sourceMaps: true,
                filename: 'userScript.js'
            });

            const transformedScript = transformed.code;
            sMap = transformed.map;

            module = { exports: {} };
            func = new Function('module', 'exports', 'React', 'api', transformedScript);
            formattedScript = prettier.format(script, {
                parser: "babel",
                plugins: [parserBabel]
            });
        } catch (transformationError) {
            console.error("Failed to transform the script:", transformationError.message);
            const { errorMessage, errorContext } = await handleError(transformationError, null, script);
            setError({ message: errorMessage, context: errorContext });
            throw new Error('Script execution failed:\n' + errorMessage + '\n' + errorContext);
        }
        try {
            await new Promise((resolve, reject) => {
                const setError = (error) => {
                    reject(error);
                };
                const setDone = () => {
                    resolve();
                };
                func(module, module.exports, React, api);
                const Component = module.exports.default;
                setComponent(<Main Component={Component} script={formattedScript} sMap={sMap} setError={setError} setDone={setDone} />);
            });
        } catch (executionError) {
            console.error("Failed to execute the script:", executionError.message);
            const { errorMessage, errorContext } = await handleError(executionError, sMap, script);
            setError({ message: errorMessage, context: errorContext });
            throw new Error('Script execution failed:\n' + errorMessage + '\n' + errorContext);
        }

        try {
            return testScript && await testApp(testScript);
        }
        catch (testError) {
            console.error("Failed to execute the test script:", testError.message);
            const { errorMessage, errorContext } = await handleError(testError, sMap, testScript);
            setError({ message: errorMessage, context: errorContext });
            throw new Error('Test Script failed:\n' + errorMessage + '\n' + errorContext);
        }
    }

    useEffect(() => {
        renderApp(defaultScript, defaultTestScript).then(console.log).catch(console.error);
        api.export({
            setup() {
                console.log("Hypha client is ready", api)
            },
            getScript() {
                return script || '';
            },
            renderApp,
        });
    }, []);

    return (
        error ? <ErrorDisplay error={error.message} context={error.context} /> : component
    );
};


export default ReactUI;
