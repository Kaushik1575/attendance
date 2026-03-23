import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  console.log('--- Checking Database ---');
  
  const { data: students, error: sErr } = await supabase.from('students').select('roll_no, email');
  if (sErr) console.error('Student fetch error:', sErr);
  else {
    console.log('Students:', students.length);
    students.forEach(s => console.log(`  - Roll: ${s.roll_no}, Email: ${s.email}`));
  }

  const { data: teachers, error: tErr } = await supabase.from('teachers').select('username, email');
  if (tErr) console.error('Teacher fetch error:', tErr);
  else {
    console.log('Teachers:', teachers.length);
    teachers.forEach(t => console.log(`  - User: ${t.username}, Email: ${t.email}`));
  }
}

checkAll();
