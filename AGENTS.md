# YOLO OS agent reference

Read these files before changing business behavior:

- `docs/YOLO-business-reference.md`
- `docs/YOLO-operational-system-requirements.md`
- `docs/YOLO-OS-architecture-reference.txt`

The current deployment shell intentionally preserves the approved static prototype under `public/prototype/`. Do not remove or rewrite it during infrastructure work. Migrate workflows into React and Supabase one bounded vertical slice at a time after field-test feedback.

Core rules:

- Keep the operational interface touch-first and simple.
- Keep management lists compact and suitable for large data volumes.
- Use the same order ID and record across requests, Separação, delivery, pickup, return, and billing.
- Treat stock status, quality class, physical state, location, quantity, and container identity as separate fields.
- Maintain an append-only stock movement and order event history.
- Enforce unique physical asset IDs in the database.
- Never allow overlapping active reservations for the same asset.
- An event closes only after returns are reconciled and reusable assets complete inspection/cleaning.
- Keep Supabase service-role credentials out of browser code.
