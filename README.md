# Star Stream CLI (starstream-cli)

A gamified Node.js terminal wrapper inspired by Omniscient Reader's Viewpoint (ORV). It intercepts native shell workflows with an interactive RPG layer featuring scenarios, constellation interventions, regression cycles, and fable progression.

---

## Overview

Star Stream CLI wraps your operating system's native command execution environment (PowerShell, CMD, Bash) while maintaining a persistent RPG state in the background. As you execute daily developer commands (such as directory traversal, git workflows, or package scripts), the engine tracks your actions to clear Seoul Dome scenarios, generate coin rewards, and influence constellation favorability ratings.

---

## File and Module Breakdown

### Core Application Files
* **starstream.js**
  The primary entry point and engine of the project. It handles:
  * Windows Terminal settings detection and background image injection.
  * ANSI color palettes and dynamic terminal theme switching.
  * Child process execution for native shell commands and alias translation.
  * Persistent game state management (coins, stats, active scenario, favorability).
  * Constellation interaction loops, direct messaging, and favorability milestone triggers.
  * The built-in command interpreter (`status`, `scenario`, `contract`, `shop`, `fable`, `regress`, `guide`).

* **guide.txt**
  The offline, plain-text incarnation survival manual. It outlines mechanics, command references, sponsor traits, stat calculations, and progression milestones.

* **.starstream.json**
  The local JSON save file. It automatically tracks session attributes including current channel, coin count, incarnation name, stats (Physique, Agility, Magic), fables, active contract, and constellation favorability gauges.

### Assets
* **background.jpg**
  The primary background visual asset applied to Windows Terminal profiles by the automatic configuration routine.
* **background2.jpg**
  An alternate visual asset available for terminal customization.

### Configuration & Legacy Files
* **.gitignore**
  Specifies untracked files and directories to exclude from Git version control.
* **set-bg.js**
  A standalone utility script that modifies local Windows Terminal configuration files to apply backdrop images and transparency parameters. (Integrated directly into `starstream.js`).
* **index.js**
  An earlier entry point or launcher stub created during early prototyping.
* **starstream2.js**
  A secondary or backup implementation file preserved during development iterations.

---

## In-Game Commands

* **status**: Displays your incarnation stats, current turn, sponsor, stigma, and collected fables.
* **status name <name>**: Updates your visible incarnation handle.
* **scenario**: Shows the active scenario objective, progress, target requirements, and coin rewards.
* **contract [1-5]**: Displays sponsor candidates or signs a contract to unlock stigmas.
* **favor**: Displays favorability gauges and unlocked milestones for core constellations.
* **fable**: Opens the fable archive.
* **fable recite**: Recites an acquired story across the Star Stream to receive coin tributes.
* **sponsor**: Petitions watching constellations for coin donations.
* **shop**: Displays the Dokkaebi Bag inventory for stat increases, potions, and relics.
* **buy <code>**: Purchases an item from the Dokkaebi Bag.
* **regress**: Resets scenarios back to Scenario #1 and restores base coins while retaining stats, fables, and unlocked perks.
* **guide**: Opens the in-terminal user manual.
* **channel <id>**: Switches broadcast sub-channel frequency.
* **theme <name>**: Switches the active color palette.
* **clear**: Clears the console output and reprints the status dashboard.
* **exit / quit**: Terminates the Star Stream session.

---

## Setup and Usage

### Prerequisites
* Node.js v16 or later
* Windows Terminal (optional, recommended for automatic background support)

### Running the Terminal
1. Clone the repository:
   ```bash
   git clone [https://github.com/karn-blip/starstream-cli.git](https://github.com/karn-blip/starstream-cli.git)
   cd starstream-cli