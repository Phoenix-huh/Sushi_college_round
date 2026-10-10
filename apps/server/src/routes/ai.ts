import type { FastifyInstance } from 'fastify';
import { getSupabaseAdmin, createUserClient } from '../index.js';
import { generatePatchFromInstruction } from '../services/ai.js';
import { z } from 'zod';

const AIPatchRequestSchema = z.object({
  instruction: z.string().min(5).max(500),
  element_context: z.string(),
  target_url: z.string().url(),
  author_id: z.string().uuid().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  // POST /ai/patch — NL instruction → validated draft patch (never auto-applied)
  app.post('/ai/patch', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'Missing token' });

    const client = createUserClient(token);
    const { data: user, error: userError } = await client.auth.getUser();
    if (userError || !user?.user) return reply.code(401).send({ error: 'Invalid token' });

    const parsed = AIPatchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { instruction, element_context, target_url } = parsed.data;

    // Generate draft patch from AI
    let generatedPatch;
    try {
      generatedPatch = await generatePatchFromInstruction(instruction, element_context);
    } catch (e: any) {
      return reply.code(422).send({ error: 'AI generation failed: ' + e.message });
    }

    // Ensure target_url is set from request
    generatedPatch.target_url = target_url;

    // Save as a DRAFT (never auto-applied, requires reviewer approval)
    const supabase = getSupabaseAdmin();
    const { data: patch, error: patchErr } = await supabase
      .from('patches')
      .insert({
        ...generatedPatch,
        author_id: user.user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (patchErr) return reply.code(500).send({ error: patchErr.message });

    // Audit event
    await supabase.from('audit_events').insert({
      actor_id: user.user.id,
      event_type: 'patch_created',
      entity_id: patch.id,
      details: { source: 'ai', instruction },
    });

    return reply.send({ draft: patch, instruction });
  });
}
