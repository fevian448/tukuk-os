SLUG: tak-product-suite-atak-wintak-tak-server
TITLE: The TAK Product Suite: ATAK, WinTAK, TAK Server and 34 Plugins Explained
EXCERPT: Team Awareness Kit (TAK) started as an Android mapping app and grew into a full Government-off-the-Shelf suite — ATAK, WinTAK, TAK Server, VR-TAK and a 34-plugin ecosystem. Here is how the whole family fits together, what each product does, and the rules that govern who can use it.
TAGS: tak, atak, wintak, geospatial, situational-awareness, defense-tech, plugins

## What TAK Is

**TAK — Team Awareness Kit** — is a suite of Government-off-the-Shelf (GOTS) situational-awareness software built around a geospatial mapping engine. The shared mental picture that TAK users build — who is where, what is happening, what is moving — runs on different platforms through different applications, but they all speak the same language on the network.

The core mapping engine was originally developed for **Android** (that is ATAK). Windows clients, a server product, a VR product and a large plugin ecosystem followed, and together they now form a mature enterprise product family. The **TAK Product Center** maintains the core products, which are available from the US Government **at no cost**, while third-party extensions live in the plugin catalog.

Two rules shape everything else on this page:

- Core products are USG property. Using them outside testing and evaluation requires a proper **Authorization to Operate (ATO)** from your organisation's headquarters.
- **TAK-MIL** is for US military use only, distributed only through the Program Management Office. The civilian line (**TAK-CIV**) is classified **EAR99** by the US Department of Commerce and released by the Department of Defense as open source.

## The Product Line

### ATAK — Android Team Awareness Kit

ATAK is the flagship: a free, extensible Android app for mapping, mission execution, navigation, chat and sensor integration. The civilian build, **ATAK-CIV**, is open source and published on GitHub (`TAK-Product-Center/atak-civ`). It is classified EAR99, which is why it can be distributed publicly.

Everything else in the ATAK world — most of the plugins below — plugs into this app's open API, extending the base mapping canvas with mission-specific tools for direct action, advice and combat support, law enforcement, force protection, border security and disaster response.

### WinTAK — Windows Team Awareness Kit

**WinTAK-CIV** is the Windows desktop counterpart. It gives command centres and planning cells the same operational picture as the people in the field, plus its own plugin line (reports, VNS navigation, GRG Builder, data sync, chat and more). Where ATAK is the tactical edge, WinTAK is the desk.

### TAKX

**TAKX** is the newest branch of the family, with its own plugin line. It represents the direction of the suite beyond the two classic clients.

### TAK Server

**TAK Server** is the platform's backbone: a tactical information-management server that brokers, stores and encrypts data across different networks. It is what you need when:

- clients cannot operate in a peer-to-peer network, or
- missions require encrypted, persisted data.

TAK Server enforces security in self-hosted and federated configurations. Client plugins such as **DataSync** and **Execution Checklists** depend on it — without a server, they simply have nothing to talk to. Federated-server configuration guides exist for every major release line (4.8 through 5.8).

### TAK Tracker

A lightweight, standalone Android app whose only job is sending location reports to TAK Server — plus chat and emergency messaging. Think of it as a minimal footprint for assets that do not need the full ATAK client.

### VR-TAK

**VR-TAK** brings the operational picture into virtual reality. It supports most commercial VR systems and also runs in desktop mode with keyboard and mouse. Official manuals exist for the 5.4 and 5.5.1 release lines.

## The 34 Plugins

Plugins are components that add specific features to an existing program — in ATAK's case through the app's open API, so they interact with the core mapping engine, ATAK tools and the Android platform itself. The current catalog lists **34 plugins**:

**Networking and communication**

- **TAK Chat** — secure chat with other systems over XMPP.
- **ICE Voice** — serverless push-to-talk over IP and MANET networks, with direct integration to Combat Net Radios (Silvus, Trellisware) or a bridged donor radio.
- **TAK TALK** — push-to-talk with automatic translation across three dozen languages. Only *text* is transmitted (speech → text → translate → re-speak with a voice clone), so it works even on extremely narrow links. It also has a solo mode for two people sitting together, via CoT device-to-device or a compact custom UDP multicast format.
- **WAVE** — secure VoIP using Motorola WAVE technology.
- **Beartooth MK II** — a low-SWaP mesh network for continuous detection and response.
- **Somewear** — satellite hotspot integration for BLOS communications and shared situational awareness, with claimed 100% global coverage across land, sea and air operations.
- **Network Monitor** — keeps properly configured radio networks on Android phones under control.

**Sensors, video and imagery**

- **Drone Hone** — processes openly broadcast Remote ID drone messages over WiFi and re-broadcasts them as Cursor-on-Target (CoT) to the network or TAK Server, giving everyone drone awareness from public signals. Android throttles it to roughly one Remote ID update per minute.
- **ADS-B Live** — pulls live air-traffic data (altitude, heading, speed) from a valid ADS-B API key for real-time shared air picture.
- **Video Collection** — one CoT marker can hold multiple video URLs (a building with several cameras, an unmanned system with several streams).
- **VANS** — an Open Systems Architecture video pipeline adding object detection to the core ATAK video player, running trained AI/ML models on end-user devices.
- **AVO** — Augmented Reality Video Overlay: improves the ATAK video player with AR user experience and situational widgets for metadata display.
- **HelmCam** — streams USB (UVC) camera video in MJPEG to other TAK devices over LAN or server, watchable in the Video Player Tool.
- **TAK ICU** — turns an ATAK device into a video source streamable to any other TAK device over shared IP.
- **GeoTAKCam / GeoTakCam** — camera capture with geospatial metadata (now also a standalone app).
- **Image Marker** — annotate captured or stored images with text, shapes and layers to convey additional intelligence.

**Mapping and mission tools**

- **Reports** — create, place, edit and upload multi-type reports with icons on the map, search and filters, local storage and server upload; includes built-in templates and custom report generation.
- **GRG Builder** — build GRG (KMZ) files from map views, map items and layers (map callouts, scale bar, compass, MGRS grid).
- **Block Generator** — converts polygons into `.block` files.
- **Fire Area Survey** — enhanced wildfire-area surveying: record paths travelled, merge segments, close them into polygons.
- **WASP** — Wide Area Search and Rescue Plugin: coordinates large-area search operations and post-disaster resource management (victims, structures, vehicles, hazards), shareable automatically with commanders and other responders.
- **Compass Nav** — access to the legacy compass tool, overriding the Quick Nav function.
- **Image Marker** and **GRG Builder** double as the everyday cartographic workhorses for both edge and desk users.

**Unmanned systems and navigation**

- **UAS Tool** — enhanced situational awareness for unmanned aircraft systems.
- **UGV Tool** — receive metadata, process full-motion video and control ground robots/rovers running MAVLink; split-screen and full-screen drive mode with virtual joystick and pedals, Android gamepad support via USB/Bluetooth, picture-in-picture FMV, custom buttons and servo support.
- **VNS** — Vehicle Navigation System plugin, with guides tracking versions 3.4 through 5.8 and Google Routes API key configuration.
- **Serial Monitor** — proper serial-port handling for popular laser rangefinders and GPS devices.
- **Wind Data** — fetches wind data from online sources and offline files at various altitudes for a tapped map location.
- **VISCA Cam** — connect and control IONodes IP cameras.

**AI, data and operations**

- **DataSync** — synchronise multiple ATAK devices involved in the same training exercise or event.
- **TAK Sensor** — a platform designed to make machine learning easy inside the TAK ecosystem.
- **TAK Replay** — record map and chat events in real time and replay them later in the Timeline Viewer, at normal or accelerated speed; recordings can also be downloaded from TAK Server for any chosen time window.
- **Night Vision** — a dimming application for use in low-light conditions.

## Training and Documentation

Behind the products sits a large documentation library — roughly **399 resources** on the official site: user guides, change logs, configuration manuals, quick-start guides, operator courses and offsite briefing decks, filterable by product, version, plugin, event and topic. Highlights include:

- **ATAK user guides** spanning releases 3.9, 4.0, 4.2, 4.3, 4.4, 5.1, 5.2, 5.7 and 5.8, plus matching change logs for every major line (including 4.10, 5.0, 5.3, 5.5, 5.6 and 5.8).
- **WinTAK guides and change logs** from 1.9 through 5.8, including the Reports, VNS, GRG Builder, DataSync and UAS Tool plugin manuals.
- **TAK Server configuration guides** for 4.6, 4.9, 5.2–5.8, plus the **Federated Hub configuration guides** (5.5, 5.6, 5.7, 5.8) and OS-level setup notes (Rocky Linux 8 OTA updates, CentOS 7 setup for 4.9).
- **VR-TAK manuals** for 5.4 and 5.5.1.
- **Specialist guides** — Keystone Cursor on Target basic and developer guides, USBP CoT implementation, MAVLink/PX4/APM UAS developer support, Gazebo simulator setup, Somewear setup, Beartooth quickstart, and ML model import into ATAK.

The official TAK Training Center packages these into a structured path: download your mission-specific build from the Products page, then build muscle memory on new features so you *respond* rather than react when it matters most.

## Getting and Using It

1. **Download** core products from the TAK Product Center — free, as they are USG-provided software.
2. **Extend** through the plugin catalog for anything the core apps do not do out of the box.
3. **Verify authorisation first.** Before installing or using any product, confirm your organisation's guidelines; anything beyond testing and evaluation needs an ATO from your HQ.
4. **Mind the line.** TAK-MIL has no public distribution. TAK-CIV is EAR99 and open source at `github.com/TAK-Product-Center/atak-civ`.

The suite is maintained by the TAK Product Center at 10221 Burbeck Avenue, Ft. Belvoir, VA 22060, with public resources through their FAQ, media centre, release schedule, careers page and developer community.

## Why It Matters Beyond the Military

Disaster response, wildfire surveying, law enforcement and border security all appear in the plugin ecosystem because the underlying problem is identical: many people, many sensors, one shared picture, often on degraded networks. TAK's design choices — CoT as a universal event format, a server you self-host, plugins for the long tail of hardware, and text-only voice transport when bandwidth is scarce — are a useful reference architecture for anyone building situational-awareness software, not just a catalogue of defence tools.
