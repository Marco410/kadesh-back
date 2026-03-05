export function parseAddressComponents(
    components: Array<{ long_name: string; short_name: string; types: string[] }>,
  ) {
    let city = "";
    let state = "";
    let country = "";
    for (const c of components || []) {
      if (c.types.includes("locality")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) state = c.short_name;
      if (c.types.includes("country")) country = c.long_name;
    }
    return { city, state, country };
  }