#!/usr/bin/env node
/**
 * Seed the eminent_readers table.
 *
 *  Prerequisite: run scripts/eminent-readers-table.sql in the Supabase
 *  SQL editor ONCE (creates the table + RLS policies + index).
 *
 *  Usage:
 *    SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/seed-eminent-readers.mjs
 *
 *  Idempotent: upserts on `name` so re-running updates rows rather than
 *  duplicating. Photo URL is the transparent-bg PNG specified by the user;
 *  swap individual rows from the SQL editor whenever you have real photos.
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// Fallback portrait used when we don't yet have a real photo for a
// reader. Real photos override per-row via `photo_url`.
const PLACEHOLDER_PHOTO = 'https://freepngimg.com/download/narendra_modi/7-2-narendra-modi-transparent.png';

const readers = [
  { name: 'Narendra Modi',     designation: 'Prime Minister of India',
    photo_url: 'https://freepngimg.com/download/narendra_modi/7-2-narendra-modi-transparent.png',
    linkedin_url: 'https://www.linkedin.com/in/narendramodi/',
    twitter_url:  'https://twitter.com/narendramodi',
    instagram_url: 'https://www.instagram.com/narendramodi/',
    facebook_url:  'https://www.facebook.com/narendramodi',
    order_index: 1 },
  { name: 'Nithin Kamath',     designation: 'Founder & CEO, Zerodha',
    photo_url: 'https://i.ibb.co/S4NMV44p/image.png',
    linkedin_url: 'https://www.linkedin.com/in/nithinkamath/',
    twitter_url:  'https://twitter.com/Nithin0dha',
    instagram_url: null,
    order_index: 2 },
  { name: 'Falguni Nayar',     designation: 'Founder & CEO, Nykaa',
    photo_url: 'https://i.ibb.co/67dN2dFD/image.png',
    linkedin_url: 'https://www.linkedin.com/in/falguninayar/',
    twitter_url:  'https://twitter.com/falguni_nayar',
    instagram_url: 'https://www.instagram.com/mynykaa/',
    order_index: 3 },
  { name: 'Kunal Shah',        designation: 'Founder, Cred',
    photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Kunal_Shah_in_FreeCharge_T-Shirt_%28cropped%29.jpg/250px-Kunal_Shah_in_FreeCharge_T-Shirt_%28cropped%29.jpg',
    linkedin_url: 'https://www.linkedin.com/in/kunalshah1/',
    twitter_url:  'https://twitter.com/kunalb11',
    instagram_url: null,
    order_index: 4 },
  { name: 'Bhavish Aggarwal',  designation: 'Co-founder, Ola',
    // No free-license portrait available; use placeholder until provided.
    linkedin_url: 'https://www.linkedin.com/in/bhavishaggarwal/',
    twitter_url:  'https://twitter.com/bhash',
    instagram_url: null,
    order_index: 5 },
  { name: 'Sridhar Vembu',     designation: 'Founder & CEO, Zoho',
    // No free-license portrait available; use placeholder until provided.
    linkedin_url: 'https://www.linkedin.com/in/sridhar-vembu/',
    twitter_url:  'https://twitter.com/svembu',
    instagram_url: null,
    order_index: 6 },
  { name: 'Ghazal Alagh',      designation: 'Co-founder, Mamaearth',
    // No free-license portrait available; use placeholder until provided.
    linkedin_url: 'https://www.linkedin.com/in/ghazal-alagh/',
    twitter_url:  null,
    instagram_url: 'https://www.instagram.com/ghazalalagh/',
    order_index: 7 },
  { name: 'Aman Gupta',        designation: 'Co-founder, boAt Lifestyle',
    photo_url: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Aman_Gupta_of_boAt_Lifestyle.jpg',
    linkedin_url: 'https://www.linkedin.com/in/aman-gupta-/',
    twitter_url:  'https://twitter.com/AmanGuptaBoat',
    instagram_url: 'https://www.instagram.com/boat.nirvana/',
    order_index: 8 },
];

(async () => {
  // First check the table exists. If not, give a useful error.
  const probe = await fetch(`${BASE}/rest/v1/eminent_readers?select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (probe.status === 404 || probe.status === 400) {
    console.error('eminent_readers table not found. Run scripts/eminent-readers-table.sql in the Supabase SQL editor first.');
    process.exit(2);
  }

  const rows = readers.map(r => ({
    name: r.name,
    designation: r.designation,
    photo_url: r.photo_url || PLACEHOLDER_PHOTO,
    linkedin_url: r.linkedin_url || null,
    twitter_url: r.twitter_url || null,
    instagram_url: r.instagram_url || null,
    facebook_url: r.facebook_url || null,
    order_index: r.order_index,
    active: true,
  }));

  // We don't have a UNIQUE constraint on name, so a simple upsert by name
  // isn't possible via on_conflict. Instead: wipe + insert (single trip).
  console.log('Clearing existing eminent_readers rows…');
  const del = await fetch(`${BASE}/rest/v1/eminent_readers?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=minimal' },
  });
  if (!del.ok && del.status !== 404) {
    console.error('Delete failed:', del.status, await del.text()); process.exit(1);
  }

  console.log(`Inserting ${rows.length} readers…`);
  const ins = await fetch(`${BASE}/rest/v1/eminent_readers`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!ins.ok) { console.error('Insert failed:', ins.status, await ins.text()); process.exit(1); }
  const created = await ins.json();
  console.log(`\n✓ ${created.length} eminent readers ready:\n`);
  for (const r of created.sort((a, b) => a.order_index - b.order_index)) {
    const socials = [
      r.linkedin_url ? 'in' : '  ',
      r.twitter_url ? ' X' : '  ',
      r.instagram_url ? 'IG' : '  ',
    ].join(' ');
    console.log(`  ${String(r.order_index).padStart(2)}. ${r.name.padEnd(22)} ${socials}  ${r.designation}`);
  }
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
