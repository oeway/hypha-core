import React from "react";
import { Logo } from "assets";
import "./Header.css";

export function Header() {
  return (
    <div className="header">
      <img src={Logo} />
      <h1>HyphaWeb</h1>
    </div>
  );
}
