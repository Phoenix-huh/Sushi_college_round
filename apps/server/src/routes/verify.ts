import type { FastifyInstance } from 'fastify';
import { getSupabaseAdmin, createUserClient } from '../index.js';
import { verifyPatches } from '../services/verifier.js';

export async function verifyRoutes(app: FastifyInstance) {
  app.post('/verify', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'Missing token' });

    const client = createUserClient(token);
    const { data: user, error: userError } = await client.auth.getUser();
    if (userError || !user?.user) return reply.code(401).send({ error: 'Invalid token' });

    const { version_id } = request.body as { version_id: string };
    if (!version_id) {
      return reply.code(400).send({ error: 'Missing version_id' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get version and patches
    const { data: version } = await supabase
      .from('versions')
      .select('*')
      .eq('id', version_id)
      .single();

    if (!version) return reply.code(404).send({ error: 'Version not found' });

    let patches = [];
    if (version.patch_ids?.length) {
      const { data: p } = await supabase
        .from('patches')
        .select('*')
        .in('id', version.patch_ids);
      patches = p || [];
    }

    // 2. Run verification
    // For demo purposes, we verify against localhost demo site
    const targetUrl = patches[0]?.target_url || 'http://localhost:5173';
    const result = await verifyPatches(targetUrl, patches);

    const newStatus = result.passed ? 'passed' : 'failed';

    // 3. Update version status
    await supabase
      .from('versions')
      .update({ verification_status: newStatus })
      .eq('id', version_id);

    // 4. Audit event
    await supabase.from('audit_events').insert({
      actor_id: user.user.id,
      event_type: result.passed ? 'verification_passed' : 'verification_failed',
      entity_id: version_id,
      details: { diffPixels: result.diffPixels, error: result.error }
    });

    // 5. Auto-rollback if failed
    if (!result.passed) {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('*')
        .eq('version_id', version_id)
        .eq('is_live', true)
        .single();

      if (deployment) {
        await supabase
          .from('deployments')
          .update({ is_live: false, rolled_back_at: new Date().toISOString() })
          .eq('id', deployment.id);
          
        await supabase.from('audit_events').insert({
          actor_id: 'system',
          event_type: 'deployment_rolled_back',
          entity_id: deployment.id,
          details: { reason: 'verification_failed' }
        });
      }
    }

    return reply.send(result);
  });
}
