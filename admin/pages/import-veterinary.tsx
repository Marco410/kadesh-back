/** @jsxRuntime classic */
import React, { useState } from 'react';
import { jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Heading } from '@keystone-ui/core';

export default function ImportVeterinaryPage() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleExecuteFunction = async () => {
    if (!inputValue.trim()) {
      alert('Por favor ingresa un valor');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Llamada a la mutación GraphQL que creamos
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation ExecuteImportVeterinary($input: ImportVeterinaryInput!) {
              executeImportVeterinary(input: $input) {
                success
                message
                result
              }
            }
          `,
          variables: {
            input: {
              inputValue: inputValue
            }
          }
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (data.data?.executeImportVeterinary?.success) {
        setResult(data.data.executeImportVeterinary.result);
      } else {
        setResult(`Error: ${data.data?.executeImportVeterinary?.message || 'Error desconocido'}`);
      }
    } catch (error) {
      setResult(`Error de red: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      header={<Heading type="h3">Importar Veterinarias</Heading>}>
      
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '20px',
      }}>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #e1e5e9',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '20px',
        }}>
          
          <h2 style={{
            marginTop: '0',
            marginBottom: '16px',
            color: '#1a202c',
            fontSize: '18px',
            fontWeight: '600',
          }}>
            Importar Veterinarias de una Ciudad
          </h2>
          
          <p style={{
            marginBottom: '20px',
            color: '#4a5568',
            lineHeight: '1.5',
          }}>
            Ingresa el nombre de la ciudad en el campo de abajo y haz clic en el botón para importar.
          </p>
          
          <div style={{
            marginBottom: '16px',
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#2d3748',
            }}>
              Ciudad:
            </label>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Ejemplo: "Morelia"'
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
              disabled={isLoading}
            />
          </div>
          
          <button
            onClick={handleExecuteFunction}
            disabled={isLoading || !inputValue.trim()}
            style={{
              backgroundColor: isLoading ? '#6b7280' : '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {isLoading ? 'Importando...' : 'Importar'}
          </button>
        </div>

        {result && (
          <div style={{
            backgroundColor: result.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${result.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '6px',
            padding: '16px',
            marginTop: '16px',
          }}>
            <h3 style={{
              marginTop: '0',
              marginBottom: '8px',
              color: result.startsWith('Error') ? '#dc2626' : '#166534',
              fontSize: '16px',
              fontWeight: '600',
            }}>
              {result.startsWith('Error') ? 'Error' : 'Resultado'}
            </h3>
            <p style={{
              margin: '0',
              color: result.startsWith('Error') ? '#dc2626' : '#166534',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}>
              {result}
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
} 