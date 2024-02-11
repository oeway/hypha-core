import "./App.css";
import { Greeting, Header } from "./components";
import React from "react";
import HyphaCore from "./hypha-core";

const App = () => {
  const setupHyphaCore = async () => {
    const hyphaCore = new HyphaCore();
    await hyphaCore.initialize();
  };

  return (
    <div className="container">
      <Header />
      <Greeting name="🙏" />
      <button onClick={ setupHyphaCore }>Setup Hypha Core</button>
    </div>
  );
};

export default App;
