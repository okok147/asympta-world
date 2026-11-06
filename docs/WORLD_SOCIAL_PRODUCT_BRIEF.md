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

Core posting, joining, replying and privacy controls are free. The first optional purchase should make a profile and its shared content feel more like its owner. Explore a coordinated Founders' style collection after the social loop works. A future recurring Circle Studio offer serves organizers who already need schedules, shared curation and recurring activity tools. Make pricing and renewal transparent and restore purchases. Establish repeat organizer use before selling a subscription. A local preview or a TestFlight transaction demonstrates UX, not willingness to pay.

## Delivery and acceptance

- Freeze source and use the existing signed Internal TestFlight channel. Match the Worker deployment and app SHA. Verify version/build independently on the physical iPad without changing the user's viewing direction, rotation lock, audio, mute or system location settings.
- Test the actual circle create/join/share/reply/return flow with distinct authenticated participants, unauthorized access, data removal and report/block boundaries. A connected Mac client can prove an independent service participant; label it distinctly from a second native app or a second person. Separately inspect actual native art and interactions.
- Verify the poster can distinguish private sharing with and without a map area, a retry cannot duplicate a post, and a returning author can open an actual unread reply. Record precisely what was observed, what remains blocked and what was inferred. Preserve data and current device ownership.
- Keep the architecture map and release record current. An Apple upload, tool acknowledgement, mockup or attractive still is insufficient functional acceptance. Any product that opens broader UGC discovery requires a demonstrated moderation operation and a review of the then-current Apple requirements.

References: [Apple Design Awards](https://developer.apple.com/design/awards/), [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Discord Shop](https://support.discord.com/hc/en-us/articles/17162747936663-Shop-FAQ).
