import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

import { AssistantRegistryProvider } from "./assistant/AssistantRegistry.jsx";
import { BillingDataProvider } from "./data/BillingDataProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AssistantRegistryProvider>
    <BillingDataProvider>
      <App />
    </BillingDataProvider>
  </AssistantRegistryProvider>
);
