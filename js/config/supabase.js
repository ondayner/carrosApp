import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Sustituye con tus credenciales de proyecto en Supabase
const SUPABASE_URL = 'https://zebkdiyeslvdpesbinem.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYmtkaXllc2x2ZHBlc2JpbmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTM5MTgsImV4cCI6MjEwNTU4OTkxOH0.RH9kD2yGSNURUkvoJA4ZiRGVT1z7V_GHRzp9h2OCRdk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);