import { codePalette } from './source-highlight.js';

const sourceColors = Object.entries(codePalette(false)).map(([kind,color]) => `.ad-source-code .ad-code-${kind}{color:${color}}`).join('');

export const dashboardStyle = `
.arch-dashboard{--ink:#15213b;--muted:#53617a;--line:#dce3f0;--accent:#3657cf;--wash:#edf2ff;--panel:#fff;--subtle:#f5f7fb;color:var(--ink);background:var(--subtle);font:14px/1.5 "Instrument Sans",system-ui,sans-serif;min-height:100%;color-scheme:light}
.arch-dashboard *{box-sizing:border-box}
.arch-dashboard{white-space:normal}
.arch-dashboard button,.arch-dashboard input{font:inherit}
.arch-dashboard button{cursor:pointer}
.arch-dashboard button:disabled{cursor:default;opacity:.42}
.arch-dashboard :focus-visible{outline:3px solid #627bf5;outline-offset:3px}
.arch-dashboard [hidden]{display:none!important}
.arch-dashboard h1,.arch-dashboard h2,.arch-dashboard h3,.arch-dashboard p{margin:0}
.ad-header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px clamp(16px,3vw,42px);color:#f5f7ff;background:linear-gradient(105deg,#142349,#253e80)}
.ad-header h1{font-size:clamp(22px,3vw,34px);font-weight:660;line-height:1.16;overflow-wrap:anywhere}
.ad-header .ad-model-description{color:#d4dbf2;margin-top:6px;max-width:65ch;white-space:pre-wrap}
.ad-header .ad-profile{font-size:12px;color:#cad5f3;margin-top:8px}
.ad-actions,.ad-view-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ad-button{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:7px 12px;white-space:nowrap}
.ad-button:hover:not(:disabled){background:var(--wash)}
.ad-header .ad-button{border-color:#869aca;background:#ffffff17;color:white}
.ad-header .ad-button:hover:not(:disabled){background:#ffffff30}
.ad-header .ad-primary{background:#fff;color:#1c3267;border-color:white}
.ad-header .ad-primary:hover{background:#e9eefc}
.ad-export-status{padding:8px 16px;background:var(--panel);color:var(--muted);border-bottom:1px solid var(--line)}
.ad-export-menu{position:relative}
.ad-export-menu summary{cursor:pointer}
.ad-export-formats{position:absolute;z-index:4;right:0;top:calc(100% + 6px);display:grid;min-width:165px;padding:5px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;box-shadow:0 8px 24px #19264329}
.ad-export-formats .ad-button{border:0;background:var(--panel);color:var(--ink);text-align:left}
.ad-export-formats .ad-button:hover:not(:disabled){background:var(--wash)}
.ad-notes{width:min(560px,calc(100% - 32px));max-height:85vh;overflow:auto;padding:20px;border:1px solid var(--line);border-radius:12px;color:var(--ink);background:var(--panel)}
.ad-notes::backdrop{background:#1322439e}
.ad-notes-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.ad-note-field{display:grid;gap:6px;margin:14px 0;font-weight:650}
.ad-note-field textarea{width:100%;resize:vertical;min-height:75px;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-weight:400;color:var(--ink);background:var(--subtle)}
.ad-notes-badge{display:inline-block;margin-inline-start:6px;min-width:19px;padding:0 4px;border-radius:10px;background:#fff;color:#253e80;text-align:center;font-size:11px;font-weight:750}
.ad-note-links{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 0;border-bottom:1px solid var(--line)}
.ad-body{display:grid;grid-template-columns:minmax(215px,280px) minmax(0,1fr) minmax(240px,310px);min-height:540px;min-height:min(75vh,800px)}
.ad-catalog,.ad-inspector{background:var(--panel);min-width:0}
.ad-catalog{border-right:1px solid var(--line);display:flex;flex-direction:column}
.ad-catalog-controls{padding:15px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.ad-search{width:100%;border:1px solid var(--line);background:var(--subtle);color:var(--ink);padding:9px 10px;border-radius:8px}
.ad-tabs{display:flex;gap:3px;flex-wrap:wrap}
.ad-tabs button{background:none;border:0;color:var(--muted);padding:5px 7px;border-radius:6px;font-size:12px}
.ad-tabs button[aria-pressed=true]{color:#233e9f;background:var(--wash);font-weight:700}
.ad-results{max-height:72vh;overflow:auto;min-height:0;padding:7px}
.ad-entry{display:grid;gap:2px;width:100%;text-align:left;background:none;border:1px solid transparent;color:var(--ink);border-radius:8px;padding:9px 10px;overflow-wrap:anywhere}
.ad-entry:hover,.ad-entry[aria-current=true]{background:var(--wash);border-color:#dce5ff}
.ad-entry strong{font-weight:650}
.ad-catalog-row{display:flex;align-items:center}
.ad-catalog-row .ad-entry{flex:1;min-width:0}
.ad-catalog-row .ad-note-jump{flex:none;margin-inline-end:6px;border:1px solid #c6d4f9;border-radius:6px;padding:2px 6px;background:var(--wash);color:#2443a1;font-size:11px}
.ad-entry small,.ad-meta{font-size:12px;color:var(--muted)}
.ad-main{min-width:0;display:flex;flex-direction:column}
.ad-viewbar{min-height:70px;background:var(--panel);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.ad-viewbar h2{font-size:17px;line-height:1.25;overflow-wrap:anywhere}
.ad-view-modes{padding:6px 16px;border-bottom:1px solid var(--line);background:var(--panel)}
.ad-view-modes button,.ad-source-bar .ad-tabs button{padding:6px 12px;font-size:13px}
.ad-source{min-width:0;flex:1;background:var(--panel)}
.ad-source-bar{min-height:53px;padding:8px 16px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.ad-source-code{min-height:385px;max-height:72vh;margin:0;padding:16px;background:var(--subtle);color:${codePalette(false).plain};overflow:auto;tab-size:2;white-space:pre;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ad-source-code>code{font:inherit}
${sourceColors}
.ad-canvas{min-height:445px;flex:1;max-height:76vh;overflow:auto;padding:20px;display:flex;container-type:size;background-color:#f0f3fa;background-image:radial-gradient(#c5cfe5 1px,transparent 1px);background-size:19px 19px}
.ad-diagram{margin:auto;flex:none;width:100%;min-width:0;line-height:0}
.ad-diagram[data-intrinsic-size]{width:calc(min(var(--ad-svg-width),94cqw,calc(94cqh * var(--ad-svg-aspect))) * var(--ad-zoom,1))}
.ad-diagram>svg{display:block;width:100%;height:auto;margin:auto;background:white;border:1px solid var(--line);border-radius:10px;box-shadow:0 5px 24px #14234917}
.ad-diagram [role=button]{cursor:pointer}
.ad-diagram [data-grid-state="available"],.ad-diagram [data-grid-state="selected"]{cursor:pointer}
.ad-diagram [data-dashboard-highlight]{filter:drop-shadow(0 0 5px #4262ff)}
.ad-diagram [data-dashboard-highlight] > :is(path,rect,circle,polygon){stroke:#3d5cf5;stroke-width:2.5}
.ad-inspector{border-left:1px solid var(--line);padding:17px;overflow:auto;max-height:83vh;overflow-wrap:anywhere}
.ad-inspector h2{font-size:18px;line-height:1.3;margin-top:3px}
.ad-inspector section{margin-top:17px;padding-top:14px;border-top:1px solid var(--line)}
.ad-inspector h3{font-size:13px;margin-bottom:7px}
.ad-inspector p{margin-top:6px}
.ad-inspector ul,.ad-inspector dl{margin:0;padding:0;list-style:none}
.ad-inspector li+li{margin-top:5px}
.ad-inspector dt{color:var(--muted);font-size:12px}
.ad-inspector dd{margin:0 0 7px}
.ad-inspector .ad-entry{padding:5px 7px}
.ad-link{color:#2443a1;background:none;border:0;padding:0;text-align:left;text-decoration:underline;text-underline-offset:3px}
.ad-empty{padding:14px;color:var(--muted);font-size:13px;line-height:1.5}
.ad-issue{padding:8px 9px;border-left:3px solid #a16018;background:#fff5df;color:#55350e;border-radius:4px;margin:6px 0;line-height:1.45}
.ad-issue[data-error=true]{border-color:#b32d4d;background:#fff0f3;color:#711d32}
.ad-inspector details>summary{cursor:pointer;color:#294bba}
.ad-help{width:min(880px,calc(100% - 28px));max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--line);border-radius:14px;color:var(--ink);background:var(--panel);box-shadow:0 16px 56px #0c163742}
.ad-help[open]{display:flex;flex-direction:column}
.ad-help::backdrop{background:#101b3b8c}
.ad-help-header{padding:14px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.ad-help-header h2{font-size:18px}
.ad-help-body{overflow:auto;padding:16px 20px;overflow-wrap:anywhere}
.ad-help-body section{padding:12px 0;border-bottom:1px solid var(--line)}
.ad-help-body h3{font-size:15px}
.ad-help-body p{margin-top:6px;white-space:pre-wrap}
.ad-help-body pre{margin-top:8px;background:var(--subtle);padding:12px;border-radius:8px;overflow:auto;line-height:1.55}
.ad-help-body code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ad-help-term{color:#283b89;background:#eef2ff;border-radius:4px;padding:1px 4px;font-weight:600}
.ad-help-body .ad-link .ad-help-term{color:inherit}
.ad-presenting .ad-catalog,.ad-presenting .ad-inspector,.ad-presenting [data-author]{display:none!important}
.ad-presenting .ad-body{grid-template-columns:minmax(0,1fr)}
.ad-presenting .ad-canvas{max-height:none;min-height:70vh}
@media(max-width:1050px){.ad-body{grid-template-columns:minmax(185px,235px) minmax(0,1fr)}.ad-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--line);max-height:none}.ad-results{max-height:62vh}}
@media(max-width:600px){.ad-header{align-items:flex-start;flex-direction:column;gap:12px}.ad-body{grid-template-columns:minmax(0,1fr)}.ad-catalog{border-right:0}.ad-results{max-height:28vh}.ad-canvas{padding:10px;min-height:285px}.ad-source-code{min-height:260px}}
`;
