/** @jsxRuntime classic */
import React, { useState } from "react";
import { jsx } from "@keystone-ui/core";
import { PageContainer } from "@keystone-6/core/admin-ui/components";
import { Heading } from "@keystone-ui/core";

type SendTestEmailResult = {
  success: boolean;
  message: string;
  recipient: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpConfigured: boolean;
};

export default function SendTestEmailPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SendTestEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSendTest = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Ingresa un correo electrónico");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation SendTestEmail($email: String!) {
              sendTestEmail(email: $email) {
                success
                message
                recipient
                smtpHost
                smtpPort
                smtpConfigured
              }
            }
          `,
          variables: { email: trimmed },
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (data.errors?.length) {
        setError(data.errors[0].message || "Error de GraphQL");
        return;
      }

      const payload = data.data?.sendTestEmail as SendTestEmailResult | undefined;
      if (!payload) {
        setError("No se recibió respuesta del servidor");
        return;
      }

      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer header={<Heading type="h3">Probar envío de correo</Heading>}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <div
          style={{
            backgroundColor: "#f8f9fa",
            border: "1px solid #e1e5e9",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 8,
              color: "#1a202c",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            Enviar correo de prueba
          </h2>
          <p style={{ marginBottom: 16, color: "#4a5568", lineHeight: 1.5 }}>
            Solo administradores pueden usar esta herramienta. Envía un correo de
            prueba vía Mailtrap Send API (HTTPS) para validar el entorno (local o
            Railway).
          </p>

          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 500,
              color: "#2d3748",
            }}
          >
            Correo destino
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@gmail.com"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 14,
              boxSizing: "border-box",
              marginBottom: 16,
            }}
          />

          <button
            onClick={runSendTest}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#6b7280" : "#FF8C42",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 6,
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {isLoading ? "Enviando…" : "Enviar prueba"}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 16,
              borderRadius: 6,
              marginBottom: 16,
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              padding: 16,
              borderRadius: 6,
              marginBottom: 16,
              backgroundColor: result.success ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${result.success ? "#bbf7d0" : "#fecaca"}`,
              color: result.success ? "#166534" : "#dc2626",
            }}
          >
            <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>
              {result.success ? "Envío exitoso" : "Error al enviar"}
            </p>
            <p style={{ margin: "0 0 8px 0" }}>{result.message}</p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 13,
                color: result.success ? "#15803d" : "#b91c1c",
              }}
            >
              <li>Destinatario: {result.recipient ?? "—"}</li>
              <li>Mailtrap configurado: {result.smtpConfigured ? "Sí" : "No"}</li>
              <li>API: {result.smtpHost ?? "—"} (HTTPS)</li>
            </ul>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
