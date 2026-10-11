import React from 'react';
import type { NodeDetail } from './NodeDetailPanel';
import { HEALING_TIERS, CODEBASE_FACTS } from '../../lib/lifecycle';

interface HealerDiagramProps {
  activeNodeId: string | null;
  onSelectNode: (node: NodeDetail) => void;
}

export function HealerDiagram({ activeNodeId, onSelectNode }: HealerDiagramProps) {
  const healerDetailsMap: Record<string, NodeDetail> = {
    target: {
      id: 'target',
      title: 'Target Element Anchor',
      subtitle: 'Incoming patch locator signature',
      category: 'Targeting',
      badge: `${CODEBASE_FACTS.anchorCount} Anchor Fields`,
      color: 'primary',
      description:
        'When an engineer captures an element via the Chrome extension, 6 complementary anchor coordinates are extracted and packaged into the patch.',
      bullets: [
        `Captured fields: ${CODEBASE_FACTS.anchors.join(', ')}`,
        'Includes parent context and sibling hierarchy to disambiguate identical elements',
        'If target element moves or classes mutate, the 3-tier cascade resolves the new DOM position',
      ],
      code: 'anchors: {\n  cssSelector: "#checkout-btn",\n  xpath: "/html/body/main/div[2]/button",\n  textContent: "Complete Order",\n  attributes: { id: "checkout-btn" }\n}',
    },
    tier1: {
      id: 'tier1',
      title: 'Tier 1: CSS Selector',
      subtitle: 'Exact id, class, or attribute query',
      category: 'Cascade Tier 1',
      badge: 'Primary Resolution',
      color: 'primary',
      description: HEALING_TIERS[0].description,
      bullets: [
        'Executes document.querySelectorAll(cssSelector)',
        'Filters out internal preview banners (#patchwork-preview-banner)',
        'When multiple elements match (e.g. .product-title), pickByText disambiguates by text content',
      ],
      code: 'const matches = document.querySelectorAll(a.cssSelector);\nconst hit = pickByText(matches, a.textContent);',
      meta: {
        Strategy: 'CSS Selector + Text Filter',
        Success: 'Immediate match',
      },
    },
    tier2: {
      id: 'tier2',
      title: 'Tier 2: Structural XPath',
      subtitle: 'DOM hierarchy tree fallback path',
      category: 'Cascade Tier 2',
      badge: 'Structural Fallback',
      color: 'neutral',
      description: HEALING_TIERS[1].description,
      bullets: [
        'Evaluated if CSS selector fails (e.g. dynamic class hash rebuilds)',
        'Executes document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE)',
        'Bypassed if strict text mode is enabled (pw-find=text)',
      ],
      code: 'document.evaluate(a.xpath, document, null,\n  XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue',
      meta: {
        Strategy: 'Hierarchy Walk',
        Scope: 'DOM Tree',
      },
    },
    tier3: {
      id: 'tier3',
      title: 'Tier 3: Fuzzy Token Matcher',
      subtitle: 'Jaccard similarity with synonym map',
      category: 'Cascade Tier 3',
      badge: `Threshold >= ${CODEBASE_FACTS.jaccardHealingThreshold}`,
      color: 'primary',
      description: HEALING_TIERS[2].description,
      bullets: [
        `Computes token Jaccard similarity across id, class, name, and text: threshold >= ${CODEBASE_FACTS.jaccardHealingThreshold}`,
        'Synonym normalization: checkout=order=buy, cart=bag, submit=continue=pay',
        'Container guard: skips elements with > 3 child elements and ignores SCRIPT, STYLE, HTML, BODY',
        `Runtime logs healed score and reports event via POST /patches/:id/healed`,
      ],
      code: 'const score = jaccard(wantTokens, elementTokens(candidate));\nreturn score >= 0.25 ? { el: best, how: "healed", score } : null;',
      meta: {
        Threshold: `>= ${CODEBASE_FACTS.jaccardHealingThreshold}`,
        Normalizer: 'Common eCommerce Synonyms',
      },
    },
    success: {
      id: 'success',
      title: 'Patch Applied Successfully',
      subtitle: 'Changes rendered into live page DOM',
      category: 'Success Outcome',
      badge: 'DOM Mutated',
      color: 'success',
      description:
        'Target element was successfully identified by one of the 3 tiers. The patch operation is applied according to its change type.',
      bullets: [
        'Phase 1 resolves all targets across all active patches first',
        'Phase 2 executes DOM modifications in input order',
        `Supported change types: ${CODEBASE_FACTS.changeTypes.join(', ')}`,
      ],
      code: 'applyChange(targetElement, patch.change);\nconsole.log("[Patchwork] applied via", how);',
      meta: {
        Outcome: 'Active in DOM',
        Persistence: 'Until next version deploy',
      },
    },
    failure: {
      id: 'failure',
      title: 'Patch Skipped (No Match)',
      subtitle: 'Warning logged; DOM left untouched',
      category: 'Failure Outcome',
      badge: 'Score < 0.25',
      color: 'failure',
      description:
        'When neither CSS, XPath, nor fuzzy Jaccard tokens achieve score >= 0.25, the runtime skips the patch to prevent damaging the page layout.',
      bullets: [
        'Does not throw runtime exceptions or halt other active patches',
        'Emits console warning: "[Patchwork] could not find target for patch <id> <selector>"',
        'The unpatched target remains rendered in its natural server-rendered state',
      ],
      code: 'if (!hit) {\n  console.warn("[Patchwork] could not find target for patch", patch.id);\n  return;\n}',
      meta: {
        Safety: 'Zero page crashes',
        Behavior: 'Silent skip with warning',
      },
    },
    synonyms: {
      id: 'synonyms',
      title: 'Synonym Dictionary Rules',
      subtitle: 'Domain token mappings in shared matcher',
      category: 'Fuzzy Matching Rules',
      badge: 'Normalization',
      color: 'neutral',
      description:
        'Normalizes common variations across e-commerce buttons and inputs so restructured pages can still match.',
      bullets: [
        'checkout <=> order <=> buy',
        'cart <=> bag',
        'submit <=> continue <=> pay',
        'Applied to element textContent and class tokens before Jaccard calculation',
      ],
      code: 'const SYNONYMS = {\n  checkout: "checkout", order: "checkout", buy: "checkout",\n  cart: "cart", bag: "cart"\n};',
    },
  };

  const handleNodeClick = (id: string) => {
    if (healerDetailsMap[id]) {
      onSelectNode(healerDetailsMap[id]);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Wide Interactive SVG Diagram */}
      <div className="p-5 sm:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-2xl overflow-hidden relative w-full">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .healer-dot {
              display: none !important;
            }
          }
        `}</style>
        <svg
          viewBox="0 0 1160 450"
          className="w-full h-auto select-none"
          role="img"
          aria-labelledby="healer-title healer-desc"
        >
          <title id="healer-title">Multi-Anchor Cascade & Healer Funnel</title>
          <desc id="healer-desc">
            3-tier cascade showing CSS selector, XPath, and fuzzy token matcher resolving to Patch Applied or Patch Skipped.
          </desc>

          <defs>
            <filter id="healer-pink-glow-wide" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff3b81" floodOpacity="0.85" />
            </filter>

            <marker
              id="healer-arrow-pink-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff3b81" />
            </marker>

            <marker
              id="healer-arrow-green-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>

            <marker
              id="healer-arrow-red-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
            </marker>

            {/* Paths for animated dots */}
            <path id="path-target-tier1-wide" d="M 230 75 L 230 110" />
            <path id="path-miss-1-2-wide" d="M 380 147 L 430 147" />
            <path id="path-miss-2-3-wide" d="M 730 147 L 780 147" />
          </defs>

          {/* ═══════════════════════════════════════════════════ */}
          {/* TOP: TARGET ELEMENT INGESTION */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Target Element: Incoming patch locator coordinates"
            onClick={() => handleNodeClick('target')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('target')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="80"
              y="20"
              width="360"
              height="55"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'target' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'target' ? '2.5' : '1.3'}
              filter={activeNodeId === 'target' ? 'url(#healer-pink-glow-wide)' : undefined}
            />
            <circle cx="110" cy="47" r="5.5" fill="#ff3b81" />
            <text x="128" y="44" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Target Element
            </text>
            <text x="128" y="62" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Incoming patch locator coordinates
            </text>
          </g>

          {/* Target Element down to Tier 1 */}
          <line
            x1="230"
            y1="75"
            x2="230"
            y2="105"
            stroke="#ff3b81"
            strokeWidth="2.5"
            markerEnd="url(#healer-arrow-pink-wide)"
          />
          <circle r="3.5" fill="#ffb1c2" className="healer-dot">
            <animateMotion dur="1.8s" repeatCount="indefinite">
              <mpath href="#path-target-tier1-wide" />
            </animateMotion>
          </circle>

          {/* ═══════════════════════════════════════════════════ */}
          {/* CASCADE ROW: TIER 1 -> TIER 2 -> TIER 3 */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Box: Tier 1 (CSS Selector) */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Tier 1 CSS Selector: Exact id, class, or attribute"
            onClick={() => handleNodeClick('tier1')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('tier1')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="80"
              y="110"
              width="300"
              height="75"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'tier1' ? '#ff3b81' : '#ff3b81'}
              strokeWidth={activeNodeId === 'tier1' ? '2.5' : '1.5'}
              filter={activeNodeId === 'tier1' ? 'url(#healer-pink-glow-wide)' : undefined}
            />
            <text x="110" y="140" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Tier 1: CSS Selector
            </text>
            <text x="110" y="165" fill="#ffb1c2" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Exact id, class, or attribute
            </text>
          </g>

          {/* Miss arrow Tier 1 -> Tier 2 */}
          <line
            x1="380"
            y1="147"
            x2="425"
            y2="147"
            stroke="#aa888e"
            strokeWidth="2"
            markerEnd="url(#healer-arrow-pink-wide)"
          />
          <text x="403" y="137" fill="#aa888e" fontSize="12" textAnchor="middle" fontFamily="monospace">
            miss
          </text>
          <circle r="3" fill="#ffb1c2" className="healer-dot">
            <animateMotion dur="2.2s" repeatCount="indefinite">
              <mpath href="#path-miss-1-2-wide" />
            </animateMotion>
          </circle>

          {/* Box: Tier 2 (XPath) */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Tier 2 Structural XPath: DOM hierarchy fallback path"
            onClick={() => handleNodeClick('tier2')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('tier2')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="430"
              y="110"
              width="300"
              height="75"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'tier2' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'tier2' ? '2.5' : '1.3'}
              filter={activeNodeId === 'tier2' ? 'url(#healer-pink-glow-wide)' : undefined}
            />
            <text x="460" y="140" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Tier 2: Structural XPath
            </text>
            <text x="460" y="165" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              DOM hierarchy fallback path
            </text>
          </g>

          {/* Miss arrow Tier 2 -> Tier 3 */}
          <line
            x1="730"
            y1="147"
            x2="775"
            y2="147"
            stroke="#aa888e"
            strokeWidth="2"
            markerEnd="url(#healer-arrow-pink-wide)"
          />
          <text x="753" y="137" fill="#aa888e" fontSize="12" textAnchor="middle" fontFamily="monospace">
            miss
          </text>
          <circle r="3" fill="#ffb1c2" className="healer-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-miss-2-3-wide" />
            </animateMotion>
          </circle>

          {/* Box: Tier 3 (Fuzzy Tokens) */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Tier 3 Fuzzy Tokens: Jaccard similarity with synonyms"
            onClick={() => handleNodeClick('tier3')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('tier3')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="780"
              y="105"
              width="300"
              height="85"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'tier3' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'tier3' ? '2.5' : '1.4'}
              filter={activeNodeId === 'tier3' ? 'url(#healer-pink-glow-wide)' : undefined}
            />
            <text x="805" y="134" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Tier 3: Fuzzy Tokens
            </text>
            <text x="805" y="156" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Jaccard similarity with synonyms
            </text>
            <rect x="805" y="164" width="180" height="20" rx="4" fill="#353439" stroke="#5a4045" strokeWidth="1" />
            <text x="815" y="178" fill="#ffb1c2" fontSize="11" fontWeight="bold" fontFamily="monospace">
              Score ≥ {CODEBASE_FACTS.jaccardHealingThreshold.toFixed(2)} Jaccard Gate
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* FOUND ARROWS CONVERGING ON PATCH APPLIED (GREEN) */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Tier 1 -> Found */}
          <path
            d="M 230 185 L 230 255"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            markerEnd="url(#healer-arrow-green-wide)"
          />
          <text x="242" y="222" fill="#10b981" fontSize="12" fontFamily="monospace">
            found
          </text>

          {/* Tier 2 -> Found */}
          <path
            d="M 580 185 L 580 255"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            markerEnd="url(#healer-arrow-green-wide)"
          />
          <text x="592" y="222" fill="#10b981" fontSize="12" fontFamily="monospace">
            found
          </text>

          {/* Tier 3 -> Found (≥ 0.25) */}
          <path
            d="M 850 190 L 850 235 L 650 235 L 650 255"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            markerEnd="url(#healer-arrow-green-wide)"
          />
          <text x="862" y="222" fill="#10b981" fontSize="12" fontFamily="monospace">
            score ≥ 0.25
          </text>

          {/* ═══════════════════════════════════════════════════ */}
          {/* SUCCESS OUTCOME: PATCH APPLIED (GREEN) */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Patch Applied: Changes rendered directly in DOM"
            onClick={() => handleNodeClick('success')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('success')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="80"
              y="260"
              width="650"
              height="70"
              rx="14"
              fill="#062e24"
              stroke={activeNodeId === 'success' ? '#10b981' : '#10b981'}
              strokeWidth={activeNodeId === 'success' ? '2.8' : '1.8'}
            />
            <circle cx="115" cy="295" r="7.5" fill="#10b981" />
            <text x="135" y="292" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="Syne, sans-serif">
              Patch Applied
            </text>
            <text x="135" y="314" fill="#6ee7b7" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Changes rendered directly into target page DOM
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* MISS ARROW TIER 3 -> PATCH SKIPPED (RED) */}
          {/* ═══════════════════════════════════════════════════ */}
          <line
            x1="930"
            y1="190"
            x2="930"
            y2="255"
            stroke="#f43f5e"
            strokeWidth="2.2"
            markerEnd="url(#healer-arrow-red-wide)"
          />
          <text x="942" y="222" fill="#f43f5e" fontSize="12" fontFamily="monospace">
            score &lt; 0.25
          </text>

          {/* FAILURE OUTCOME: PATCH SKIPPED (RED) */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Patch Skipped: Warning logged; DOM left untouched"
            onClick={() => handleNodeClick('failure')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('failure')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="780"
              y="260"
              width="300"
              height="70"
              rx="14"
              fill="#381017"
              stroke={activeNodeId === 'failure' ? '#f43f5e' : '#f43f5e'}
              strokeWidth={activeNodeId === 'failure' ? '2.8' : '1.8'}
            />
            <circle cx="810" cy="295" r="7.5" fill="#f43f5e" />
            <text x="830" y="292" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="Syne, sans-serif">
              Patch Skipped
            </text>
            <text x="830" y="314" fill="#fca5a5" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Warning logged, DOM untouched
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* BOTTOM NOTE BAR: SAFETY & NORMALIZATION */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Synonym Normalization and Container Guard Rules"
            onClick={() => handleNodeClick('synonyms')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('synonyms')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="80"
              y="370"
              width="1000"
              height="55"
              rx="12"
              fill="#151419"
              stroke="#353439"
              strokeWidth="1.3"
            />
            <text x="110" y="403" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Heuristic Guardrails:
            </text>
            <text x="290" y="403" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Skips nodes with &gt; 3 children • Ignores SCRIPT/STYLE • Normalizes checkout = order = buy
            </text>
            <text x="960" y="403" fill="#ffb1c2" fontSize="12" fontFamily="JetBrains Mono, monospace">
              View Rules &rarr;
            </text>
          </g>
        </svg>
      </div>

      {/* Summary chips row across full width: zero scrollbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs w-full">
        <button
          onClick={() => handleNodeClick('tier1')}
          className="p-4 rounded-2xl bg-surface-container/70 border border-outline-variant/30 text-left hover:border-primary/50 transition-colors"
        >
          <span className="text-[10px] text-outline uppercase font-semibold block">Tier 1</span>
          <span className="text-white font-bold text-sm">CSS Selector + Text</span>
          <p className="text-on-surface-variant text-[11px] mt-0.5">Exact query and text content matching</p>
        </button>

        <button
          onClick={() => handleNodeClick('tier2')}
          className="p-4 rounded-2xl bg-surface-container/70 border border-outline-variant/30 text-left hover:border-primary/50 transition-colors"
        >
          <span className="text-[10px] text-outline uppercase font-semibold block">Tier 2</span>
          <span className="text-white font-bold text-sm">XPath Hierarchy</span>
          <p className="text-on-surface-variant text-[11px] mt-0.5">Structural DOM tree position traversal</p>
        </button>

        <button
          onClick={() => handleNodeClick('tier3')}
          className="p-4 rounded-2xl bg-surface-container/70 border border-outline-variant/30 text-left hover:border-primary/50 transition-colors"
        >
          <span className="text-[10px] text-outline uppercase font-semibold block">Tier 3</span>
          <span className="text-white font-bold text-sm">Fuzzy Tokens (≥ 0.25)</span>
          <p className="text-on-surface-variant text-[11px] mt-0.5">Jaccard token similarity with synonyms</p>
        </button>
      </div>
    </div>
  );
}
