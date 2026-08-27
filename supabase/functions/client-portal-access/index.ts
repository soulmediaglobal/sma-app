import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          pic_email: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          pic_email?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          pic_email?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          role: string;
          client_id: string | null;
          account_status: string;
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          role: string;
          client_id?: string | null;
          account_status?: string;
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          role?: string;
          client_id?: string | null;
          account_status?: string;
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type Profile = Pick<ProfileRow, 'id' | 'email' | 'role' | 'client_id' | 'account_status'>;
type AccessStatus = 'NOT_INVITED' | 'INVITED' | 'ACTIVE' | 'DISABLED';
type FailureCode =
  | 'CLIENT_NOT_FOUND'
  | 'MULTIPLE_LINKED_ACCOUNTS'
  | 'LINKED_ACCOUNT_NOT_CLIENT'
  | 'AMBIGUOUS_EMAIL'
  | 'EMAIL_BELONGS_TO_STAFF'
  | 'ACCOUNT_LINKED_TO_OTHER_CLIENT'
  | 'PIC_EMAIL_REQUIRED'
  | 'ACCOUNT_ALREADY_LINKED'
  | 'LINK_CONFIRMATION_REQUIRED'
  | 'EXISTING_ACCOUNT_NOT_ACTIVE'
  | 'STALE_ACCESS_STATE'
  | 'ACCOUNT_NOT_LINKED'
  | 'PIC_EMAIL_MISMATCH';

type FailureResult = {
  ok: false;
  error: FailureCode;
  httpStatus: number;
};

type LinkedSnapshot = {
  ok: true;
  kind: 'linked';
  client: ClientRow;
  email: string;
  linkedEmail: string;
  emailMatches: boolean;
  profile: Profile;
  user: User;
  status: AccessStatus;
};

type CandidateSnapshot = {
  ok: true;
  kind: 'candidate';
  client: ClientRow;
  email: string;
  status: 'NOT_INVITED';
  requiresLinkConfirmation: true;
  candidate: Profile;
};

type UnlinkedSnapshot = {
  ok: true;
  kind: 'unlinked';
  client: ClientRow;
  email: string;
  status: 'NOT_INVITED';
  requiresLinkConfirmation: false;
};

type AccessSnapshot = FailureResult | LinkedSnapshot | CandidateSnapshot | UnlinkedSnapshot;

type ActionSuccess = {
  ok: true;
  status: AccessStatus;
  linkedExisting?: boolean;
};

type ActionResult = FailureResult | ActionSuccess;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_ROLES = new Set(['admin', 'supervisor', 'internal']);
const ACCESS_ROLES = new Set(['admin', 'supervisor']);
const ACTIONS = new Set(['status', 'invite', 'resend', 'disable', 'reactivate']);

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const clientPortalBaseUrl = Deno.env.get('CLIENT_PORTAL_BASE_URL') || '';
const configuredOrigins = (Deno.env.get('CLIENT_PORTAL_ACCESS_ALLOWED_ORIGINS') || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  'http://localhost:9173',
  'http://127.0.0.1:9173',
  'https://team.soulmitra.id',
  ...configuredOrigins
]);

function runtimeConfigurationError() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientPortalBaseUrl) {
    return 'MISSING_ENVIRONMENT';
  }

  try {
    const apiUrl = new URL(supabaseUrl);
    const portalUrl = new URL(clientPortalBaseUrl);
    if (apiUrl.protocol !== 'https:') {
      return 'INVALID_SUPABASE_URL';
    }
    if (
      portalUrl.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(portalUrl.hostname)
    ) {
      return 'INVALID_CLIENT_PORTAL_URL';
    }
    for (const origin of configuredOrigins) {
      const parsed = new URL(origin);
      if (
        parsed.origin !== origin ||
        (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname))
      ) {
        return 'INVALID_ALLOWED_ORIGIN';
      }
    }
  } catch {
    return 'INVALID_ENVIRONMENT_URL';
  }

  return '';
}

const configurationError = runtimeConfigurationError();
let adminClient: SupabaseClient<Database> | null = null;
let publicAuthClient: SupabaseClient<Database> | null = null;

function admin(): SupabaseClient<Database> {
  if (configurationError) {
    throw new Error('Runtime configuration tidak valid.');
  }
  adminClient ||= createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

function publicAuth(): SupabaseClient<Database> {
  if (configurationError) {
    throw new Error('Runtime configuration tidak valid.');
  }
  publicAuthClient ||= createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return publicAuthClient;
}

function failure(error: FailureCode, httpStatus: number): FailureResult {
  return { ok: false, error, httpStatus };
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
  requestId: string
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-ID': requestId
    }
  });
}

function safeLog(
  level: 'info' | 'error',
  requestId: string,
  event: string,
  details: Record<string, string> = {}
) {
  const entry = JSON.stringify({ requestId, event, ...details });
  if (level === 'error') {
    console.error(entry);
  } else {
    console.info(entry);
  }
}

function isRateLimitError(error: unknown) {
  const candidate = error as { status?: number; code?: string; message?: string } | null;
  return (
    candidate?.status === 429 ||
    candidate?.code === 'over_email_send_rate_limit' ||
    String(candidate?.message || '')
      .toLowerCase()
      .includes('rate limit')
  );
}

function fixedSetPasswordUrl() {
  const base = new URL(clientPortalBaseUrl);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw new Error('CLIENT_PORTAL_BASE_URL tidak aman.');
  }
  return new URL('production/client-set-password.html', base).href;
}

async function callerProfile(authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return null;
  }

  const { data: userData, error: userError } = await admin().auth.getUser(token);
  if (userError || !userData.user) {
    return null;
  }

  const { data, error } = await admin()
    .from('profiles')
    .select('id, email, role, client_id, account_status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error || !data || data.account_status !== 'ACTIVE' || !STAFF_ROLES.has(data.role)) {
    return null;
  }
  return data as Profile;
}

async function loadClient(clientId: string) {
  const { data, error } = await admin()
    .from('clients')
    .select('id, name, pic_email')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

async function linkedProfiles(clientId: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select('id, email, role, client_id, account_status')
    .eq('client_id', clientId)
    .limit(2);

  if (error) {
    throw error;
  }
  return (data || []) as Profile[];
}

async function profilesForEmail(email: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select('id, email, role, client_id, account_status')
    .eq('email', email)
    .limit(2);

  if (error) {
    throw error;
  }
  return (data || []) as Profile[];
}

async function authUser(profileId: string) {
  const { data, error } = await admin().auth.admin.getUserById(profileId);
  if (error || !data.user) {
    throw error || new Error('Auth user tidak ditemukan.');
  }
  return data.user;
}

function normalizedEmail(value: unknown) {
  const email = String(value || '')
    .trim()
    .toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : '';
}

async function accessSnapshot(clientId: string): Promise<AccessSnapshot> {
  const client = await loadClient(clientId);
  if (!client) {
    return failure('CLIENT_NOT_FOUND', 404);
  }

  const email = normalizedEmail(client.pic_email);
  const linked = await linkedProfiles(clientId);
  if (linked.length > 1) {
    return failure('MULTIPLE_LINKED_ACCOUNTS', 409);
  }

  if (linked.length === 1) {
    const profile = linked[0];
    if (profile.role !== 'client') {
      return failure('LINKED_ACCOUNT_NOT_CLIENT', 409);
    }
    const user = await authUser(profile.id);
    const linkedEmail = normalizedEmail(profile.email || user.email);
    const status =
      profile.account_status !== 'ACTIVE'
        ? 'DISABLED'
        : user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at
          ? 'ACTIVE'
          : 'INVITED';

    return {
      ok: true,
      kind: 'linked',
      client,
      email,
      linkedEmail,
      emailMatches: Boolean(email && linkedEmail === email),
      profile,
      user,
      status
    };
  }

  if (!email) {
    return {
      ok: true,
      kind: 'unlinked',
      client,
      email: '',
      status: 'NOT_INVITED',
      requiresLinkConfirmation: false
    };
  }

  const matches = await profilesForEmail(email);
  if (matches.length > 1) {
    return failure('AMBIGUOUS_EMAIL', 409);
  }
  if (matches.length === 1) {
    const candidate = matches[0];
    if (candidate.role !== 'client') {
      return failure('EMAIL_BELONGS_TO_STAFF', 409);
    }
    if (candidate.client_id && candidate.client_id !== clientId) {
      return failure('ACCOUNT_LINKED_TO_OTHER_CLIENT', 409);
    }
    return {
      ok: true,
      kind: 'candidate',
      client,
      email,
      status: 'NOT_INVITED',
      requiresLinkConfirmation: true,
      candidate
    };
  }

  return {
    ok: true,
    kind: 'unlinked',
    client,
    email,
    status: 'NOT_INVITED',
    requiresLinkConfirmation: false
  };
}

async function waitForProvisionedProfile(userId: string) {
  for (const delay of [0, 150, 300, 600, 1000]) {
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    const { data, error } = await admin()
      .from('profiles')
      .select('id, email, role, client_id, account_status')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      return data as Profile;
    }
    if (error) {
      throw error;
    }
  }
  return null;
}

async function sendPasswordSetup(email: string) {
  return publicAuth().auth.resetPasswordForEmail(email, {
    redirectTo: fixedSetPasswordUrl()
  });
}

async function cleanupCreatedAuthUser(userId: string, requestId: string) {
  const { data: profile, error: profileError } = await admin()
    .from('profiles')
    .select('client_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || profile?.client_id) {
    safeLog('error', requestId, 'invite_cleanup_skipped', {
      reason: profileError ? 'profile_lookup_failed' : 'profile_already_linked'
    });
    return;
  }

  const { data: userData, error: userError } = await admin().auth.admin.getUserById(userId);
  if (
    userError ||
    !userData.user ||
    userData.user.user_metadata?.source !== 'client_portal_invitation'
  ) {
    safeLog('error', requestId, 'invite_cleanup_skipped', {
      reason: userError ? 'auth_lookup_failed' : 'ownership_not_verified'
    });
    return;
  }

  const { error: deleteError } = await admin().auth.admin.deleteUser(userId);
  safeLog(deleteError ? 'error' : 'info', requestId, 'invite_cleanup_completed', {
    result: deleteError ? 'failed' : 'deleted'
  });
}

async function invite(
  clientId: string,
  confirmExisting: boolean,
  requestId: string
): Promise<ActionResult> {
  const snapshot = await accessSnapshot(clientId);
  if (!snapshot.ok) {
    return snapshot;
  }
  if (!snapshot.email) {
    return failure('PIC_EMAIL_REQUIRED', 422);
  }

  if (snapshot.kind === 'linked') {
    return failure('ACCOUNT_ALREADY_LINKED', 409);
  }

  if (snapshot.kind === 'candidate') {
    if (!confirmExisting) {
      return failure('LINK_CONFIRMATION_REQUIRED', 409);
    }
    if (snapshot.candidate.account_status !== 'ACTIVE') {
      return failure('EXISTING_ACCOUNT_NOT_ACTIVE', 409);
    }

    const { data: linkedProfile, error: linkError } = await admin()
      .from('profiles')
      .update({ client_id: clientId })
      .eq('id', snapshot.candidate.id)
      .is('client_id', null)
      .eq('role', 'client')
      .select('id')
      .maybeSingle();
    if (linkError) {
      throw linkError;
    }
    if (!linkedProfile) {
      return failure('STALE_ACCESS_STATE', 409);
    }
    const { error: emailError } = await sendPasswordSetup(snapshot.email);
    if (emailError) {
      throw emailError;
    }
    return { ok: true, status: 'ACTIVE', linkedExisting: true };
  }

  const { data, error } = await admin().auth.admin.inviteUserByEmail(snapshot.email, {
    redirectTo: fixedSetPasswordUrl(),
    data: { source: 'client_portal_invitation' }
  });
  if (error || !data.user) {
    throw error || new Error('Invitation gagal dibuat.');
  }

  try {
    const profile = await waitForProvisionedProfile(data.user.id);
    if (!profile || profile.role !== 'client' || profile.client_id) {
      throw new Error('Profile invitation tidak dapat ditautkan.');
    }
    const { data: linkedProfile, error: linkError } = await admin()
      .from('profiles')
      .update({ client_id: clientId })
      .eq('id', profile.id)
      .is('client_id', null)
      .eq('role', 'client')
      .select('id')
      .maybeSingle();
    if (linkError || !linkedProfile) {
      throw linkError || new Error('Profile invitation tidak dapat ditautkan.');
    }
  } catch (linkFailure) {
    await cleanupCreatedAuthUser(data.user.id, requestId);
    throw linkFailure;
  }

  return { ok: true, status: 'INVITED', linkedExisting: false };
}

async function resend(clientId: string): Promise<ActionResult> {
  const snapshot = await accessSnapshot(clientId);
  if (!snapshot.ok) {
    return snapshot;
  }
  if (snapshot.kind !== 'linked') {
    return failure('ACCOUNT_NOT_LINKED', 409);
  }
  if (!snapshot.email || !snapshot.emailMatches) {
    return failure('PIC_EMAIL_MISMATCH', 409);
  }
  const { error } = await sendPasswordSetup(snapshot.email);
  if (error) {
    throw error;
  }
  return { ok: true, status: snapshot.status };
}

async function changeAccess(
  clientId: string,
  caller: Profile,
  enabled: boolean
): Promise<ActionResult> {
  const snapshot = await accessSnapshot(clientId);
  if (!snapshot.ok) {
    return snapshot;
  }
  if (snapshot.kind !== 'linked') {
    return failure('ACCOUNT_NOT_LINKED', 409);
  }

  const nextStatus = enabled ? 'ACTIVE' : 'DISABLED';
  const previousStatus = enabled ? 'DISABLED' : 'ACTIVE';
  if (snapshot.profile.account_status !== previousStatus) {
    return failure('STALE_ACCESS_STATE', 409);
  }
  const { data, error } = await admin()
    .from('profiles')
    .update({
      account_status: nextStatus,
      status_changed_at: new Date().toISOString(),
      status_changed_by: caller.id,
      status_reason: enabled
        ? 'Akses Client Portal diaktifkan kembali.'
        : 'Akses Client Portal dinonaktifkan.'
    })
    .eq('id', snapshot.profile.id)
    .eq('client_id', clientId)
    .eq('role', 'client')
    .eq('account_status', previousStatus)
    .select('id')
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return failure('STALE_ACCESS_STATE', 409);
  }

  return { ok: true, status: enabled ? 'ACTIVE' : 'DISABLED' };
}

Deno.serve(async request => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') {
    if (!origin || !allowedOrigins.has(origin)) {
      return json(origin, 403, { error: 'FORBIDDEN', requestId }, requestId);
    }
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(origin), 'X-Request-ID': requestId }
    });
  }
  if (request.method !== 'POST' || !origin || !allowedOrigins.has(origin)) {
    return json(origin, 403, { error: 'FORBIDDEN', requestId }, requestId);
  }
  if (configurationError) {
    safeLog('error', requestId, 'server_configuration_error', { reason: configurationError });
    return json(origin, 500, { error: 'SERVER_CONFIGURATION_ERROR', requestId }, requestId);
  }

  let action = '';
  try {
    const authorization = request.headers.get('Authorization') || '';
    const caller = await callerProfile(authorization);
    if (!caller) {
      return json(origin, 403, { error: 'FORBIDDEN', requestId }, requestId);
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    action = String(body?.action || '');
    const clientId = String(body?.clientId || '');
    if (!ACTIONS.has(action) || !UUID_PATTERN.test(clientId)) {
      return json(origin, 400, { error: 'INVALID_REQUEST', requestId }, requestId);
    }
    if (['disable', 'reactivate'].includes(action) && !ACCESS_ROLES.has(caller.role)) {
      return json(origin, 403, { error: 'FORBIDDEN', requestId }, requestId);
    }

    if (action === 'status') {
      const snapshot = await accessSnapshot(clientId);
      if (!snapshot.ok) {
        return json(origin, snapshot.httpStatus, { error: snapshot.error, requestId }, requestId);
      }
      return json(
        origin,
        200,
        {
          ok: true,
          status: snapshot.status,
          email: snapshot.email || null,
          linkedEmail: snapshot.kind === 'linked' ? snapshot.linkedEmail : null,
          emailMatches: snapshot.kind === 'linked' ? snapshot.emailMatches : true,
          requiresLinkConfirmation:
            snapshot.kind === 'linked' ? false : snapshot.requiresLinkConfirmation,
          canManageAccess: ACCESS_ROLES.has(caller.role),
          requestId
        },
        requestId
      );
    }

    const result =
      action === 'invite'
        ? await invite(clientId, body?.confirmExisting === true, requestId)
        : action === 'resend'
          ? await resend(clientId)
          : await changeAccess(clientId, caller, action === 'reactivate');

    if (!result.ok) {
      return json(origin, result.httpStatus, { error: result.error, requestId }, requestId);
    }
    safeLog('info', requestId, 'request_completed', { action });
    return json(origin, 200, { ...result, requestId }, requestId);
  } catch (error) {
    const rateLimited = isRateLimitError(error);
    safeLog('error', requestId, 'request_failed', {
      action: ACTIONS.has(action) ? action : 'unknown',
      category: rateLimited ? 'rate_limit' : 'internal'
    });
    return json(
      origin,
      rateLimited ? 429 : 500,
      { error: rateLimited ? 'RATE_LIMITED' : 'REQUEST_FAILED', requestId },
      requestId
    );
  }
});
