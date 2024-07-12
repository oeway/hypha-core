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
import HyphaContext from "../HyphaContext";

mocha.setup('bdd');
mocha.cleanReferencesAfterRun(false);

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
        handleError(error, this.props.sourceMap, this.props.script).then(({ errorMessage, errorContext }) => {
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

const Main = ({ Component, script, testScript, sMap, setError, setDone, onRun }) => {
    const [mode, setMode] = useState("app");
    useEffect(() => {
        setDone && setDone();
    }, [Component, setDone]);

    return (
        <>
            <FloatingSwitch mode={mode} setMode={setMode} />
            <ErrorBoundary setError={setError} sourceMap={sMap} script={script}>
                {mode === "app" ? (
                    <div className="w-full h-full  p-0 overflow-x-auto">
                        <StrictMode>
                            <Component />
                        </StrictMode>
                    </div>
                ) : <CodeView script={script} testScript={testScript} onRun={onRun}/>}
            </ErrorBoundary>
        </>
    );
};


async function executeCodeInContext(transformedScript, React, api) {
    let exports = {};
    // Execute the transformed script
    new Function('exports', 'React', 'api', transformedScript)(exports, React, api);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Assuming the transformed script assigns the component to global.userScript
    let Component = exports.default;
    if (!Component) {
        throw new Error('Script must export a default component');
    }
    return Component;
}

export default function ReactUI({onReady}) {
    let currentScript;
    const [component, setComponent] = useState(null);
    const [error, setError] = useState(null);
    const { api } = React.useContext(HyphaContext);

    function testApp(testScript) {
        try {
            const transformedTestScript = Babel.transform(testScript, {
                presets: ['react'],
                plugins: ['transform-modules-umd'],
                filename: 'testScript.js'
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
                            reject(new Error(`Test failed: ${test.fullTitle()} - ${err.message}`));
                        });
                        runner.on('end', function () {
                            const report = results.join('\n');
                            console.log(`Test report:\n${report}`);
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
            return Promise.reject(testError);
        }
    }

    async function renderApp(script, testScript) {
        try{
            script = prettier.format(script, {
                parser: "babel",
                plugins: [parserBabel]
            });
            testScript = prettier.format(testScript, {
                parser: "babel",
                plugins: [parserBabel]
            });
        }
        catch(e){
            console.warning("Failed to format the script:", e.message);
        }
        currentScript = script;
        try {
            const transformed = Babel.transform(script, {
                presets: ['react'],
                plugins: ['transform-modules-umd'],
                sourceMaps: true,
                filename: 'userScript.js'
            });
            const transformedScript = transformed.code;
            const sMap = transformed.map;
            const Component = await executeCodeInContext(transformedScript, React, api);
            await new Promise((resolve, reject) => setComponent(<Main Component={Component} script={script} sMap={sMap} testScript={testScript} setError={reject} setDone={resolve} onRun={renderApp}/>));
        } catch (transformationError) {
            console.error("Failed to transform the script:", transformationError.message);
            const { errorMessage, errorContext } = await handleError(transformationError, null, script);
            setError({ message: errorMessage, context: errorContext });
            throw new Error('Script execution failed:\n' + errorMessage + '\n' + errorContext);
        }

        try {
            if(testScript){
                return await testApp(testScript);
            }
            else
                return "App rendered successfully (but no test script provided)";
        }
        catch (testError) {
            console.error("Failed to execute the test script:", testError.message);
            const { errorMessage, errorContext } = await handleError(testError, null, testScript);
            setError({ message: errorMessage, context: errorContext });
            throw new Error('Test Script failed:\n' + errorMessage + '\n' + errorContext);
        }
    }

    useEffect(() => {
        renderApp(defaultScript, defaultTestScript).then(console.log).catch(console.error);
        api && api.registerService({
            id: 'react-ui',
            name: 'React UI',
            setup() {
                console.log("Hypha client is ready", api)
            },
            getScript() {
                return currentScript || '';
            },
            renderApp,
        }).then((svc) => {
            onReady && onReady(svc);
        });
    }, [api]);

    return (
        <>
        {error && <ErrorDisplay error={error.message} context={error.context} />}
        {component && component}
        </>
    );
};
