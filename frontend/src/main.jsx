import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { router } from "./router.jsx";
import { AuthProvider } from "./api/auth/AuthProvider";
import "./index.css";
import "./styles.css";
import "./pro-theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />

      {/* 🔥 TOASTS PREMIUM */}
      <Toaster
        position="top-right"
        gutter={12}
        containerStyle={{
          top: 24,
          right: 24,
        }}
        toastOptions={{
          duration: 3500,
          style: {
            background: "rgba(15, 23, 42, 0.96)",
            color: "#f8fbff",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: "18px",
            padding: "14px 16px",
            boxShadow: "0 20px 50px rgba(2,8,23,.28)",
            fontWeight: "700",
            backdropFilter: "blur(12px)",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#ffffff",
            },
          },
        }}
      />
    </AuthProvider>
  </React.StrictMode>
);