const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://arvyilhrnjogzxzffvli.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydnlpbGhybmpvZ3p4emZmdmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MTk4NDUsImV4cCI6MjA3OTA5NTg0NX0.YgaMjWU8lSi-g9r_HQAShMfMmY6cafIlpnBhuKgwoEI'
);

(async () => {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, email, password, name');
  
  console.log('Usuarios en Supabase:');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
})();
