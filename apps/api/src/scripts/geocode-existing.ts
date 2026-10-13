import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function geocode(q: string) {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`);
    const data = await res.json() as any;
    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      return { longitude: coords[0], latitude: coords[1] };
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

async function run() {
  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies`);
  let updatedCount = 0;
  for (const c of companies) {
    const query = c.address || c.city;
    if (query && (c.latitude === null || c.longitude === null)) {
      const coords = await geocode(query);
      if (coords) {
        await prisma.company.update({
          where: { id: c.id },
          data: { latitude: coords.latitude, longitude: coords.longitude },
        });
        console.log(`[GEOCODED] ${c.name} (${query}) -> ${coords.latitude}, ${coords.longitude}`);
        updatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} companies.`);
}

run()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
