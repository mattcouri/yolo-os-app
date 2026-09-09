# YOLO operational system — requirements

Updated: 2026-09-09

## Context and system boundaries

Read YOLO-business-reference.md alongside this document for product and business context.

Accepted direction: keep Shopify for selling and Bling for financial and fiscal records. Build a connected operational system for YOLO's workflows. Exact integrations and data ownership rules still require design and validation.

## Two connected user experiences — required

Management information-density preference: lists must use compact, table-like rows that can support large data volumes. Avoid presenting every record as a separately padded card. Keep touch-oriented operational actions and forms spacious, but tighten management list row height, metadata spacing, section padding, and row action buttons.

Operational navigation hierarchy: after login, users land on a touch-first module portal made only of large cards, such as Operações, Pedidos, Financeiro, and Gestão. There is no persistent sidebar or bottom navigation in this interface. Selecting Operações opens a second card-only page with Receber, Preparar, Movimentar, and Inventariar. Functional forms include a contextual way back to the Operações cards. The current prototype represents the post-login portal; real authentication and role-based module visibility remain for the production build.

Inventory counting prototype: operators periodically select one location, scan each physical medium box, enter actual quantities, and compare the count with system balances. Missing boxes, quantity differences, and boxes registered in another location are discrepancies. Submitting a count does not change stock. Discrepancies enter a management approval queue with operator notes. A manager can approve the controlled quantity / location adjustments or return the count for repetition, with a required comment and an audit entry.

Approved simplification: the operational home has four primary actions, Receber, Preparar, Movimentar, and Inventariar, plus an actionable queue of unfinished receiving / packing work. Preparar groups counting, classification, and packing; Movimentar groups batch transfers and picking withdrawals. Separate Gestão navigation retains inventory, receiving documents, packaging, registrations, and movement history. Mobile uses bottom navigation. Switching interfaces is a prototype navigation choice, not authentication or role enforcement.

Owner clarification: provide two deliberately designed interfaces over shared data, not merely a desktop dashboard shrunk to a phone. Mobile is for quick movements and operational registrations; desktop is for the full analysis and management experience. Preserve the current prototype while the owner reviews it.

## Owner-supplied YOLO OS reference

The supplied reference is preserved verbatim in YOLO-OS-architecture-reference.txt. It describes YOLO OS for Elephant & Castle Bebidas Ltda (YOLOPOPS), with a Portuguese role-based interface, mobile bottom navigation, large touch targets, and a proposed Next.js / TypeScript / Tailwind / Supabase architecture. Treat this as the target reference for the eventual build, not evidence that those capabilities already exist in the current static prototype. Version choices and compatibility require validation before implementation.

The reference also covers authentication, access controls, an append-only stock ledger, configurable forms, offline field operations, notifications, and additional commercial modules. Their inclusion in the first release has not yet been agreed.

Integration decision to reconcile before implementation: the supplied reference specifies manual Bling transfer flags and NF numbers, explicitly without a Bling API. Earlier discussions proposed automated Bling integration and payment-status synchronization. Do not silently treat either as the finalized integration scope; preserve billing visibility as a requirement and confirm the mechanism when integration work begins.

### Simple operational interface

- Users log in and see a simple, interactive, friendly home page with square icon cards.
- Cards lead to relevant functions, such as Sales / Orders and Inventory.
- Inventory actions include Receive and Transfer.
- Everyday work uses clear forms with minimal friction.

### Management and visualization interface

- Maintain products and inventory locations.
- Manage goods and their statuses, including broken goods.
- Access complete operational data, dashboards, and business intelligence.
- Both interfaces use the same underlying records so everyday actions are reflected in management views.

## One integrated dashboard — required

Bring the following together on one dashboard:

- Shared calendar.
- Events.
- Operations schedule.
- To-do list.
- Billing information.

The dashboard serves sales and operations together. Exact layout, metrics, visibility by role, and filters remain to be defined.

## Shared calendar and resource availability — required

- Provide a Google Calendar-style experience with dates, times, week views, and month views. This is a visual / interaction reference; external Google Calendar synchronization has not been requested.
- Show YOLO events, sales events, parties, and other scheduled work in one shared calendar.
- Include dates, hours, and responsible people.
- Coordinate event staffing, production / supply preparation, inventory readiness, freezing, delivery, and pickup.
- During a request, show whether the requested freezer or specific ice cream cart is already reserved for the relevant period.
- Block conflicting equipment bookings.

## Tasks and small projects — desired

- Include a place for to-do lists, tasks, and small projects on the dashboard.
- The owner initially described task functionality as a want and subsequently included the to-do list in the dashboard. A basic dashboard list is included; the depth of project-management features remains optional and undefined.

## Earlier operational requirements retained

- Receiving with notas fiscais and receiving details.
- Administrator-managed stock locations and traceable transfers.
- Product state tracking for liquid and frozen pops.
- Remote salesperson requests for sales, samples, other requests, and events.
- Shipping-room preparation and readiness for collection / delivery.
- Event equipment, materials, delivery and pickup responsibilities, and return reconciliation.
- Inspection and cleaning before returned equipment becomes available again.
- Linked billing and payment visibility to prevent dispatched sales from being overlooked.

## Unified requests and orders — prototype direction

Use one adaptive request form for people working outside the office. The requester first selects the purpose; the form then shows only the additional fields needed for that situation. Supported request types are Venda, Evento, Amostra, Solicitação interna, Consignação / reposição, Empréstimo de equipamentos, Troca / devolução, Doação / patrocínio, Material promocional, and Outro.

Every request begins with a dropdown identifying the internal YOLO solicitante. This is separate from the client / company / internal area, named recipient, delivery contact, and recipient email. The request also records the required date and delivery window, fulfillment method, address when applicable, structured item lines with quantities and pop state, payment condition, commercial treatment, and operating notes. Events additionally require their start and end, expected pickup / return, onsite contact, and estimated audience. Exchanges and returns require the originating order, invoice, or event. The final section accepts free-text observations and multiple supporting files, including photos, videos, documents, maps, artwork, and lists.

The remote form is intended for authorized YOLO staff working outside the office. It must not expose stock balances, internal prices, other customers, or operational records. A valid submission enters the Operations queue directly without an administrative approval stage. When an event or equipment loan includes uniquely identified assets, the requester supplies a Reservar de / Reservar até interval. All registered assets remain visible; conflicting assets are muted and disabled, with the current request holder and expected return shown. Submitting a conflict-free request immediately reserves the selected assets for that interval. Product stock remains physically unchanged until Operations performs the later picking movement. The same request should generate the operational schedule, picking work, delivery / pickup work, inventory movements, and billing follow-up.

### Separação operations board

Submitted requests generate open jobs on a large-format, TV-friendly kanban named Separação. Its stages are A separar, Em separação, Na rua, and Retorno. Cards display the order, client, destination, delivery date / window, checklist progress, delivery driver, pickup driver, and any missing assignment. Every card is clickable.

The order detail is both an editable operational record and a printable one-page instruction sheet. Operations assigns the delivery driver, pickup driver, vehicle, expected departure and return, and current stage. The sheet includes who, what, where, and when for delivery; a checklist of every outgoing product, material, and uniquely identified asset; delivery confirmation; everything expected at pickup; actual return quantities; missing / damaged checks; and return-to-YOLO confirmation.

Acompanhar pedidos and Separação are two views of the same order record and ID. Acompanhar pedidos provides a compact requester-facing summary of the live operational stage, delivery and pickup assignments, separation checklist progress, destination, vehicle, and return timing. Separação remains the editable operational surface. Saving an assignment, checklist, or stage in Separação must update Acompanhar pedidos immediately; neither view may maintain a separate copy of the order status.

An event remains open through the Retorno stage until all expected assets and materials are accounted for at the office. Eligible pops return to stock through a controlled movement. Carts, freezers, and reusable event materials enter inspection / cleaning before becoming Disponível. Missing or damaged items remain an operational exception rather than allowing a normal completion. In the prototype, printable paper fields demonstrate field confirmations; the production build should save those confirmations digitally as well.

## Proposed design details — not yet confirmed

### Inventory foundation — owner-confirmed receiving workflow

- Daily warehouse prototype: scan multiple medium boxes and confirm an atomic transfer to an editable location, preserving quantity, batch, class, and state. Reject unknown, unavailable, duplicated, or already-at-destination boxes before making changes.
- Dedicated caixa de separação workflow: open one per flavor and state, explicitly end its picking designation without changing its stock, record withdrawals with quantity and purpose / reference, and make a zero-balance container available for reuse while preserving its identity and history. Withdrawals remain demonstrations until orders are connected.

- Packing must link classified stock to registered, empty physical medium boxes by permanent QR / ID. Never create a new physical identity for each filling. Retain filling history independently of current contents.
- Support batch packing: stage multiple box IDs and quantities, show remaining quantity per classification, and confirm the batch together. Reject the complete batch without partial changes when any box is unknown, occupied, duplicated, or over capacity / available quantity. Allow smaller confirmed batches and continuation of the remaining work.

- Every physical box, freezer, and ice cream cart must have a unique ID. Reject duplicates, including case / whitespace / separator variations. Scanning an existing box updates its movement rather than creating another asset. The production database must enforce uniqueness as well as the interface; concurrent users must not be able to create duplicate IDs.

- Recebimento is the first operational action and must be the first card on Início.
- A single receiving form / nota fiscal supports multiple products, each with its own quantity and all associated returnable box codes, entered manually or by scanning.
- Example: Morango, 235 pops across PRETA-001, PRETA-007 and PRETA-030; Abacaxi, 899 pops across PRETA-002 and other boxes. The quantity belongs to the product line, not each listed box. Per-box contents are not inferred by dividing the total.
- Receiving also covers shipping boxes, flavor ingredients, inserts, packaging supplies, and other materials. Register these as products / SKUs with appropriate units and track their balances separately from pops. Pop-specific AAA/B/C classification and boxes-of-100 rules do not apply automatically to materials.

- Everything arrives at a location initially named Recebimento 1. Location names must remain editable.
- Incoming pops arrive liquid in bulk, in YOLO-owned large black plastic boxes, and must be flagged em análise.
- Each large box has a QR identifier. Track the reusable box itself, including scanning movements back to the factory to be refilled and returns to YOLO.
- The operations user records all receiving nota fiscal details and scans every incoming box.
- Provide a Notas fiscais de recebimento page listing receiving documents and a separate Embalagens page tracking reusable packaging.
- Operators wash, clean, count, and separate pops into classifications:
  - AAA: perfect pops, intended for export, e-commerce, and retail; kept liquid and eligible for boxing.
  - B: imperfect pops, such as misshapen sachets or missing easy-open slits; primarily for events or company freezers for resale.
  - C: subpar pops, sent to the kitchen freezer for samples or team consumption.
- Each classification needs photo references and documentation uploads to guide operators.
- After classification, operators pack medium reusable plastic boxes with 100 pops per flavor. These boxes fit shelves and freezers.
- Print a QR label for each filled medium box, including lot number and a date for FIFO. The exact date field is not yet defined.
- Labels should support quick inventory by photos; the photo capture / recognition method and reliability checks remain to be designed.
- Operators transfer packed boxes to editable destinations such as Freezer 1 or Stock room.
- The approved term for the working box is Caixa de separação.
- Maintain one caixa de separação per flavor and physical state: unfrozen in the packing room, and frozen in the freezers. This is not a per-classification rule. Whether the frozen allocation is shared across freezers or assigned to a specific freezer remains to be defined.
- Inventory counts include full boxes × 100 plus actual quantities in all partial boxes, including caixas de separação.
- Partial boxes from receiving are allowed: 235 AAA pops yield two full boxes of 100 and one partial box of 35. A partial box is not automatically an additional active caixa de separação.
- Provide a Cadastros area to create and maintain all SKUs, flavors, and product states. Initial physical states are liquid / unfrozen and frozen. Physical states remain distinct from quality classifications and release statuses.

### Inventory design recommendations — not yet confirmed

Prototype iteration 3 adds a Conferência queue and receipt-line workflow: preserve declared quantity; record actual count and a mandatory reason for discrepancies or rejected units; classify AAA/B/C separately from blocked stock; generate medium boxes up to 100 units per flavor / class / batch with a partial remainder; choose destinations and explicitly retain liquid state; generate printable QR labels; inspect materials without pop classifications; confirm empty black boxes before marking them ready for factory return. Classification reference photos and documents can be selected for the current session. All of these remain prototype data, not persisted operational records. FIFO defaults to receiving date and can be edited; the final business date policy still needs confirmation.

- Distinguish full boxes, partial boxes, and the active caixa de separação.
- Keep container identity permanent, with a separate filling record for contents, batch, classification, quantity, and dates. Reusing a box must not erase its previous contents or movement history.
- Link receiving documents, incoming containers, counted quantities, classification results, and packed boxes for traceability. Packing and transfers must not create additional product stock.
- Keep em análise as a release status, AAA/B/C as a quality classification, liquid/frozen as a physical state, and location as a separate field.
- Retain expected document quantities and actual counted quantities, recording discrepancies.
- Prefer one flavor, classification, and batch per filled medium box for traceability; confirm batch rules with the owner.
- Preserve batch and classification traceability when selecting or replenishing the single caixa de separação for each flavor and state; the replenishment / mixing policy remains to be defined.
- Record the actual remaining quantity of a caixa de separação on each withdrawal. A photo or box count alone cannot establish its contents.
- Define the date used for FIFO and retain expiration separately; do not infer that repacking resets product age.
- Define a separate blocked / rejected outcome for goods that cannot be released; C is an intended-use classification, not an automatic release of every rejected item.

- Tailor shortcuts and dashboard visibility to user roles.
- Reserve equipment across the full operational interval, including preparation, delivery, event use, pickup, and turnaround / cleaning, rather than only event hours.
- Distinguish date-based reservations from actual readiness: an overdue return or broken item can prevent release even when no future booking conflicts.
- Link tasks and calendar entries to orders or events to avoid maintaining the same information twice.

## Questions for later design

- Which roles can view, create, approve, or change each record?
- At what request stage does a reservation become binding, and how are tentative holds handled?
- What preparation and cleaning buffers apply to equipment?
- Which billing figures and exceptions should the dashboard highlight?
- What task features are needed beyond a basic list with an owner, due date, and completion status?

This document records requirements and proposals; it does not imply that the system has been built.
