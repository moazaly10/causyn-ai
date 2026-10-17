# Final demo verification

## Simulation investigation

Fleet scanning, individual ML analysis, and What-If Simulation all POST the same
six-field schema to the configured prediction URL plus `/predict`. What-If uses
the selected machine's original readings for the baseline and a separate input
state for the hypothetical request. The Next.js rewrite forwards
`/api/prediction/*` to the prediction service; authentication also covers this path.
There are no intervening Next.js API route handlers.

The local authenticated proxy returned HTTP 500 for both prediction health and
prediction requests when nothing was listening on port 8000. Starting the
existing prediction API restored HTTP 200 through the unchanged rewrite. This
establishes the local upstream availability failure; it does not establish the
cause of the previously observed Render failure. A fleet ranking already visible
in React state is not evidence that a new prediction request is succeeding.

Direct FastAPI tests, authenticated local proxy requests, and authenticated live
Render requests all accepted simultaneous baseline/hypothetical requests:

| Input | Result from existing model | Display band |
| --- | --- | --- |
| MC-104: 304.2 K, 317.9 K, 1170 RPM, 64 Nm, 211 min | 0.780 | high |
| Same readings except 45 Nm and 100 min | 0.105 | low |

These are observed outputs, not values hardcoded into the application. No model,
schema, production backend implementation, routing, authentication, or deployment
configuration was changed. The historical live 500 could not be reproduced and
must not be described as permanently fixed without its failing request and logs.

For local testing, run the existing prediction service from
`services/prediction-api` in a separate terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The simulation needs this API. Individual causal analysis and AMD features also
need the existing causal service on port 8001; their startup/configuration is
unchanged.

## Risk displays

The old 88% was `risk: 88` in the seeded MC-104 demo object, not a Random Forest
prediction. The fleet table now shows `Not analyzed` until an ML result exists.
Successful scans, analysis, simulation baselines, investigations, and Copilot
responses share an in-memory result map keyed by machine ID and all five sensor
readings. Hypothetical results do not replace the original readings' prediction.
Changed readings do not reuse a previous result, removal discards that machine's
cached score, and refresh starts with no cached predictions. Scores are not
stored in localStorage. Overview status counts still describe the existing
demo/manual Healthy/Watch/Critical labels, not classifier predictions.

## Automated checks

From `frontend`:

```powershell
node --test tests/predictions.test.cjs
npm.cmd run build
```

Stop the Next.js development server before building. Frontend tests exercise the
actual request handlers with mock responses: matching baseline payloads, edited
hypothetical values, original sensor preservation, sensor-specific result keys,
late responses after selection changes, and genuine API failures.

From `services/prediction-api`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
```

The API tests load the unchanged trained artifact, including concurrent vs.
sequential prediction equality. Tests do not access browser storage or AMD APIs.

## Browser checks after your deployment

1. Log in and open DevTools Network. Verify
   `/api/prediction/health` returns 200 with `model_loaded: true`.
2. Scan the fleet and select MC-104. Compare ranking, fleet percentage, and
   details score: 0.78 and 78% represent the same uncalibrated model score.
3. Run ML analysis, then simulate unchanged readings. All baseline displays
   should agree. Edit torque to 45 and wear to 100; expect a valid hypothetical
   prediction (0.105 with the currently tested artifact, displayed as 0.10).
4. Reset Values and confirm 64 Nm and 211 minutes return. Confirm the fleet and
   selected-machine original readings were never edited by simulation.
5. Test ranking spacing on desktop and a narrow phone viewport. Only the scan
   panel uses the new ranking styles; its table scrolls within its container.
6. If a 500 recurs, retain the failed request's URL, payload, response, timestamp,
   and corresponding Render Next.js/Python logs. Check health immediately. A
   proxy connection failure and a Python exception require different fixes.

The updated UI still requires manual browser verification. Successful tests of
the existing live endpoints do not mean these local UI changes are deployed.
