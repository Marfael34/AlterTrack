import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function geocodeQuery(q: string, type?: 'municipality'): Promise<{ latitude: number; longitude: number } | null> {
  if (!q || q.trim().length < 2) return null;
  try {
    const typeParam = type ? `&type=${type}` : '';
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q.trim())}${typeParam}&limit=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      return { longitude: coords[0], latitude: coords[1] };
    }
  } catch {
    // Ignore
  }
  return null;
}

async function resolveCoordinates(address?: string | null, city?: string | null) {
  const cleanAddr = address?.trim() || '';
  const cleanCity = city?.trim() || '';

  // 1. Si on a adresse + commune/ville, combiner les deux
  if (cleanAddr && cleanCity) {
    const combined = `${cleanAddr}, ${cleanCity}`;
    const res = await geocodeQuery(combined);
    if (res) return { coords: res, queryUsed: combined };
    // Repli sur la commune seule
    const cityRes = (await geocodeQuery(cleanCity, 'municipality')) || (await geocodeQuery(cleanCity));
    if (cityRes) return { coords: cityRes, queryUsed: cleanCity };
  }

  // 2. Si on a seulement la commune/ville
  if (cleanCity) {
    const cityRes = (await geocodeQuery(cleanCity, 'municipality')) || (await geocodeQuery(cleanCity));
    if (cityRes) return { coords: cityRes, queryUsed: cleanCity };
  }

  // 3. Si on a seulement l'adresse
  if (cleanAddr) {
    const addrRes = await geocodeQuery(cleanAddr);
    if (addrRes) return { coords: addrRes, queryUsed: cleanAddr };
  }

  return null;
}

async function run() {
  const companies = await prisma.company.findMany();
  console.log(`Analyzing ${companies.length} companies...`);
  let updatedCount = 0;

  for (const c of companies) {
    const resolved = await resolveCoordinates(c.address, c.city);
    if (resolved) {
      await prisma.company.update({
        where: { id: c.id },
        data: {
          latitude: resolved.coords.latitude,
          longitude: resolved.coords.longitude,
        },
      });
      console.log(
        `[OK] ${c.name} (${resolved.queryUsed}) -> ${resolved.coords.latitude.toFixed(4)}, ${resolved.coords.longitude.toFixed(4)}`,
      );
      updatedCount++;
    } else {
      console.log(`[SKIP] ${c.name} (Aucune adresse ni ville disponible)`);
    }
  }

  console.log(`Successfully updated coordinates for ${updatedCount}/${companies.length} companies.`);
}

run()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
