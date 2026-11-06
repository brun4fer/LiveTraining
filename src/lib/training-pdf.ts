import type { TrainingDetail } from "@/lib/domain";

export function exportTrainingPdf(training: TrainingDetail, teamName: string, targetWindow?: Window | null) {
  const popup = targetWindow || window.open("", "_blank", "width=1000,height=800");
  if (!popup) throw new Error("Allow pop-ups in the browser to export the training PDF.");
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(training.trainingDate));
  const playerRows = training.participants.map(({ player }) => `<tr><td>${escapeHtml(player.shirtNumber === null ? "—" : String(player.shirtNumber))}</td><td>${escapeHtml(player.name)}</td><td>${escapeHtml(player.position || "—")}</td></tr>`).join("");
  const exercises = training.plannedExercises.length
    ? training.plannedExercises.map((exercise) => {
        const recording = training.exercises.find((item) => item.plannedExerciseId === exercise.id || (!item.plannedExerciseId && item.number === exercise.number));
        const status = recording ? `${formatTime(recording.startTimeSeconds)}–${recording.endTimeSeconds === null ? "in progress" : formatTime(recording.endTimeSeconds)}` : "Not recorded";
        return `<article class="exercise">
          <div class="exercise-head"><div><span class="number">${exercise.number}</span><h2>${escapeHtml(exercise.name)}</h2></div><span class="status ${recording ? "recorded" : ""}">${escapeHtml(status)}</span></div>
          ${exercise.imageUrl ? `<img src="${escapeAttribute(exercise.imageUrl)}" alt="${escapeAttribute(exercise.name)}" />` : `<div class="no-image">No exercise image</div>`}
          <dl><dt>Duration</dt><dd>${exercise.durationMinutes ? `${exercise.durationMinutes} min` : "—"}</dd><dt>Video</dt><dd>${exercise.video?.storageStatus === "READY" ? escapeHtml(exercise.video.fileName) : "No exercise video"}</dd><dt>Description</dt><dd>${multiline(exercise.description || "No description")}</dd></dl>
        </article>`;
      }).join("")
    : `<p class="empty">No planned exercises were added to this training.</p>`;
  const collective = training.moments.length;
  const individual = training.playerActions.length;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(training.title)}</title><style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #13201c; background: white; font-size: 11px; }
    header { border-bottom: 3px solid #19b6c9; padding-bottom: 14px; margin-bottom: 18px; }
    .eyebrow { color: #168697; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-size: 9px; }
    h1 { margin: 6px 0 2px; font-size: 25px; } .subtitle { color: #5c6d67; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 15px 0; }
    .meta div, .summary div { border: 1px solid #d8e1de; border-radius: 6px; padding: 9px; }
    .meta b, .summary b { display: block; font-size: 8px; color: #70817b; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .notes { border-left: 4px solid #19b6c9; background: #f1f7f5; padding: 10px 12px; white-space: pre-wrap; margin-bottom: 16px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
    h2.section { font-size: 16px; border-bottom: 1px solid #ccd8d4; padding-bottom: 6px; margin: 18px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; } th, td { border-bottom: 1px solid #e2e9e7; padding: 6px; text-align: left; } th { color: #60716b; font-size: 8px; text-transform: uppercase; }
    .exercise { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ccd8d4; border-radius: 8px; overflow: hidden; margin: 0 0 14px; }
    .exercise-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 11px; background: #edf5f3; }
    .exercise-head > div { display: flex; align-items: center; gap: 8px; } .exercise-head h2 { margin: 0; font-size: 15px; }
    .number { display: inline-flex; width: 25px; height: 25px; align-items: center; justify-content: center; border-radius: 50%; background: #0d3d34; color: white; font-weight: 700; }
    .status { padding: 4px 7px; border-radius: 999px; background: #e7ecea; color: #697a74; font-size: 8px; text-transform: uppercase; } .status.recorded { background: #d9f7e6; color: #117643; }
    .exercise img, .no-image { display: block; width: 100%; max-height: 360px; object-fit: contain; background: #101916; }
    .no-image { height: 120px; color: #81918c; display: flex; align-items: center; justify-content: center; }
    dl { display: grid; grid-template-columns: 90px 1fr; margin: 0; padding: 10px 12px; gap: 7px; } dt { color: #65756f; font-weight: 700; } dd { margin: 0; white-space: normal; }
    .empty { color: #687a74; padding: 18px; border: 1px dashed #ccd8d4; text-align: center; }
    footer { margin-top: 18px; color: #84928e; font-size: 8px; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>
    <header><div class="eyebrow">${escapeHtml(teamName)} · Live Training</div><h1>${escapeHtml(training.title)}</h1><div class="subtitle">Training plan and recording summary</div></header>
    <section class="meta"><div><b>Date</b>${escapeHtml(date)}</div><div><b>Season</b>${escapeHtml(training.season)}</div><div><b>Microcycle</b>${training.microcycleNumber}</div><div><b>Training unit</b>${training.trainingUnitNumber}</div></section>
    ${training.notes ? `<div class="notes">${multiline(training.notes)}</div>` : ""}
    <section class="summary"><div><b>Players</b>${training.participantCount}</div><div><b>Collective clips</b>${collective}</div><div><b>Player actions</b>${individual}</div></section>
    <h2 class="section">Participating players</h2><table><thead><tr><th>No.</th><th>Player</th><th>Position</th></tr></thead><tbody>${playerRows}</tbody></table>
    <h2 class="section">Exercises</h2>${exercises}
    <footer>Generated ${escapeHtml(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date()))}</footer>
    <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 700); });<\/script>
  </body></html>`);
  popup.document.close();
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.round(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function multiline(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
