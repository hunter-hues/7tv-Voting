# CSS Class Reference Guide

This document provides a complete reference of all CSS classes used in the codebase, organized by category and purpose.

---

## Table of Contents
1. [Utility Classes](#utility-classes)
2. [State Classes](#state-classes)
3. [Layout & Structure](#layout--structure)
4. [Voting Interface](#voting-interface)
5. [Forms](#forms)
6. [Popups/Modals](#popupsmodals)
7. [Filter & Sort](#filter--sort)
8. [Emote Set Display](#emote-set-display)
9. [Class Relationships](#class-relationships)
10. [HTML IDs (for reference)](#html-ids-for-reference)

---

## Utility Classes

### `.hidden`
- **Purpose**: Hides elements completely (`display: none !important`)
- **Usage**: Applied/removed dynamically to show/hide elements
- **Used on**: Login section, dashboard, error messages, tabs, sections, buttons, etc.
- **Important**: This is a core utility class - always present in styles.css

---

## State Classes

### `.active` / `.inactive`
- **Purpose**: Indicates selected/active state vs not selected
- **Usage**: Mutually exclusive - element always has one OR the other (never both, never neither)
- **Used on**:
  - Vote buttons: `.vote-button.vote-keep.active` (user voted keep)
  - Tabs: `.tab-button.active` (selected tab)
- **Important**: Only one `.active` per group (one vote button per emote, one tab at a time)

### `.expired`
- **Purpose**: Marks expired/inactive content
- **Usage**: Added when event/item is expired
- **Used on**:
  - Event buttons: `.event-button.expired`
  - Time info: `.event-time-info.expired` or `.time-info.expired`
- **Can combine**: Works with other classes (e.g., `event-time-info expired`)

---

## Layout & Structure

### Main Containers
- `#login-with-twitch-section` - Login page container
- `#dashboard` - Main app container  
- `#content-area` - Main content area (no class, just ID)

### Event Display
- `.event-info-header` - Header showing event title, creator, time, stats
- `.event-title` - Event title (h2)
- `.event-creator-info` - Creator info text
- `.event-time-info` - Time remaining/ended info
  - **Modifiers**: `.expired` or `.active`
- `.vote-statistics` - Vote count statistics

### Event Buttons
- `.event-button` - Base class for event list buttons
  - **Modifiers**: `.permission-all`, `.permission-followers`, `.permission-subscribers`, `.permission-specific`
  - **State**: `.expired` (if event expired)
- `.username-and-title` - Username and emote set name
- `.vote-title` - Event title inside button
- `.vote-event-id` - Event ID number
- `.time-info` - Time remaining/ended
  - **State**: `.expired` (if expired)
- `.total-votes` - Total votes count text

### Event Sections
- `.active-events-section` - Container for active events
- `.active-events-list` - Scrollable list of active event buttons
- `.expired-events-section` - Container for expired events
- `.expired-events-list` - Scrollable list of expired event buttons
- `.section-title` - Base class for section headings
  - **Modifiers**: `.active-section-title`, `.expired-section-title`
- `.no-results-message` - "No events match" message

---

## Voting Interface

### Emote Display
- `.emote-div` - Container for each emote with vote buttons
- `.emote-voting-grid` - Grid container for all emotes

### Vote Buttons
- `.vote-button` - Base class for all vote buttons
  - **Types**: `.vote-keep`, `.vote-neutral`, `.vote-remove`
  - **States**: `.active` (user's current vote) or `.inactive` (not user's vote)
- **Example combinations**:
  - `.vote-button.vote-keep.active` - User voted "keep"
  - `.vote-button.vote-keep.inactive` - User didn't vote "keep"
  - `.vote-button.vote-neutral.active` - User voted "neutral"
  - `.vote-button.vote-remove.active` - User voted "remove"

### Pagination & Controls
- `.emote-pagination-controls` - Container for search, sort, pagination
- `.controls-left` - Left side controls (search, sort)
- `.controls-right` - Right side controls (prev, page info, next)
- `.emote-search-input` - Search input for emotes
- `.emote-sort-select` - Sort dropdown
- `.emote-page-info` - Page number text
- `.emote-page-button` - Previous/Next buttons

### Messages
- `.expired-message` - "Event expired" banner
- `.edit-event-button` - "Edit Event" button

---

## Forms

### Form Structure
- `.form-section` - Container for form fields
- `.form-label` - Label text
- `.form-input` - Text inputs

### Time/Duration Inputs
- `.tab-container` - Container for duration/end time tabs
- `.tab-button` - Tab buttons
  - **States**: `.active` (selected) or `.inactive` (not selected)
- `.time-tabs` - Content area for duration or end time
  - **State**: `.hidden` (when not active tab)
- `.duration-input-group` - Container for days/hours/minutes inputs
- `.duration-label` - Label for days/hours/minutes
- `.duration-input` - Number inputs for days/hours/minutes

### Specific Users Section
- `.specific-users-section` - Container for user list (initially `.hidden`)
- `.specific-users-label` - "Allowed Users" label
- `.specific-users-input` - Username input field
- `.add-user-button` - "Add User" button
- `.edit-users-list` - Container for list of added users
- `.user-item` - Individual user in the list
- `.remove-user-button` - Remove button for each user

### Error Messages
- `.error-message` - Base class for error text
  - **State**: `.hidden` (when error not shown)
- **Note**: All error messages now use `.hidden` consistently (fixed inconsistency)

---

## Popups/Modals

### Popup Structure
- `.popup-backdrop` - Dark overlay behind popup
- `.popup-container` - Main popup box
- `.popup-header` - Header section with title and close button
- `.popup-header-title` - "Edit Voting Event" title
- `.popup-close-button` - "x" close button

### Popup Forms
- `.popup-form-section` - Form section in popup
- `.popup-button-section` - Container for action buttons
- `.popup-button` - Base class for popup buttons
  - **Modifiers**: `.save-button`, `.end-now-button`

---

## Filter & Sort

### Filter Section
- `.filter-sort-section` - Main container for all filters
- `.filter-grid` - Grid layout for filter dropdowns
- `.filter-label` - Labels for filter dropdowns
- `.filter-select` - Filter dropdown selects
- `.filter-search-input` - Search input for events

---

## Emote Set Display

### Emote Set List
- `.emote-set` - Button for each emote set
- `.preview-emotes` - Container for emote preview images
- `.emote` - Individual emote preview image

---

## Class Relationships

### 1. Mutually Exclusive States
- **Vote buttons**: Always `.active` OR `.inactive` (never both, never neither)
- **Tabs**: Always `.active` OR `.inactive`
- **Error messages**: Either `.hidden` OR visible (no class)

### 2. Class Combinations
- **Multiple base classes**: `.vote-button.vote-keep` (both classes together)
- **Base + modifier**: `.section-title.active-section-title`
- **Base + state**: `.event-button.expired`
- **Dynamic classes**: `.permission-${level}` (becomes `.permission-all`, `.permission-followers`, etc.)

### 3. When Classes Change
- **On click**: Vote buttons, tabs, filters
- **On input**: Form validation (show/hide errors)
- **On API response**: Vote counts update, button states change
- **On filter**: Buttons get `.hidden` added/removed

---

## HTML IDs (for reference)

These are IDs, not classes, but useful to know:
- `#login-with-twitch-section`
- `#login-with-twitch-btn`
- `#dashboard`
- `#content-area`
- `#available-votes-btn`
- `#create-vote-btn`
- `#profile-btn`
- `#emote-set-list`
- `#vote-creation`
- `#filter-sort-section`
- `#status-filter`
- `#permission-filter`
- `#creator-filter`
- `#sort-select`
- `#search-input`
- `#edit-button`
- `#vote-statistics`

---

## Quick Reference by File

### `index.html`
- `#login-with-twitch-section` (with `.hidden`)
- `#dashboard` (with `.hidden`)

### `main.js`
- Toggles `.hidden` on login/dashboard sections

### `displayVoteCreation.js`
- Form classes: `.form-section`, `.form-input`, `.form-label`
- Tab classes: `.tab-button`, `.tab-container`, `.time-tabs`
- Error classes: `.error-message` (with `.hidden`)
- Duration classes: `.duration-input`, `.duration-label`, `.duration-input-group`
- User management: `.specific-users-section`, `.user-item`, `.add-user-button`, `.remove-user-button`

### `votingInterface.js`
- Event display: `.event-info-header`, `.event-title`, `.event-creator-info`
- Vote buttons: `.vote-button`, `.vote-keep`, `.vote-neutral`, `.vote-remove` (with `.active`/`.inactive`)
- Event buttons: `.event-button` (with `.permission-*` and `.expired`)
- Popup: `.popup-backdrop`, `.popup-container`, `.popup-header`, etc.
- Filter: `.filter-sort-section`, `.filter-grid`, `.filter-select`

### `emotedisplay.js`
- `.emote-set`, `.preview-emotes`, `.emote`

---

## Notes for Styling

1. **Always check for state classes**: Many elements have `.active`/`.inactive` or `.expired` modifiers
2. **Permission classes are dynamic**: `.permission-all`, `.permission-followers`, `.permission-subscribers`, `.permission-specific`
3. **Error messages**: Always start with `.hidden`, remove it to show
4. **Vote buttons**: Always have both base class (`.vote-button`) and type (`.vote-keep`), plus state (`.active`/`.inactive`)
5. **Tabs**: Always have `.active` or `.inactive`, never both

---

*Last updated: After fixing `.visible`/`.hidden` inconsistency*

