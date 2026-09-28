import { supabase } from './supabase';

/**
 * Ensures a `profiles` row and a `residents` row exist for the given user.
 * Safe to call as many times as you want.
 *
 * Call this defensively at the start of any flow that depends on the
 * `residents` row existing (adding an emergency contact, saving a home
 * location, etc.) rather than relying on it having been created exactly
 * once during signup - that one-shot approach has proven fragile in
 * practice (hot reloads, back-navigation, or any future onboarding change
 * can skip the step that normally creates it).
 */
export async function ensureResidentRecord(userId: string, fullName?: string): Promise<void> {
  // profiles.full_name is NOT NULL, so we can't blindly upsert with an
  // undefined name - check whether the row already exists first, and only
  // insert (with a fallback name) if it genuinely doesn't.
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('ensureResidentRecord: failed to check for existing profile:', fetchError.message);
    throw fetchError;
  }

  if (!existingProfile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: 'RESIDENT',
      full_name: fullName ?? 'Resident',
    });

    if (profileError) {
      console.error('ensureResidentRecord: failed to create profile:', profileError.message);
      throw profileError;
    }
  }

  const { error: residentError } = await supabase.from('residents').upsert({
    user_id: userId,
  });

  if (residentError) {
    console.error('ensureResidentRecord: failed to upsert resident:', residentError.message);
    throw residentError;
  }
}