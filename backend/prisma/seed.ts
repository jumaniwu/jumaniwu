import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GRIYAKU database...');

  const properties = [
    {
      name: 'Villa Griyaku Canggu',
      location: 'Canggu, Bali',
      city: 'Bali',
      description: 'As part of GRIYAKU\'s curated property lineup, Villa Griyaku Canggu offers a calm and relaxing atmosphere in Canggu, one of the fastest-growing property areas in South Bali. Located just minutes from Echo Beach, this villa provides a serene ocean-view living experience surrounded by popular cafés, restaurants, and beach clubs.\n\nBuilt on 440 m² of land with a 465 m² building, this villa features four bedrooms and four bathrooms designed in a modern tropical style.',
      totalTokens: 1474515,
      tokensAvailable: 1441256,
      tokenPriceIdr: 10000,
      currentValueIdr: 14745150000,
      propertyType: 'villa',
      bedrooms: 4,
      bathrooms: 4,
      areaSqm: 440,
      eryAnnual: 9.0,
      ecaAnnual: 2.0,
      status: 'available',
      contractAddress: '0x4EF208d5c9A374E35E9f3a04C7F2bFE04C7F2bFE',
      tokenId: 1,
      images: [],
      isFeatured: true,
      timeline: {
        create: [
          { date: new Date('2025-09-29'), title: 'Intent to purchase signed', description: 'GRIYAKU signed intent to purchase the property', order: 1 },
          { date: new Date('2025-10-31'), title: 'Property was acquired by GRIYAKU', description: 'PT Properti Gotong Royong acquired the property', order: 2 },
          { date: new Date('2025-11-01'), title: 'Property available for rental', description: 'Property will start generating income', order: 3 },
          { date: new Date('2025-12-21'), title: 'Expected first rental payment', description: 'The first rental payment for this property is projected to be paid to investors by December 21, 2025', order: 4 },
        ],
      },
      documents: {
        create: [
          { name: 'Google Maps Location', url: 'https://maps.google.com', type: 'maps' },
          { name: 'Ringkasan Informasi Produk & Layanan (RIPLAY)', url: '#', type: 'riplay' },
          { name: 'Product & Service Information Summary', url: '#', type: 'summary' },
          { name: 'Ownership Documents', url: '#', type: 'ownership' },
        ],
      },
    },
    {
      name: 'Casa Nusantara Seminyak',
      location: 'Seminyak, Bali',
      city: 'Bali',
      description: 'Casa Nusantara is a stunning beachside villa in Seminyak, Bali\'s most vibrant neighborhood. Steps away from world-class restaurants, boutiques, and beach clubs, this modern villa offers premium rental yields.\n\nThe 380 m² property features a generous pool area, three spacious bedrooms, and a rooftop terrace with sunset views.',
      totalTokens: 706912,
      tokensAvailable: 656912,
      tokenPriceIdr: 10000,
      currentValueIdr: 7069120000,
      propertyType: 'villa',
      bedrooms: 3,
      bathrooms: 3,
      areaSqm: 380,
      eryAnnual: 9.0,
      ecaAnnual: 1.5,
      status: 'running_out',
      contractAddress: null,
      tokenId: 2,
      images: [],
      isFeatured: true,
      timeline: {
        create: [
          { date: new Date('2025-10-01'), title: 'Intent to purchase signed', description: 'GRIYAKU signed intent to purchase the property', order: 1 },
          { date: new Date('2025-11-15'), title: 'Property acquired', description: 'Acquisition completed', order: 2 },
          { date: new Date('2026-01-01'), title: 'Available for rental', description: 'Property starts generating rental income', order: 3 },
        ],
      },
      documents: {
        create: [
          { name: 'Google Maps Location', url: 'https://maps.google.com', type: 'maps' },
          { name: 'Ownership Documents', url: '#', type: 'ownership' },
        ],
      },
    },
    {
      name: 'Griya Lestari Ubud',
      location: 'Ubud, Bali',
      city: 'Bali',
      description: 'Nestled in the cultural heart of Bali, Griya Lestari Ubud offers a unique investment opportunity in Ubud\'s thriving wellness and eco-tourism sector. Surrounded by lush rice terraces and ancient temples, this boutique villa attracts high-end guests year-round.\n\nThe 500 m² property includes a traditional Balinese joglo pavilion, infinity pool, and organic garden.',
      totalTokens: 500000,
      tokensAvailable: 387500,
      tokenPriceIdr: 10000,
      currentValueIdr: 5000000000,
      propertyType: 'villa',
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 500,
      eryAnnual: 8.5,
      ecaAnnual: 2.0,
      status: 'available',
      contractAddress: null,
      tokenId: 3,
      images: [],
      isFeatured: false,
      timeline: {
        create: [
          { date: new Date('2025-12-01'), title: 'Intent to purchase signed', description: 'GRIYAKU signed intent to purchase the property', order: 1 },
          { date: new Date('2026-01-15'), title: 'Property acquired', description: 'Acquisition completed', order: 2 },
          { date: new Date('2026-03-01'), title: 'Available for rental', description: 'Property starts generating rental income', order: 3 },
        ],
      },
      documents: {
        create: [
          { name: 'Google Maps Location', url: 'https://maps.google.com', type: 'maps' },
          { name: 'Ownership Documents', url: '#', type: 'ownership' },
        ],
      },
    },
  ];

  for (const property of properties) {
    const existing = await prisma.property.findFirst({ where: { name: property.name } });
    if (!existing) {
      await prisma.property.create({ data: property as any });
      console.log(`  ✅ Created property: ${property.name}`);
    } else {
      console.log(`  ⏭  Property already exists: ${property.name}`);
    }
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
