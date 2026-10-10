import type { FastifyInstance } from 'fastify';
import { getSupabaseAdmin, createUserClient } from '../index.js';
import { z } from 'zod';
import { DeploymentSchema, VersionSchema } from '@patchwork/shared';

// For simplicity, defining schemas for requests
const DeployRequestSchema = z.object({
  patch_ids: z.array(z.string().uuid()),
  canary_percent: z.number().min(0).max(100).default(100),
});

const CanaryErrorSchema = z.object({
  deployment_id: z.string().uuid(),
  error_message: z.string(),
  url: z.string().optional(),
});

// Simple in-memory counter for canary error rates (resets on server restart)
const canaryErrors: Record<string, number> = {};
const CANARY_ERROR_THRESHOLD = 3; // auto-rollback after 3 errors

export async function deployRoutes(app: FastifyInstance) {
  // GET /deployments/live
  app.get('/deployments/live', async (request, reply) => {
    const supabase = getSupabaseAdmin();
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('is_live', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return reply.code(500).send({ error: error.message });
    }
    
    if (!deployment) {
      return reply.send({ live: null });
    }

    // Also fetch the version and patches to return a full payload
    const { data: version } = await supabase
      .from('versions')
      .select('*')
      .eq('id', deployment.version_id)
      .single();

    let patches = [];
    if (version?.patch_ids?.length) {
      const { data: p } = await supabase
        .from('patches')
        .select('*')
        .in('id', version.patch_ids);
      patches = p || [];
    }

    return reply.send({
      deployment,
      version,
      patches,
    });
  });

  // POST /deploy
  app.post('/deploy', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'Missing token' });

    const client = createUserClient(token);
    const { data: user, error: userError } = await client.auth.getUser();
    if (userError || !user?.user) return reply.code(401).send({ error: 'Invalid token' });

    const parsed = DeployRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { patch_ids } = parsed.data;
    const supabase = getSupabaseAdmin();

    // 1. Get highest version number
    const { data: lastVersion } = await supabase
      .from('versions')
      .select('number')
      .order('number', { ascending: false })
      .limit(1)
      .single();
    
    const nextNumber = (lastVersion?.number || 0) + 1;

    // 2. Create version
    const { data: version, error: vErr } = await supabase
      .from('versions')
      .insert({
        number: nextNumber,
        patch_ids,
        created_by: user.user.id,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (vErr) return reply.code(500).send({ error: vErr.message });

    // 3. Mark old deployments as not live
    await supabase.from('deployments').update({ is_live: false }).eq('is_live', true);

    // 4. Create new deployment
    const { data: deployment, error: dErr } = await supabase
      .from('deployments')
      .insert({
        version_id: version.id,
        is_live: true,
        canary_percent: parsed.data.canary_percent,
      })
      .select()
      .single();

    if (dErr) return reply.code(500).send({ error: dErr.message });

    // 5. Audit event
    await supabase.from('audit_events').insert({
      actor_id: user.user.id,
      event_type: 'deployment_created',
      entity_id: deployment.id,
      details: { version_number: version.number }
    });

    return reply.send({ version, deployment });
  });

  // POST /rollback
  app.post('/rollback', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'Missing token' });

    const client = createUserClient(token);
    const { data: user, error: userError } = await client.auth.getUser();
    if (userError || !user?.user) return reply.code(401).send({ error: 'Invalid token' });

    const supabase = getSupabaseAdmin();

    // Find current live deployment
    const { data: current } = await supabase
      .from('deployments')
      .select('*')
      .eq('is_live', true)
      .single();

    if (!current) {
      return reply.code(400).send({ error: 'No live deployment to rollback' });
    }

    // Set it to not live and set rolled_back_at
    await supabase
      .from('deployments')
      .update({ is_live: false, rolled_back_at: new Date().toISOString() })
      .eq('id', current.id);

    // Audit event
    await supabase.from('audit_events').insert({
      actor_id: user.user.id,
      event_type: 'deployment_rolled_back',
      entity_id: current.id,
      details: { rolled_back_version_id: current.version_id }
    });

    return reply.send({ success: true, rolled_back_deployment: current });
  });

  // POST /canary/error — extension reports a JS error encountered in canary bucket
  app.post('/canary/error', async (request, reply) => {
    const parsed = CanaryErrorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { deployment_id, error_message, url } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Increment error counter
    canaryErrors[deployment_id] = (canaryErrors[deployment_id] || 0) + 1;
    const count = canaryErrors[deployment_id];

    // Audit every error
    await supabase.from('audit_events').insert({
      actor_id: 'system',
      event_type: 'patch_broken',
      entity_id: deployment_id,
      details: { error_message, url, count },
    });

    // Auto-rollback if threshold exceeded
    if (count >= CANARY_ERROR_THRESHOLD) {
      const { data: current } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deployment_id)
        .eq('is_live', true)
        .single();

      if (current) {
        await supabase
          .from('deployments')
          .update({ is_live: false, rolled_back_at: new Date().toISOString() })
          .eq('id', deployment_id);

        await supabase.from('audit_events').insert({
          actor_id: 'system',
          event_type: 'deployment_rolled_back',
          entity_id: deployment_id,
          details: { reason: 'canary_error_threshold_exceeded', count },
        });

        delete canaryErrors[deployment_id];
        return reply.send({ action: 'rolled_back', count });
      }
    }

    return reply.send({ action: 'error_recorded', count });
  });
}
