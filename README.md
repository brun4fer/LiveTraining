# Live Training

Live Training is a collaborative football training-analysis platform. It records a live camera, provides independent replay without interrupting recording, tags collective moments, and saves individual player actions.

## Core workflow

1. Create or join a team workspace.
2. In **Maintenance**, configure seasons and players.
3. Select **New training** and enter:
   - season;
   - numeric microcycle;
   - numeric training unit;
   - date;
   - participating players.
4. Connect a local camera, capture card, or paired phone.
5. Select **Start exercise**. Exercises are numbered automatically.
6. During an exercise:
   - click a collective moment to save the previous 20 seconds;
   - click a player in the right column to save the previous 15 seconds.
7. Select **End exercise**, then start as many further exercises as required.
8. Select **End training** after the last exercise.

Each exercise receives its own local recording file. The application also maintains one continuous virtual timeline so staff can rewind, review clips, and return to live independently.

## Workspace layout

The live and review workspaces are designed to fit within the viewport:

- collective moments and saved moment history on the left;
- video, replay controls, and exercise control in the centre;
- the selected player list on the right.

Only individual panels scroll when their content exceeds the available height; the working page remains fixed on desktop.

## Reports

Reports deliberately keep the two data sets independent:

- **Training moments** shows collective moment types, exercise, time, and totals.
- **Player actions** shows a compact count per player plus every independent action with its exercise and clip time.

The report workspace supports selecting one or several trainings, filtering by collective moment or player, playing the filtered clips in sequence, exporting selected clips, and exporting the complete local or cloud recordings. Trainings recorded as separate exercise files are exported together in a training folder.

Player actions are not children of moments and do not need a collective moment to exist.

## Video and storage

- The camera computer saves each exercise locally as it is recorded.
- Short replay segments can be uploaded while recording continues.
- Complete recordings can be uploaded directly to a private Cloudflare R2 bucket.
- Shared media-library linking, playlists, exports, wireless phone capture, presence, and workspace invitations use the same infrastructure as Live Game.

Required R2 variables:

```dotenv
R2_BUCKET_NAME=""
R2_ENDPOINT="https://ACCOUNT_ID.eu.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
```

## Local development

```bash
npm install
npm run prisma:generate
npm run media:generate
npm run prisma:migrate
npm run dev
```

Create `.env.local` from `.env.example` and provide the PostgreSQL and storage configuration before running migrations.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Data model

The main entities are:

- workspace, users, and invitations;
- seasons and players;
- trainings and selected participants;
- numbered exercises;
- configurable collective moment types and moments;
- independent player actions;
- videos, live sessions, and recording segments;
- playlists and shared media references.

Maps and submoments are intentionally not part of Live Training.
