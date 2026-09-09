# YOLO — Business and operations reference

Last updated: 2026-09-09

## Purpose

Reusable context for agents and people working on YOLO's operations and ERP. Confirmed facts below come from the business owner. Proposed ERP implications are listed separately and are not confirmed business policies.

## Business and product — confirmed facts

- YOLO is an ice pops business that owns its brand and formulation.
- YOLO is a ready-to-drink (RTD) product with 6% alcohol content.
- A third-party producer mixes the alcohol for the product.
- YOLO uses its own machine, installed at that producer's facility, to produce the pops.
- Each YOLO Pop is packaged in an 80 mL sachet.
- The manufacturer ships the pops in liquid form to YOLO's warehouse / operations room in São Paulo.
- This location is in one large building containing both offices and stock.
- YOLO keeps the received pops in liquid form. They are frozen later when needed.
- Customers can buy the product liquid and freeze it themselves, or buy it already frozen.
- YOLO also freezes products for frozen delivery, including for events. Operations can involve a mix of liquid and frozen products.

## Operations and ERP needs — stated by the owner

- Record receiving of YOLO Pops and other goods, notas fiscais, and associated receiving information.
- Allow administrators to create and name inventory locations. Goods enter a receiving location and can be transferred to other locations.
- Let salespeople submit requests remotely through an editable form. Requests can cover sales, samples, other requests, and events.
- Route requests to the e-commerce shipping room for preparation, authorization, and marking as ready for collection or delivery.
- Plan event quantities, additional equipment and materials, delivery and pickup dates and times, and the people responsible for each trip.
- Reconcile returned pops and other items, including trade materials, tables, flyers, banners, desks, freezers, and ice cream carts.
- Hold returned items for inspection, then move appropriate items into a clean, ready-to-use and available state.
- Connect receiving, inventory, condition, location, equipment, deliveries, pickups, sales, billing, and payment tracking.
- Address a current operational gap: products and items are sent out for sales, but client billing is not consistently completed. Track whether clients have been billed and whether payment has been received.

## Proposed ERP implications — validate before implementation

- Track liquid versus frozen separately from physical location and availability / inspection status.
- Model freezing as a recorded change in product state, preserving quantity and batch traceability, rather than as an additional receipt that increases total stock.
- Capture requested and dispatched product state on orders and deliveries, supporting liquid and frozen quantities as needed.
- Do not assume inbound products arrive frozen or that all stock is kept frozen.
- Distinguish product quantities, consumable materials, and reusable assets for dispatch and return reconciliation.
- Link dispatches to billing review and payment tracking, with an explicit approved no-charge outcome for applicable requests.

## Open questions

- What storage conditions and shelf-life rules apply to liquid and frozen products?
- How are freezing, batch identification, expiration dates, and stock counts managed today?
- What rules determine whether returned products can be made available again? Do not assume thawing or refreezing is permitted.
- Are liquid and frozen products priced differently?
- How are events charged: quantity sent, quantity sold / consumed, a fixed package, or another agreement?
- Which tools currently issue invoices / notas fiscais and track payments?
- Who approves requests, samples, and discounts?

## Guidance for future agents

See YOLO-operational-system-requirements.md for the interface, dashboard, shared calendar, equipment reservation, and task requirements, and the accepted direction for Shopify / Bling boundaries.

Use confirmed facts as context, not as a substitute for checking current operational policies. Keep owner-confirmed information separate from proposals. Update this reference as the owner provides new details, retaining unresolved questions rather than inventing answers.
