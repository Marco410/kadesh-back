export async function getPlaceDetails(placeId: string, apiKey: string) {
    const fields =
      "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,address_components,geometry,reviews";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=es`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.result) return null;
    return data.result;
  }