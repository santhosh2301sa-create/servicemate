import { getDb, runMigrations } from './database.ts';
import { hashPassword } from '../server/auth.ts';

function addDaysIso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function seedDatabase(options: { force?: boolean } = {}): { seeded: boolean } {
  const db = getDb();
  runMigrations(db);

  const existingCategories = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number };
  if (existingCategories.count > 0 && !options.force) {
    return { seeded: false };
  }

  const transaction = db.transaction(() => {
    if (options.force) {
      db.prepare('DELETE FROM reviews').run();
      db.prepare('DELETE FROM bookings').run();
      db.prepare('DELETE FROM availability_slots').run();
      db.prepare('DELETE FROM services').run();
      db.prepare('DELETE FROM provider_profiles').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare("DELETE FROM users WHERE role != 'admin'").run();
    }

    // 1. Categories
    const insertCategory = db.prepare(`
      INSERT INTO categories (slug, name, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    const categoriesData = [
      ['plumbing', 'Plumbing', 'Tap & mixer repairs, drain clearing, overhead tank valves, and geyser servicing.', 1],
      ['electrical', 'Electrical', 'MCB diagnostics, modular switches, ceiling fans, lighting, and inverter wiring.', 2],
      ['cleaning', 'Home Cleaning', 'Full BHK home cleaning, kitchen chimney & hob degreasing, and bathroom deep clean.', 3],
      ['tutoring', 'Academic Tutoring', 'One-on-one Maths, Science, CBSE/ICSE, and foundation coaching in-person or online.', 4],
      ['appliance-repair', 'Appliance Repair', 'Refrigerator, washing machine, microwave, RO purifier, and AC diagnostics.', 5],
    ] as const;

    const categoryIds: Record<string, number> = {};
    for (const [slug, name, desc, order] of categoriesData) {
      const info = insertCategory.run(slug, name, desc, order);
      categoryIds[slug] = Number(info.lastInsertRowid);
    }

    // 2. Sample Customer & Provider Users (passwords hashed via scrypt)
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const demoCustomerHash = hashPassword('CustomerDemo123!');
    const demoProviderHash = hashPassword('ProviderDemo123!');

    const customer1Id = Number(
      insertUser.run('Aarav Mehta', 'customer@servicemate.demo', '+91 98450 24180', demoCustomerHash, 'customer')
        .lastInsertRowid
    );
    const customer2Id = Number(
      insertUser.run('Priya Nair', 'priya@servicemate.demo', '+91 98451 67320', demoCustomerHash, 'customer')
        .lastInsertRowid
    );

    const rajeshUserId = Number(
      insertUser.run('Rajesh Sharma', 'rajesh@servicemate.demo', '+91 98452 11409', demoProviderHash, 'provider')
        .lastInsertRowid
    );
    const kavithaUserId = Number(
      insertUser.run('Kavitha Iyer', 'kavitha@servicemate.demo', '+91 98453 28910', demoProviderHash, 'provider')
        .lastInsertRowid
    );
    const lakshmiUserId = Number(
      insertUser.run('Lakshmi Devi', 'lakshmi@servicemate.demo', '+91 98454 39022', demoProviderHash, 'provider')
        .lastInsertRowid
    );
    const ananyaUserId = Number(
      insertUser.run('Ananya Rao', 'ananya@servicemate.demo', '+91 98455 44718', demoProviderHash, 'provider')
        .lastInsertRowid
    );
    const vikramUserId = Number(
      insertUser.run('Vikram Kulkarni', 'vikram@servicemate.demo', '+91 98456 50831', demoProviderHash, 'provider')
        .lastInsertRowid
    );

    // 3. Provider Profiles
    const insertProfile = db.prepare(`
      INSERT INTO provider_profiles (
        user_id, display_name, business_name, headline, bio,
        service_area, city, service_mode, years_experience, avatar_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const rajeshProfileId = Number(
      insertProfile.run(
        rajeshUserId,
        'Rajesh Sharma',
        'Sharma Plumbing Works',
        'Leak diagnostics, mixer tap installs & geyser servicing',
        'Over 14 years helping apartments and independent homes across East Bengaluru fix concealed pipe leaks, replace angle valves, and service storage water geysers with clear upfront pricing.',
        'Indiranagar, Koramangala, Ulsoor, Domlur',
        'Bengaluru, KA',
        'in_person',
        14,
        '/src/assets/images/indian_plumber_portrait_1795208961492.jpg'
      ).lastInsertRowid
    );

    const kavithaProfileId = Number(
      insertProfile.run(
        kavithaUserId,
        'Kavitha Iyer',
        'Iyer Electrical Solutions',
        'MCB fault tracing, modular switches, ceiling fans & inverter wiring',
        'Focused on neat residential electrical work—from diagnosing tripping MCBs and replacing burnt sockets to installing BLDC ceiling fans, recessed LEDs, and home-office power points.',
        'Jayanagar, JP Nagar, Banashankari, Basavanagudi',
        'Bengaluru, KA',
        'in_person',
        11,
        '/src/assets/images/indian_electrician_portrait_1795208961373.jpg'
      ).lastInsertRowid
    );

    const lakshmiProfileId = Number(
      insertProfile.run(
        lakshmiUserId,
        'Lakshmi Devi',
        'Swachh Home Care',
        'Detailed flat cleaning, bathroom descaling & kitchen degreasing',
        'Checklist-driven home care tailored for busy families. I use safe, low-odour cleaning solutions to protect granite countertops, wooden wardrobes, and vitrified tiles.',
        'HSR Layout, Bellandur, BTM Layout, Sarjapur Road',
        'Bengaluru, KA',
        'in_person',
        8,
        '/src/assets/images/indian_cleaner_portrait_1795208961220.jpg'
      ).lastInsertRowid
    );

    const ananyaProfileId = Number(
      insertProfile.run(
        ananyaUserId,
        'Ananya Rao',
        'Rao STEM Academy',
        'CBSE/ICSE Maths, Physics & structured exam coaching (Online or Home)',
        'Former senior school STEM faculty offering calm, concept-first one-on-one sessions. Available both via live digital whiteboard and at-home visits across North and East Bengaluru.',
        'Malleshwaram, Sadashivanagar, Whitefield & Remote',
        'Bengaluru, KA',
        'both',
        9,
        '/src/assets/images/indian_tutor_portrait_1795208961532.jpg'
      ).lastInsertRowid
    );

    const vikramProfileId = Number(
      insertProfile.run(
        vikramUserId,
        'Vikram Kulkarni',
        'Kulkarni Appliance Care',
        'Same-week diagnostics for fridges, washing machines & microwaves',
        'Independent appliance specialist servicing front-load washers, double-door refrigerators, chimneys, and OTGs. Transparent fault report before any spare part replacement.',
        'Whitefield, Marathahalli, Brookefield, KR Puram',
        'Bengaluru, KA',
        'both',
        16,
        '/src/assets/images/indian_appliance_portrait_1795208960807.jpg'
      ).lastInsertRowid
    );

    // 4. Services (prices stored in paise: ₹1 = 100 paise)
    const insertService = db.prepare(`
      INSERT INTO services (provider_id, category_id, title, description, price_cents, duration_minutes, service_mode, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const sRajesh1 = Number(
      insertService.run(
        rajeshProfileId,
        categoryIds['plumbing'],
        'Kitchen Sink Mixer & Tap Replacement',
        'Complete removal of leaking tap or wall mixer, washer/angle-cock check, and installation of customer-supplied fitting.',
        89900,
        90,
        'in_person'
      ).lastInsertRowid
    );
    insertService.run(
      rajeshProfileId,
      categoryIds['plumbing'],
      'Bathroom Drain & Bottle-Trap Clearing',
      'Mechanical clearing for slow balcony, kitchen, or bathroom floor drains plus bottle-trap seal inspection.',
      59900,
      60,
      'in_person'
    );
    insertService.run(
      rajeshProfileId,
      categoryIds['plumbing'],
      'Storage Geyser Descaling & Safety Check',
      'Tank sediment flush, heating element scale check, and thermostat/PRV safety valve inspection.',
      109900,
      90,
      'in_person'
    );

    const sKavitha1 = Number(
      insertService.run(
        kavithaProfileId,
        categoryIds['electrical'],
        'Modular Switch & 16A Socket Upgrade (Up to 3)',
        'Replace worn switches or geyser/AC 16A sockets with proper earthing verification and polarity testing.',
        79900,
        90,
        'in_person'
      ).lastInsertRowid
    );
    insertService.run(
      kavithaProfileId,
      categoryIds['electrical'],
      'MCB Trip & Voltage Flicker Diagnostic',
      'Distribution board load balancing and insulation check to pinpoint tripping circuits or loose neutral connections.',
      54900,
      60,
      'in_person'
    );
    insertService.run(
      kavithaProfileId,
      categoryIds['electrical'],
      'Ceiling Fan or Pendant Light Installation',
      'Safe mounting, regulator wiring, and balancing of a BLDC/standard ceiling fan or dining light fixture.',
      95000,
      90,
      'in_person'
    );

    const sLakshmi1 = Number(
      insertService.run(
        lakshmiProfileId,
        categoryIds['cleaning'],
        '2 BHK Standard Home Cleaning',
        'Thorough dusting, dry/wet floor mopping, balcony sweep, kitchen platform wipe-down, and two bathrooms sanitized.',
        149900,
        150,
        'in_person'
      ).lastInsertRowid
    );
    insertService.run(
      lakshmiProfileId,
      categoryIds['cleaning'],
      'Kitchen Chimney, Hob & Two-Bathroom Deep Clean',
      'Targeted degreasing of exhaust chimney filters, gas stove/hob, tile grouting, and hard-water bathroom scale removal.',
      219900,
      180,
      'in_person'
    );

    const sAnanya1 = Number(
      insertService.run(
        ananyaProfileId,
        categoryIds['tutoring'],
        '1-on-1 Maths / Physics Session (Remote)',
        'Interactive 60-minute video session with shared digital whiteboard, NCERT/exam problem walkthrough, and practice sheet.',
        65000,
        60,
        'remote'
      ).lastInsertRowid
    );
    insertService.run(
      ananyaProfileId,
      categoryIds['tutoring'],
      'In-Person Board & Foundation Coaching',
      'Focused 90-minute home visit for Class 9–12 CBSE/ICSE Mathematics, Physics, or competitive foundation prep.',
      95000,
      90,
      'in_person'
    );

    const sVikram1 = Number(
      insertService.run(
        vikramProfileId,
        categoryIds['appliance-repair'],
        'On-Site Appliance Diagnostic Visit',
        'Full inspection of refrigerator, front-load washing machine, dryer, or microwave with a written estimate before any repair.',
        49900,
        60,
        'in_person'
      ).lastInsertRowid
    );
    insertService.run(
      vikramProfileId,
      categoryIds['appliance-repair'],
      'Virtual Pre-Visit Error Code Triage',
      '30-minute video diagnostic to inspect washer/fridge error codes, unusual vibrations, and check whether a reset or part is needed.',
      24900,
      30,
      'remote'
    );

    // 5. Availability Slots for the next 8 days
    const insertSlot = db.prepare(`
      INSERT INTO availability_slots (provider_id, slot_date, start_time, end_time, is_booked, is_blocked)
      VALUES (?, ?, ?, ?, 0, 0)
    `);

    const providerIds = [rajeshProfileId, kavithaProfileId, lakshmiProfileId, ananyaProfileId, vikramProfileId];
    const standardWindows: Array<[string, string]> = [
      ['09:00', '10:30'],
      ['11:00', '12:30'],
      ['14:00', '15:30'],
      ['16:30', '18:00'],
    ];

    const slotLookup: Record<string, number> = {};
    for (const pid of providerIds) {
      for (let dayOffset = 1; dayOffset <= 8; dayOffset++) {
        const dateStr = addDaysIso(dayOffset);
        const windows = pid === ananyaProfileId
          ? [...standardWindows, ['18:30', '19:30'] as [string, string]]
          : standardWindows;
        for (const [start, end] of windows) {
          if (pid === rajeshProfileId && dayOffset === 3 && start === '14:00') continue;
          const info = insertSlot.run(pid, dateStr, start, end);
          slotLookup[`${pid}:${dayOffset}:${start}`] = Number(info.lastInsertRowid);
        }
      }
    }

    // Historical completed slots for seeded completed bookings & reviews
    const pastDate1 = addDaysIso(-4);
    const pastDate2 = addDaysIso(-2);
    const pastSlotRajesh = Number(insertSlot.run(rajeshProfileId, pastDate1, '09:00', '10:30').lastInsertRowid);
    const pastSlotKavitha = Number(insertSlot.run(kavithaProfileId, pastDate2, '11:00', '12:30').lastInsertRowid);
    const pastSlotLakshmi = Number(insertSlot.run(lakshmiProfileId, pastDate1, '14:00', '16:30').lastInsertRowid);
    const pastSlotAnanya = Number(insertSlot.run(ananyaProfileId, pastDate2, '16:30', '17:30').lastInsertRowid);
    const pastSlotVikram = Number(insertSlot.run(vikramProfileId, pastDate1, '11:00', '12:00').lastInsertRowid);

    db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id IN (?, ?, ?, ?, ?)').run(
      pastSlotRajesh,
      pastSlotKavitha,
      pastSlotLakshmi,
      pastSlotAnanya,
      pastSlotVikram
    );

    // 6. Seed Bookings
    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        reference_code, customer_id, provider_id, service_id, slot_id,
        booking_date, start_time, end_time, service_mode, service_address,
        customer_name, customer_email, customer_phone, notes, total_price_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const b1 = Number(
      insertBooking.run(
        'SM-104821',
        customer1Id,
        rajeshProfileId,
        sRajesh1,
        pastSlotRajesh,
        pastDate1,
        '09:00',
        '10:30',
        'in_person',
        'Flat 302, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        'Aarav Mehta',
        'customer@servicemate.demo',
        '+91 98450 24180',
        'Replacing kitchen sink mixer; new Jaquar fitting is ready at home.',
        89900,
        'completed'
      ).lastInsertRowid
    );

    const b2 = Number(
      insertBooking.run(
        'SM-104839',
        customer2Id,
        kavithaProfileId,
        sKavitha1,
        pastSlotKavitha,
        pastDate2,
        '11:00',
        '12:30',
        'in_person',
        '44, 4th Block, Jayanagar, Bengaluru',
        'Priya Nair',
        'priya@servicemate.demo',
        '+91 98451 67320',
        'Two 16A kitchen sockets near microwave need replacement.',
        79900,
        'completed'
      ).lastInsertRowid
    );

    const b3 = Number(
      insertBooking.run(
        'SM-104855',
        customer1Id,
        lakshmiProfileId,
        sLakshmi1,
        pastSlotLakshmi,
        pastDate1,
        '14:00',
        '16:30',
        'in_person',
        'Flat 302, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        'Aarav Mehta',
        'customer@servicemate.demo',
        '+91 98450 24180',
        'Please focus on balcony glass doors and guest bathroom tiles.',
        149900,
        'completed'
      ).lastInsertRowid
    );

    const b4 = Number(
      insertBooking.run(
        'SM-104872',
        customer2Id,
        ananyaProfileId,
        sAnanya1,
        pastSlotAnanya,
        pastDate2,
        '16:30',
        '17:30',
        'remote',
        'Remote Video Session',
        'Priya Nair',
        'priya@servicemate.demo',
        '+91 98451 67320',
        'Class 12 Calculus integration practice problems.',
        65000,
        'completed'
      ).lastInsertRowid
    );

    const b5 = Number(
      insertBooking.run(
        'SM-104889',
        customer2Id,
        vikramProfileId,
        sVikram1,
        pastSlotVikram,
        pastDate1,
        '11:00',
        '12:00',
        'in_person',
        'B-704, Palm Meadows Phase 2, Whitefield, Bengaluru',
        'Priya Nair',
        'priya@servicemate.demo',
        '+91 98451 67320',
        'Front-load washing machine showing E20 drain error mid-spin.',
        49900,
        'completed'
      ).lastInsertRowid
    );

    // Upcoming active bookings
    const upcomingSlot1 = slotLookup[`${rajeshProfileId}:2:09:00`];
    const upcomingSlot2 = slotLookup[`${kavithaProfileId}:2:14:00`];
    const upcomingSlot3 = slotLookup[`${ananyaProfileId}:1:16:30`];

    if (upcomingSlot1) {
      db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ?').run(upcomingSlot1);
      insertBooking.run(
        'SM-209114',
        customer1Id,
        rajeshProfileId,
        sRajesh1,
        upcomingSlot1,
        addDaysIso(2),
        '09:00',
        '10:30',
        'in_person',
        'Flat 302, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        'Aarav Mehta',
        'customer@servicemate.demo',
        '+91 98450 24180',
        'Utility sink angle valve is stiff; please inspect during mixer installation.',
        89900,
        'confirmed'
      );
    }

    if (upcomingSlot2) {
      db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ?').run(upcomingSlot2);
      insertBooking.run(
        'SM-209138',
        customer1Id,
        kavithaProfileId,
        sKavitha1,
        upcomingSlot2,
        addDaysIso(2),
        '14:00',
        '15:30',
        'in_person',
        'Flat 302, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        'Aarav Mehta',
        'customer@servicemate.demo',
        '+91 98450 24180',
        'Hallway fan regulator hums slightly at low speed.',
        79900,
        'pending'
      );
    }

    if (upcomingSlot3) {
      db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ?').run(upcomingSlot3);
      insertBooking.run(
        'SM-209152',
        customer2Id,
        ananyaProfileId,
        sAnanya1,
        upcomingSlot3,
        addDaysIso(1),
        '16:30',
        '17:30',
        'remote',
        'Remote Video Session',
        'Priya Nair',
        'priya@servicemate.demo',
        '+91 98451 67320',
        'Pre-board Physics optics numericals revision.',
        65000,
        'pending'
      );
    }

    // 7. Reviews
    const insertReview = db.prepare(`
      INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertReview.run(
      b1,
      customer1Id,
      rajeshProfileId,
      5,
      'Rajesh arrived sharp at 9 AM, fitted the kitchen mixer cleanly, and tested water pressure for any seepage before leaving.'
    );
    insertReview.run(
      b2,
      customer2Id,
      kavithaProfileId,
      5,
      'Kavitha traced why our 16A kitchen point kept tripping, replaced the burnt socket neatly, and labelled the MCB box.'
    );
    insertReview.run(
      b3,
      customer1Id,
      lakshmiProfileId,
      5,
      'Very thorough work without harsh chemical smells. Bathroom fittings and granite kitchen counters looked spotless.'
    );
    insertReview.run(
      b4,
      customer2Id,
      ananyaProfileId,
      5,
      'Ananya explained integration shortcuts clearly on the whiteboard and shared crisp practice notes right after class.'
    );
    insertReview.run(
      b5,
      customer2Id,
      vikramProfileId,
      4,
      'Quickly cleared the blocked washer drain pump filter and explained preventive care without pushing unnecessary parts.'
    );
  });

  transaction();
  return { seeded: true };
}
