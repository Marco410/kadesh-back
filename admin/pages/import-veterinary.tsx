/** @jsxRuntime classic */
import React, { useState, useEffect } from 'react';
import { jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Heading } from '@keystone-ui/core';

interface PetPlaceType {
  id: string;
  label: string;
  value: string;
  plural: string;
}

export default function ImportVeterinaryPage() {
  const [inputValue, setInputValue] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [petPlaceTypes, setPetPlaceTypes] = useState<PetPlaceType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchPetPlaceTypes = async () => {
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query GetPetPlaceTypes {
                petPlaceTypes {
                  id
                  label
                  value
                  plural
                }
              }
            `,
          }),
          credentials: 'include'
        });

        const data = await response.json();
        if (data.data?.petPlaceTypes) {
          const types = data.data.petPlaceTypes;
          setPetPlaceTypes(types);
          // Establecer el primer tipo como seleccionado por defecto
          if (types.length > 0 && !selectedType) {
            setSelectedType(types[0].value);
          }
        }
      } catch (error) {
        console.error('Error cargando tipos de lugar:', error);
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchPetPlaceTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExecuteFunction = async () => {
    if (!inputValue.trim()) {
      alert('Por favor ingresa un valor');
      return;
    }
    if (!selectedType) {
      alert('Por favor selecciona un tipo de lugar');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation ExecuteImportPetPlace($input: ImportPetPlaceInput!) {
              executeImportPetPlace(input: $input) {
                success
                message
                result
              }
            }
          `,
          variables: {
            input: {
              inputValue: inputValue,
              type: selectedType
            }
          }
        }),
        credentials: 'include'
      });

      const data = await response.json();


      if (data.data?.executeImportPetPlace?.success) {
        setResult(data.data.executeImportPetPlace.result);
      } else {
        setResult(`Error: ${data.data?.executeImportPetPlace?.message || 'Error desconocido'}`);
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
              Tipo de Lugar:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'white',
                cursor: isLoading || isLoadingTypes ? 'not-allowed' : 'pointer',
              }}
              disabled={isLoading || isLoadingTypes}
            >
              {isLoadingTypes ? (
                <option>Cargando tipos...</option>
              ) : petPlaceTypes.length === 0 ? (
                <option>No hay tipos disponibles</option>
              ) : (
                petPlaceTypes.map((type) => (
                  <option key={type.id} value={type.value}>
                    {type.label}
                  </option>
                ))
              )}
            </select>
          </div>

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
            disabled={isLoading || !inputValue.trim() || !selectedType}
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