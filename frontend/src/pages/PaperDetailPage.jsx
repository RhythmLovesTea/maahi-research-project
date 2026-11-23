import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

export function PaperDetailPage({ paper, onBack }) {
  if (!paper) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <span className="eyebrow-mono block mb-2">// ERROR: 404</span>
        <p className="text-sm text-mute">Paper record not found.</p>
        <button onClick={onBack} className="btn-outline-sm mt-4">
          Return to Workspace
        </button>
      </div>
    );
  }

  const analysis = paper.analysis || {};
  const authorsText = paper.authors && paper.authors.length > 0 
    ? paper.authors.join(', ')
    : 'Authors not specified';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="btn-outline-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-mono uppercase tracking-caption-mono-sm text-[11px]">Return to Collection</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="card-xai mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <StatusBadge status={paper.status} errorCode={paper.error_code} />
          <span className="font-mono uppercase text-[11px] tracking-caption-mono text-mute">
            // {paper.filename}
          </span>
          {paper.page_count > 0 && (
            <span className="font-mono uppercase text-[11px] tracking-caption-mono text-mute">
              · [{paper.page_count} PAGES PARSED]
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-normal tracking-[-0.8px] text-ink leading-tight">
          {paper.title || paper.filename}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-mute font-mono uppercase tracking-caption-mono-sm">
          <span>{authorsText}</span>
          <span>·</span>
          <span>PUBLISHED: {paper.publication_year || 'NOT FOUND'}</span>
        </div>
      </div>

      {/* Beginner Explanation Highlight Box */}
      <div className="card-xai bg-canvas-soft border-hairline mb-6">
        <span className="eyebrow-mono text-accent-breeze block mb-2">
          // PLAIN-ENGLISH BREAKDOWN
        </span>
        <div className="text-sm text-ink leading-relaxed font-normal whitespace-pre-line">
          {analysis.beginner_explanation || 'Detailed plain-English analysis is being synthesized for this document.'}
        </div>
      </div>

      {/* Structured Sections */}
      <div className="space-y-6">
        {/* Abstract */}
        {paper.abstract && (
          <div className="card-xai">
            <span className="eyebrow-mono block mb-2">// ABSTRACT</span>
            <p className="text-xs text-body leading-relaxed font-normal">
              {paper.abstract}
            </p>
          </div>
        )}

        {/* Objective & Methodology (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-xai">
            <span className="eyebrow-mono block mb-2">// 01_RESEARCH OBJECTIVE</span>
            <p className="text-xs text-body leading-relaxed font-normal">
              {analysis.objective || 'Not found in paper'}
            </p>
          </div>

          <div className="card-xai">
            <span className="eyebrow-mono block mb-2">// 02_METHODOLOGY</span>
            <p className="text-xs text-body leading-relaxed font-normal">
              {analysis.methodology || 'Not found in paper'}
            </p>
          </div>
        </div>

        {/* Dataset */}
        <div className="card-xai">
          <span className="eyebrow-mono block mb-2">// 03_DATASET & BENCHMARKS</span>
          <p className="text-xs text-body leading-relaxed font-normal">
            {analysis.dataset || 'Not found in paper'}
          </p>
        </div>

        {/* Main Findings */}
        <div className="card-xai">
          <span className="eyebrow-mono block mb-3">// 04_MAIN FINDINGS & METRICS</span>
          {analysis.main_findings && analysis.main_findings.length > 0 ? (
            <ul className="space-y-2">
              {analysis.main_findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-body leading-relaxed">
                  <span className="text-accent-breeze font-mono text-[11px] mt-0.5">[{idx + 1}]</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-mute font-mono uppercase tracking-caption-mono-sm italic">
              No explicit findings extracted.
            </p>
          )}
        </div>

        {/* Author-Stated Limitations */}
        <div className="card-xai border-accent-sunset/30 bg-canvas-card">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow-mono text-accent-sunset">
              // 05_AUTHOR-STATED LIMITATIONS
            </span>
            <span className="font-mono uppercase text-[10px] tracking-caption-mono text-mute">
              EXPLICITLY ACKNOWLEDGED
            </span>
          </div>
          <p className="text-[11px] text-mute mb-3 font-mono">
            Boundary conditions and constraints explicitly stated by the authors:
          </p>
          {analysis.limitations && analysis.limitations.length > 0 ? (
            <ul className="space-y-2">
              {analysis.limitations.map((lim, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-body bg-canvas-soft border border-hairline p-3 rounded-sm leading-relaxed">
                  <span className="text-accent-sunset font-mono text-[11px] mt-0.5">//</span>
                  <span>{lim}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-mute font-mono uppercase tracking-caption-mono-sm italic">
              Not found in paper
            </p>
          )}
        </div>

        {/* Future Work */}
        {analysis.future_work && analysis.future_work.length > 0 && (
          <div className="card-xai">
            <span className="eyebrow-mono block mb-3">// 06_PROPOSED FUTURE WORK</span>
            <ul className="space-y-2">
              {analysis.future_work.map((fw, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-body leading-relaxed">
                  <span className="text-accent-twilight font-mono text-[11px] mt-0.5">{'->'}</span>
                  <span>{fw}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
