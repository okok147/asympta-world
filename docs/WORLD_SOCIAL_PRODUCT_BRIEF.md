# Asympta World · Social Atlas

## Commission

Act as the product designer, artist and engineer for a native, location-aware social app. Build a real place for a small group of people to leave moments for one another and return to them. Treat the supplied Contexts image and the warm-paper atlas as visual direction. Keep Asympta World's own typography, live geography, fuzzy presence and personal space. Work autonomously for at least one hour of useful implementation, integration or release work. Make reversible product choices and explain them in the delivery record. Aim for the craft of the best native apps and the Apple Design Awards without implying an award, a ranking or measured customer demand.

## Person, promise and signature scene

Start with an existing small circle: a few friends who walk, make things or share a neighborhood. Opening the atlas should feel like unfolding a page someone has left for you. The reason to return is a real response from someone in your circle. The geography can give a moment context. A person also needs to be able to share from their sofa, without enabling location or exposing where they live.

1. A creates an invitation-only circle and sends a code through the iOS share sheet. B joins on an independent installation. C, without membership, cannot read the circle even if C knows its identifier.
2. A writes a short Moment, optionally chooses one image and decides whether to attach a broad map area. A sees the audience and area disclosure before pressing Share. Off is the default. The app creates one post even if a slow reply makes A retry. B can see the Moment after returning or refreshing.
3. B opens the Moment, leaves a short reply or presses an acknowledgement. A comes back and sees the reply in the circle's activity list, with a direct route back to the Moment and an explicit read state.
4. The reader can remove their own contribution, report harmful content or block its author. The circle host can inspect the report queue and remove material. Leaving a circle removes the member's contributions there. Other existing World data stays independent.

The counterargument is that a beautiful map may earn a first visit without earning a second one. The smallest signal that changes the product decision is two independent participants completing the reciprocal scene and returning later without prompting. Instrument only consented, aggregate product observations when such a measurement is separately needed. No invented usage, conversion or retention results.

## Interaction and visual language

- One canvas and one paper surface at a time. Keep the map airy. A small Circles entry opens a tactile native reader. Wide windows show the reader beside the atlas. Narrow windows use a system sheet and native navigation stack. The social surface should feel as considered as the geographic view.
- Use black-brown ink, warm paper and a short palette of rust, straw, cobalt and lilac. Use color as atmosphere and as a secondary signal. Pair unread color with a word or count. Distinguish a person’s fibrous aura from the stable tint of a Moment.
- Read the page in this order: circle, moment, author and time, response. Give photos room, use a readable text measure, protect caption wrapping and safe areas. Treat quiet empty, loading and failed states as finished screens.
- Native pull-to-refresh, system photo picker, share sheet, selection controls, navigation and confirmation dialogs. Every action has a readable accessibility name, a generous target and an unambiguous result. Preserve Dynamic Type and Reduce Motion. Provide screen-reader descriptions for controls and an author-supplied description for shared images when practical.
- Allow language to follow the existing World locale (en, zh-Hant, ja). Keep user-entered words and OSM names intact.

## Trust, privacy and service contracts

- Invitation-only beta. Membership is checked on the server for reading, posting, reply, photo, inbox and moderation. A per-installation Keychain capability authenticates requests. Derive distinct circle-scoped member IDs so public outputs do not expose bearer tokens or the identity used by the existing nearby presence service.
- Audience and geography are independent. A circle member can attach one coarse map cell, with a separate opt-in on each post. No latitude, longitude, exact fix, continuous travel history, nickname from another feature, or private journal contents are attached automatically. The atlas groups moments by area, with no pinpoint from a photo or post.
- Re-render selected photos to bounded pixels before upload. Keep metadata out of the stored image, bound request bytes, store images with the parent post and fetch them only by authorized readers. The app uploads only after the user presses Share.
- Keep the first release scoped and operationally bounded: small circles, bounded recent reads and per-member write limits, a report queue, a conservative text filter, block and removal. Log operational categories without content, invite codes or location. Server checks remain authoritative when the client is stale. Publish no broad public directory, public timeline or location-linked account identity in this batch.
- Preserve maps, live coarse presence, personal journal, preferences, growth, App Store bundle and TestFlight distribution. Use additive backend migration. Do not silently publish a new network endpoint to App Review, configure real billing or enable public discovery before its operational requirements are in place.

## Product economics

Core posting, joining, replying, shared collections, search and privacy controls are free. World Keepsakes offers original photo-and-text PDF composition, paper palettes and keepsake sharing. The native paywall uses Apple-returned monthly/yearly prices, transparent renewal terms, restore and management. The initial base-price hypothesis is US$3.99 monthly or US$29.99 yearly. Actual customer demand and willingness to pay remain unknown; a TestFlight transaction demonstrates purchase behavior only.

## Delivery and acceptance

- Freeze source and use the existing signed Internal TestFlight channel. Match the Worker deployment and app SHA. Verify version/build independently on the physical iPad without changing the user's viewing direction, rotation lock, audio, mute or system location settings.
- Test the actual circle create/join/share/reply/return flow with distinct authenticated participants, unauthorized access, data removal and report/block boundaries. A connected Mac client can prove an independent service participant; label it distinctly from a second native app or a second person. Separately inspect actual native art and interactions.
- Verify the poster can distinguish private sharing with and without a map area, a retry cannot duplicate a post, and a returning author can open an actual unread reply. Record precisely what was observed, what remains blocked and what was inferred. Preserve data and current device ownership.
- Keep the architecture map and release record current. An Apple upload, tool acknowledgement, mockup or attractive still is insufficient functional acceptance. Any product that opens broader UGC discovery requires a demonstrated moderation operation and a review of the then-current Apple requirements.

References: [Apple Design Awards](https://developer.apple.com/design/awards/), [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Discord Shop](https://support.discord.com/hc/en-us/articles/17162747936663-Shop-FAQ).

## Stage 4 reference-led specification · revision 2026-11-07.5

Canonical project card is [Asympta World](https://app.notion.com/p/41025c63c3ea815b9940e4c46b64fc7e). The Notion prompt page mirrors this specification and carries current evidence. The user selected Bump, Retro and Are.na and authorized continued implementation. Build18 is the verified starting product. Stage4 remains open until every requirement below has actual product evidence. A release batch does not close Stage4.

### Final experience and reference transfer

World is a private social atlas for existing friends. A person can arrive without granting location, start a circle, invite friends, share a moment, receive a reply and return directly to it. Members collect meaningful moments into named shared collections and revisit their lives by local-calendar week. Search finds existing words, authors and photo descriptions. A subscription pays for original keepsake and presentation tools with complete native purchase, restore and management flows. Identity continuity, data control and safety have explicit requirements.

- [Bump official product guide](https://help.bumpmaps.com/en/articles/11420926-how-bump-works) provides the map-to-person-to-conversation relationship, people/place search and consent controls. World uses its own broad aura presence and invitation audiences. Precise background tracking, automatic home/work detection and public rankings require separate product decisions.
- [Retro official app listing](https://apps.apple.com/us/app/retro-photos-with-friends/id6443709020) provides friends-only sharing, weekly life records, private collaborative albums and recap value. World adapts this through shared moments, local-calendar weekly reading and collections. Source content is never silently imported or shared.
- [Are.na official plans](https://www.are.na/about) provides editable shared collections, search and member-supported advanced tools. World collections retain the source post, author and original access rules. Fundamental safety and access to existing content remain available across paid states.

### Visual references actually inspected on Pinterest

- [Gradient data visualisation in app](https://www.pinterest.com/pin/1045679607242674243/) is the same image supplied by the user. Use cream ground, diffuse rust/yellow/blue/violet fields and deliberate spacing. Keep body text sharp and controls identifiable.
- [Klad friends map](https://www.pinterest.com/pin/421790321371212948/) demonstrates readable subdued cartography with a consistent marker system and compact search/navigation. World retains its original aura and geographic renderer.
- [Travel Photo Album as a Stamp Collection](https://www.pinterest.com/pin/827255025346358608/) shows small album covers, meaningful whitespace and tactile collected-photo framing. Transfer the collection hierarchy and sense of keeping a memory, with original renderings.

These are visual observations and official-description research. They are not firsthand tests of the reference apps or user research.

### Product rules and delivery scope

All social content stays behind current membership. Collections reference existing moments instead of copying their private media into a new audience. A removed, reported or blocked contribution disappears from collection reads and counts under the same rules as the feed. Collection writes carry stable IDs or desired states. A member leaving or being removed also clears their authored collection content and additions as defined by the service.

Weekly ranges use the current local calendar, including daylight-saving changes. Search covers the circle's stored history with deterministic pagination. Empty, loading, retry, missing-membership and partial-network states must be usable. Older clients and already-created circle databases must continue working through additive migration.

The proposed subscription is World Keepsakes. Initial price hypothesis is US$3.99 monthly or US$29.99 yearly, localized by the App Store. The proposed paid value is composed keepsake export and additional presentation tools. Purchase UI displays only Apple-returned prices and actual available products. Verification uses StoreKit signed transactions, revocation/upgrades, subscription state and restore. Existing content and free social functions stay accessible after expiry. Product setup, sandbox purchase, cancellation/restore and entitlement verification remain separate evidence. No paid state is inferred from a preference or a mocked receipt.

### Requirements and completion criteria

| ID | Required final behavior | Current state and evidence |
| --- | --- | --- |
| S4-01 | An invitee can understand the audience, join privately, share and return to a real reply. Outsiders cannot read the circle. | Build18 native and deployed-service evidence covers two test circles and independent Mac participants. Second native participant pending. |
| S4-02 | Atlas offers clear people/context navigation, optional broad presence and a route back to relevant social content. | Existing aura/map and selected-circle area context implemented. Reference-led navigation completion pending. |
| S4-03 | Moment text and a selected described photo can be prepared, kept as a protected draft, reviewed with audience/area disclosure and shared once across uncertain retries. | Build18 draft/text/area-off physical pass. Real photo-picker and interrupted-send scenes pending. |
| S4-04 | Full history can be searched by words, author and photo description, with no duplicates across pages. A local week can be selected and its actual stored moments read. | Build19 implemented. Deployed service verified Unicode/author search, week bounds and deterministic pagination. Build20 actual native word search and Nov2–8 weekly reading passed; author/description-specific native scenes remain pending. |
| S4-05 | Members create named collections, save and remove existing moments collaboratively, inspect saved state and open the original. Owner/host can remove a collection. Hidden content never leaks through collection details or counts. | Build19 implemented. Live independent members verified desired-state writes, private access, visibility, ownership, tombstones and leave cleanup. Build20 native creation, save picker, collaborative two-item collection and original listing observed. Native removal/host deletion remain pending. |
| S4-06 | Cross-circle reply inbox opens each original post and marks only that post's displayed replies read. | Build18 physical two-circle pass and badge 2 to 1 to clear. |
| S4-07 | Report, block, unblock, host review, member removal, invitation replacement and leave apply consistently across feed, search, inbox and collections. | Existing moderation implemented. Build19 deployed-service report/block visibility and collection counts verified. Same-build native surfaces pending. |
| S4-08 | Identity continuity/recovery and complete social-data removal have explicit, usable flows and verified authorization. A person can export their own accessible data. | Build20 implements encrypted identity backup/import, candidate-membership verification, protected directory migration and interrupted-commit replay. Physical acceptance and complete all-data deletion remain pending. |
| S4-09 | World Keepsakes provides real recurring value with native products, localized terms/prices, purchase, pending/cancel/failure, restore, manage and verified expiry/revocation behavior. | Build19 StoreKit flow implemented; Apple products configured at USD3.99/month and USD29.99/year base prices for USA/HKG/JPN. Apple currently reports MISSING_METADATA. Build21 actually opened the paywall, which reported plans unavailable. Apple products remain MISSING_METADATA; a real review screenshot upload was rejected for nonstandard native capture dimensions. No offer, purchase or paid unlock is accepted. |
| S4-10 | Keepsake tools create a readable original artifact from permitted content, preserve attribution and support the native share sheet with protected temporary files. | Build19 implements original photo/text PDF preview, three paper palettes, protected temporary artifacts, permission recheck, free text archive and native sharing. Build20 native PDF cover preview generated. Build21 physically confirmed the soft cover pigment, wider side panel, and original photo/author/text inner page. Native share and paid unlock remain pending because actual StoreKit plans were unavailable. |
| S4-11 | New surfaces match the cream/color-field/seal system, support iPhone/iPad geometry, Dynamic Type, VoiceOver, reduced motion and all three selected languages. | Existing native system reused. New surface exact-build verification pending. |
| S4-12 | Server migration, bounded queries, concurrency, cancellation and retries preserve correct state. Offline/partial results communicate their limits and provide recovery. | Build19 live service verified additive migration, bounded pagination, idempotent writes, conflicting retries and collection cleanup. Native offline/cancellation outcomes remain pending. |

### Build19 distribution and remaining native acceptance

Build19 exact source is `8a31ce126a7bfaceebf07ee2f1efc4036b8db9fc`, exported IPA SHA-256 `277f54ed429e6ae0e3f4d0a39d028087ab3b98bae69b733adaa1f18a5ea74fd4`. Apple build `e2dae772-bd1b-47b2-917a-b97b69bc7f6b` is VALID and available to Internal Testers. The deployed Worker is `5e0b001e-3f77-4627-944e-7dd67b8caf1f`. Private operational evidence remains outside Git; live acceptance receipt is `work/build19/library-live-receipt.json` in the owning workspace.

The Air lease allowed one native TestFlight observation. Before selecting World, the passive foreground probe became unavailable and the human-use guard stopped the next scene with zero executed steps. The lease was released and read back as no longer owned. No claim is made that Build19 was installed or its new native features tested. Home closeout could not be verified after the protection changed. Stage4 remains open.

### Simulated perspectives and decisions

The following are simulated design critiques, not human participation or completed product trials. The next actual TestFlight scene must attach version, actions and observations to the affected requirements.

- A time-limited friend wants to find a past moment quickly. Success is search to the right original in a few deliberate actions. Prioritize author/text search and weekly history.
- A circle organizer wants a shared album to retain stories without widening access. Success is two members adding to the same collection with moderation still effective. Keep collections inside each circle.
- An artist wants gentle atmosphere with readable text and original forms. Keep color fields behind seals/covers and a strong text hierarchy. Avoid blur beneath long reading content.
- A platform designer prioritizes one native navigation stack, accessible rows, local calendar dates and clear failure states. Favor reusable system controls and source-preserving original-post routes.

The main tension is expressive collected memories versus rapid scanning. Resolve it with restrained covers and compact text metadata, then verify actual reading and saving on the same TestFlight build. Demand, retention, conversion, human artistic approval and 10x comparisons are unknown.


### Actual native20 feedback and next batch · 2026-11-07

On official1.0(20), the private-circle creator path completed text draft retention/reopen, text publication and a separate Mac participant reply. The collector path completed Save to collection/New Sea Notes, native search, weekly reading and two-member/two-moment collection listing. The keepsake path reached a real PDFKit cover preview. These are tool-observed scenarios with simulated user goals, not human research or subscription conversion evidence. A dedicated test texture supplied the peer photo; personal Photo Library was not accessed.

Material findings: the PDF cover was a hard rust circle, the fixed350pt inspector cramped reading, and English singular counts used plurals. Build21 changes the pigment gradient to opaque paper-blended RGB, adapts the landscape panel width and centralizes selected-language counts. Required distribution and same-build physical verification remain pending. Encrypted recovery, actual native StoreKit offers/purchase/restore, all-data removal and remaining acceptance rows stay open. The old device slot expired before Home/QA-circle cleanup; ownership ended, but closeout is unverified and queued separately.


### Native21 acceptance and data-control continuation · 2026-11-07

Build21 exact app source19293c5fbe6754b34894a463419a3787875aec29 reached VALID/Internal TestFlight and was independently installed as1.0(21) on Air. The original collaborative collection survived update; native screenshots confirmed the wider reading panel, English1 reply, soft paper pigment and original photo/author/text PDF inner page. Native StoreKit reported no available plans, and Apple metadata remains incomplete. A real review screenshot was refused IMAGE_INCORRECT_DIMENSIONS; no generated/edited priced screenshot or real payment was used. Recovery entry has not been accepted.

The new device slot closed World and verified iPadOS Home, stopped the exact designated operator and released successfully; fresh pool readback showed no World owner/waiter and the next Writing owner. No audio/view/rotation setting was changed. The private QA circle remains for subsequent scenes.

S4-08 backend source now implements durable explicit identity removal for indexed and supplied circles, revocation, original-contribution cleanup, safe late-write tombstones and progress. Required TypeScript compilation passed, deployment/live acceptance and native journal/UI remain in progress. Unknown historical circles, independent local data, external exports and Apple subscriptions must be clearly separated. This is not a completed global/all-data deletion feature. Stage4 stays open.
