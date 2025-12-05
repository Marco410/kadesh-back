const typeDefs = `
  input ImportPetPlaceInput {
    inputValue: String!
  }
  
  type ImportPetPlaceResult {
    success: Boolean!
    message: String!
    result: String
  }
  
  type Mutation {
    executeImportPetPlace(input: ImportPetPlaceInput!): ImportPetPlaceResult!
  }
`;

const definition = `
  executeImportPetPlace(input: ImportPetPlaceInput!): ImportPetPlaceResult!
`;

const resolver = {
  executeImportPetPlace: async (root: any, { input }: { input: { inputValue: string } }, context: any) => {
    try {
      console.log('Ejecutando importación de veterinarias con datos:', input.inputValue);
      
      const result = await importVeterinaries(input.inputValue, context);

      console.log('Resultados de la importación:', result);

      return {
        success: true,
        message: 'Veterinarias importadas exitosamente',
        result: result
      };
    } catch (error) {
      console.error('Error importando veterinarias:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        result: null
      };
    }
  }
};

async function importVeterinaries(city: string, context: any) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno');
    }

    const query = encodeURIComponent(`veterinarias en ${city}`);
    const baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${apiKey}`;
    let url = `${baseUrl}&query=${query}`;
    let importedCount = 0;
    let errors: string[] = [];
    let page = 0;
    let nextPageToken: string | undefined = undefined;
    let maxPagesToSearch = 1;

    do {
      if (page > 0 && nextPageToken) {
        const waitSeconds = 5;
        for (let i = 1; i <= waitSeconds; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log(`Esperando... ${i} segundo(s) de ${waitSeconds}`);
        }
        url = `${baseUrl}&pagetoken=${nextPageToken}`;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error en la respuesta de la API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
          throw new Error(`Error en la API de Google Places: ${data.status} - ${data.error_message || 'Error desconocido'}`);
        }

        console.log(`Se encontraron ${data.results?.length || 0} veterinarias en ${city} (página ${page + 1})`);

        if (data.results && data.results.length > 0) {
          for (const place of data.results) {
            try {
              if (!place.name) {
                errors.push(`Lugar sin nombre: ${JSON.stringify(place)}`);
                continue;
              }

              const address = place.formatted_address || '';
              const lat = place.geometry?.location?.lat?.toString() || '';
              const lng = place.geometry?.location?.lng?.toString() || '';
              const rating = place.rating || 0;
              const userRatingsTotal = place.user_ratings_total || 0;
              const placeId = place.place_id || '';

              const existingVeterinary = await context.sudo().query.PetPlace.findOne({
                where: { google_place_id: placeId },
                query: 'id'
              });

              if (existingVeterinary) {
                console.log(`Veterinaria con placeId ${placeId} ya registrada, se omite.`);
                continue;
              }

              const result = await context.sudo().query.PetPlace.createOne({
                data: {
                  name: place.name,
                  description: `Veterinaria ubicada en ${address}. ${rating > 0 ? `Calificación: ${rating}/5 (${userRatingsTotal} reseñas)` : ''}`,
                  type: 'veterinary',
                  phone: '',
                  website: '',
                  street: '',
                  municipality: '',
                  state: '',
                  country: '',
                  cp: '',
                  lat: lat,
                  lng: lng,
                  views: 0,
                  address: address,
                  google_place_id: placeId,
                },
              });

              if (placeId) {
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number&key=${apiKey}&language=es`;
                try {
                  const detailsResponse = await fetch(detailsUrl);
                  if (!detailsResponse.ok) {
                    throw new Error(`Error en la respuesta de la API de detalles: ${detailsResponse.status} ${detailsResponse.statusText}`);
                  }
                  const detailsData = await detailsResponse.json();

                  if (detailsData.status === 'OK' && detailsData.result) {
                    const updateData: any = {};
                    if (detailsData.result.international_phone_number) {
                      updateData.phone = detailsData.result.international_phone_number;
                    }
                    if (
                      detailsData.result.opening_hours &&
                      Array.isArray(detailsData.result.opening_hours.weekday_text)
                    ) {
                      updateData.google_opening_hours = detailsData.result.opening_hours.weekday_text.join('\n');
                    }
                    if (Object.keys(updateData).length > 0) {
                      try {
                        await context.sudo().query.PetPlace.updateOne({
                          where: { id: result.id },
                          data: updateData,
                        });
                      } catch (updateError) {
                        console.error(`Error actualizando datos de Veterinary para ${place.name}:`, updateError);
                      }
                    }

                    if (Array.isArray(detailsData.result.reviews)) {
                      for (const review of detailsData.result.reviews) {
                        try {
                          let createdAt: Date | undefined = undefined;
                          if (review.time) {
                            createdAt = new Date(review.time * 1000);
                          }
                          await context.sudo().query.Review.createOne({
                            data: {
                              rating: review.rating || 0,
                              review: review.text || '',
                              createdAt: createdAt,
                              google_user: review.author_name || '',
                              google_user_photo: review.profile_photo_url || '',
                              pet_place: { connect: { id: result.id } },
                            },
                          });
                        } catch (reviewError) {
                          console.error(`Error guardando review para ${place.name}:`, reviewError);
                        }
                      }
                    }
                  }
                } catch (detailsError) {
                  console.error(`Error obteniendo detalles de reviews para ${place.name}:`, detailsError);
                }
              }

              importedCount++;
              console.log(`Veterinaria importada: ${place.name} - ${address}`);

            } catch (error) {
              const errorMsg = `Error importando ${place.name || 'veterinaria'}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
              //errors.push(errorMsg);
              console.error(errorMsg);
            }
          }
        }
        // Preparar para la siguiente página
        nextPageToken = data.next_page_token;
        page++;
      } catch (apiError) {
        console.error('Error al llamar a la API de Google Places:', apiError);
        break; // Si hay error, no seguir paginando
      }
    } while (nextPageToken && page < maxPagesToSearch);

    let resultMessage = `Importación completada. ${importedCount} veterinarias importadas exitosamente.`;

    if (errors.length > 0) {
      resultMessage += `\n\nErrores encontrados:\n${errors.join('\n')}`;
    }

    return resultMessage;

  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Formato JSON inválido. Por favor verifica que los datos estén en formato JSON correcto.');
    }
    throw error;
  }
}

export default {
  typeDefs,
  definition,
  resolver
}; 