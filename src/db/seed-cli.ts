import 'dotenv/config';
import { seedDatabase } from './seed.ts';

const force = process.argv.includes('--force');
const result = seedDatabase({ force });
console.log(result.seeded ? 'Seed data applied successfully.' : 'Database already seeded (use --force to reset sample data).');
