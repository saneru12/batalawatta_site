import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import plantsRoutes from './routes/plants.js';
import inquiriesRoutes from './routes/inquiries.js';
import cartRoutes from './routes/cart.js';
import reviewsRoutes from './routes/reviews.js';
import ordersRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import customersRoutes from './routes/customers.js';
import landscapingRoutes from './routes/landscaping.js';
import settingsRoutes from './routes/settings.js';
import deliveryRoutes from './routes/delivery.js';
import Plant from './models/Plant.js';
import LandscapingPackage from './models/LandscapingPackage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.get('/', (_req, res) => res.send('Batalawatta API is running'));
app.use('/api/plants', plantsRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/landscaping', landscapingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/delivery', deliveryRoutes);

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
}

async function seed() {
  const count = await Plant.countDocuments();
  if (count === 0) {
    await Plant.insertMany([
      {
        name: 'Aloe Vera',
        category: 'Medicinal',
        description: 'Easy to grow medicinal plant.',
        price: 350,
        available: true,
        imageUrl: 'https://picsum.photos/seed/aloe/600/400',
      },
      {
        name: 'Rose Plant',
        category: 'Flowering',
        description: 'Colorful flowering plant for gardens.',
        price: 500,
        available: true,
        imageUrl: 'https://picsum.photos/seed/rose/600/400',
      },
      {
        name: 'Money Plant',
        category: 'Indoor',
        description: 'Popular indoor decorative plant.',
        price: 400,
        available: true,
        imageUrl: 'https://picsum.photos/seed/money/600/400',
      },
    ]);
  }

  const pkgCount = await LandscapingPackage.countDocuments();
  if (pkgCount === 0) {
    await LandscapingPackage.insertMany([
      {
        code: 'starter',
        name: 'Starter Garden Package',
        description: 'Architect-guided refresh for balconies, entry gardens, and compact home frontage.',
        priceRange: 'Rs. 25,000 - 45,000',
        duration: '1 - 2 days',
        bestFor: 'Small front yard / balcony garden',
        idealArea: 'Balcony, entrance garden, small front strip',
        consultationMode: 'Photo review + short site assessment with design guidance',
        aftercare: '7-day watering and establishment guidance via WhatsApp',
        imageUrl: 'assets/img/landscaping/starter.png',
        includes: [
          'Initial project brief with a landscape architect / design specialist',
          'Basic layout suggestion + plant selection',
          '10-20 plants (shade / flowering mix)',
          'Potting mix + mulching (basic)',
          'Simple edging / bed cleanup',
        ],
        deliverables: [
          'Recommended plant palette',
          'Simple layout direction',
          'Installation checklist',
        ],
        exclusions: [
          'Civil hardscape works',
          'Lighting and irrigation automation',
        ],
        isActive: true,
        sortOrder: 1,
      },
      {
        code: 'classic',
        name: 'Classic Home Garden Package',
        description: 'Balanced design-and-install package for medium home gardens that need better zoning and visual structure.',
        priceRange: 'Rs. 50,000 - 85,000',
        duration: '2 - 4 days',
        bestFor: 'Medium home gardens',
        idealArea: '10-20 perch home gardens',
        consultationMode: 'On-site consultation with planting and circulation advice',
        aftercare: 'One follow-up visit within 7 days + care schedule',
        imageUrl: 'assets/img/landscaping/classic.png',
        includes: [
          'Design plan with shade / sun zones',
          '25-45 plants (ornamental + flowering)',
          'Soil improvement + mulching',
          'Pathway gravel / simple stepping stones',
          'Basic irrigation / hose layout guidance',
        ],
        deliverables: [
          'Concept layout with zones',
          'Plant list and material guidance',
          'Installation supervision checklist',
        ],
        exclusions: [
          'Major masonry / concrete works',
          'Specialized lighting fixtures unless quoted separately',
        ],
        isActive: true,
        sortOrder: 2,
      },
      {
        code: 'premium',
        name: 'Premium Landscape Package',
        description: 'For full garden makeovers where the customer needs a stronger design concept, curated planting, and hands-on supervision.',
        priceRange: 'Rs. 95,000 - 160,000',
        duration: '3 - 6 days',
        bestFor: 'Full garden makeover',
        idealArea: '20+ perch gardens or multi-zone residential landscapes',
        consultationMode: 'Detailed on-site consultation with concept refinement',
        aftercare: 'Two follow-up visits within 14 days + maintenance guidance',
        imageUrl: 'assets/img/landscaping/premium.png',
        includes: [
          'Detailed concept design + plant palette',
          '50-90 plants (seasonal + evergreen mix)',
          'Raised bed / border shaping',
          'Decor stones + feature pots',
          'Basic lawn patching OR ground cover area',
        ],
        deliverables: [
          'Detailed concept layout',
          'Feature placement recommendations',
          'Planting zones and execution notes',
          'Quoted implementation schedule',
        ],
        exclusions: [
          'Structural engineering works',
          'Electrical / plumbing modifications unless quoted',
        ],
        isActive: true,
        sortOrder: 3,
      },
      {
        code: 'luxury',
        name: 'Luxury Outdoor Package',
        description: 'High-end custom design-build service for larger properties, focal features, and premium landscape finishes.',
        priceRange: 'Rs. 175,000 - 350,000+',
        duration: '5 - 10 days',
        bestFor: 'Large properties / custom features',
        idealArea: 'Large home gardens, villas, hospitality, or bespoke outdoor spaces',
        consultationMode: 'Full site visit and landscape architect-led design consultation',
        aftercare: '30-day maintenance guidance with staged handover advice',
        imageUrl: 'assets/img/landscaping/luxury.png',
        includes: [
          'Custom design + on-site consultation',
          'Premium plant selection + focal trees',
          'Hardscape options (paving / retaining edges - basic)',
          'Lighting & decorative feature planning',
          'Irrigation planning guidance',
          'Maintenance plan and phased execution support',
        ],
        deliverables: [
          'Custom concept design direction',
          'Planting and materials palette',
          'Feature / focal point placement guide',
          'Phased quotation with execution sequence',
        ],
        exclusions: [
          'Municipal approvals unless separately quoted',
          'Specialist subcontractor works outside agreed scope',
        ],
        isActive: true,
        sortOrder: 4,
      },
    ]);
  }

  console.log('Seed data inserted (plants + landscaping packages)');
}

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    if (process.argv.includes('--seed')) await seed();
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
