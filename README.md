# Instagram Web: a cross-platform social app built with Expo, React Native Web and Supabase

An Instagram-style app written once in **React Native + TypeScript** and run in the **browser** (desktop and mobile) through **React Native Web**. The same code can also run on iOS and Android through Expo. **Supabase** provides the backend: user accounts, the database, photo storage and real-time updates.

Users can sign up and log in, **block** accounts they don't want to interact with, scroll a feed, post photos from their gallery, camera or an image URL, share 24-hour stories, like (including double-tap), comment, save and follow, search and browse a photo grid, chat in real time through direct messages, and edit their profile (photo, username, name, bio).

---

## Table of contents

1. [The motive: what this project is for](#1-the-motive-what-this-project-is-for)
2. [Quick start](#2-quick-start)
3. [Supabase setup (step by step)](#3-supabase-setup-step-by-step)
4. [Tech stack and why each piece was chosen](#4-tech-stack-and-why-each-piece-was-chosen)
5. [Architecture in one picture](#5-architecture-in-one-picture)
6. [How data flows (the single most important idea)](#6-how-data-flows-the-single-most-important-idea)
7. [The database](#7-the-database)
8. [File-by-file guide](#8-file-by-file-guide)
9. [Feature walkthroughs (what happens when you tap X)](#9-feature-walkthroughs-what-happens-when-you-tap-x)
10. [Responsive design](#10-responsive-design)
11. [Design decisions worth mentioning](#11-design-decisions-worth-mentioning)
12. [Known limitations](#12-known-limitations)
13. [Troubleshooting](#13-troubleshooting)
14. [How to extend it](#14-how-to-extend-it)
    - Also read: [Moderation and admin (design note)](#moderation-and-admin-design-note)
15. [Presentation cheat sheet](#15-presentation-cheat-sheet)

---

## 1. The motive: what this project is for

The goal is to show that **one TypeScript codebase can deliver a polished, Instagram-quality experience on the web and on phones, backed by a real cloud database**, adapting its layout to the screen it is on:

- On a **phone-sized** screen it behaves like the mobile app: top header, bottom tab bar, one column.
- On a **desktop** screen it behaves like instagram.com: a left sidebar, with the feed centered in a fixed-width column and a "Suggested for you" panel on the right.

It also demonstrates the core skills behind any modern full-stack app:

| Skill | Where you can see it |
|---|---|
| Component-based UI | Every file in `src/components/` |
| Centralised state management | `src/store/AppContext.tsx` (React Context + reducer) |
| Authentication | `src/store/AuthContext.tsx`, `src/components/AuthScreen.tsx` |
| Database design and security | `supabase/schema.sql` (tables, triggers, row level security) |
| File uploads | `src/lib/storage.ts` (Supabase Storage) |
| Real-time features | Live messages and notifications in `AppContext.tsx` |
| Strong typing | `src/types.ts` and typed props throughout |
| Responsive layout | `src/hooks/useBreakpoint.ts`, `Navigation.tsx`, `App.tsx` |
| Animation | Double-tap heart in `PostCard.tsx`, story progress bar in `Stories.tsx` |
| Device features | Camera and gallery through `expo-image-picker` |

---

## 2. Quick start

You need **Node.js 22.13 or newer** (Expo SDK 58 requires Node 22.13+, 24.3+ or 26+; odd-numbered versions like 23 and 25 are not supported; check with `node -v`) and a free **Supabase** account.

```bash
npm install
# 1. do the Supabase setup in section 3 (about 5 minutes)
# 2. then:
npx expo start -c     # press  w  to open it in your browser
```

Other scripts:

```bash
npm run web           # same as: npx expo start --web
npm run android       # needs an Android emulator or device
npm run ios           # needs macOS + Xcode
npm run build:web     # static production export into dist/
npm run typecheck     # run the TypeScript compiler without emitting files
```

**This project targets Expo SDK 58** (React Native 0.88), matching the current Expo Go app. Expo Go can only open projects built for the SDK version it ships with, so the SDK in `package.json` must match your phone's Expo Go.

The other package versions in `package.json` are left for Expo to choose, because Expo knows exactly which versions go with each SDK. For the **first install**, use this instead of a plain `npm install`:

**macOS / Linux / Git Bash:**

```bash
rm -rf node_modules package-lock.json
npx expo install expo@^58.0.0 --fix        # installs SDK 58 and aligns every Expo/React Native package
npx expo-doctor@latest                      # optional health check
```

**Windows PowerShell** (`rm -rf` does not work there):

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npx expo install expo@^58.0.0 --fix
npx expo-doctor@latest
```

> **Check your Node version first with `node -v`.** SDK 58 supports Node **22.13+**, **24.3+** or **26+**. Odd-numbered releases (23, 25...) are **not** supported, so if you see `v25.x` install the **LTS** version (22 or 24) from [nodejs.org](https://nodejs.org), then open a new terminal and check again. If you use nvm-windows: `nvm install 22` then `nvm use 22`.

Then continue with the Supabase setup and `npx expo start -c`. Commit the updated `package.json` and lock file afterwards so a fresh `npm install` works for everyone (including when you clone from GitHub).

To try it on a phone, run `npx expo start` and scan the QR code with the Expo Go app, or open the printed network URL in your phone's browser.

> Until you create the `.env` file, the app shows a **"Connect Supabase to continue"** screen instead of crashing.

---

## 3. Supabase setup (step by step)

1. **Create a project** at [supabase.com](https://supabase.com) (New project). Wait for it to finish provisioning.
2. **Create the database.** Open **SQL Editor > New query**, paste the whole contents of `supabase/schema.sql`, and press **Run**. This creates every table, trigger, security policy, the storage bucket, and turns on real-time for messages and notifications. It is safe to run more than once.
3. **Add your keys.** Copy `.env.example` to a new file named `.env`. In Supabase go to **Project Settings > API** and paste:
   - `EXPO_PUBLIC_SUPABASE_URL` = the **Project URL**
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = the **anon public** key
   
   > Only ever use the **anon** key in this app. The `service_role` key bypasses all security and must never be put in front-end code. The anon key is safe to ship because the security policies from step 2 decide what each user may read and write.
4. **Make sign-up easy while developing.** In **Authentication** settings (Providers > Email), you can switch **"Confirm email"** off so new accounts can log in immediately. If you leave it on, users must click the link in their confirmation email first; also set **Authentication > URL Configuration > Site URL** to `http://localhost:8081` so the link returns to your app.
5. **Restart the dev server with a clean cache** so it picks up the new `.env`: `npx expo start -c`.
6. **Test it.** Sign up an account. Open a second account in a private/incognito window to test messages, follows and notifications between two real users.

The app starts **empty**, because there is no mock content any more. Create a couple of accounts, post a few photos, and the feed fills up.

---

## 4. Tech stack and why each piece was chosen

| Technology | Role | Why |
|---|---|---|
| **Expo (SDK 58)** | Toolchain and runtime | Handles bundling (Metro), dev server, web export and native builds with almost no config. |
| **React Native** | UI primitives (`View`, `Text`, `Pressable`, `FlatList`...) | One component model for web, iOS and Android. |
| **React Native Web** | Translates React Native components into real HTML/CSS in the browser | This is what makes the app run in a browser. |
| **TypeScript (strict)** | Language | Catches mistakes early; the types double as documentation. |
| **Supabase Auth** | Sign up, log in, sessions | Email + password accounts with secure tokens and no server code to write. |
| **Supabase Postgres** | Database | A real relational database; security rules live next to the data. |
| **Supabase Storage** | Photo hosting | Stores uploaded post, story and profile images and serves them by public URL. |
| **Supabase Realtime** | Live updates | Pushes new messages and notifications to the app instantly. |
| **`@supabase/supabase-js`** | Supabase client library | One API for auth, queries, storage and realtime. |
| **`@react-native-async-storage/async-storage`** | Saved login | Keeps users signed in across restarts (uses localStorage on the web). |
| **`react-native-url-polyfill`** | URL support on phones | Supabase's client expects the standard `URL` class. |
| **React Context + `useReducer`** | Global state | Built into React, no extra dependency; the reducer keeps every change in one place. |
| **`@expo/vector-icons` (Ionicons)** | Icons | Instagram-style outline and filled icons on every platform. |
| **`expo-linear-gradient`** | Gradient story rings | The orange-pink-purple ring around story avatars. |
| **`expo-image-picker`** | Gallery and camera | One API for choosing or capturing photos on web and native. |
| **`react-native-safe-area-context`** | Safe areas | Keeps content out of phone notches and home indicators. |

Styling uses plain **`StyleSheet.create`**: no CSS files and no extra styling library. Every component keeps its styles at the bottom of its own file.

---

## 5. Architecture in one picture

```
index.ts                          registers the app with Expo
   └── App.tsx                    root component
         └── AuthProvider ◄────── src/store/AuthContext.tsx   (who is logged in)
               └── Gate           decides what to show:
                     ├── no .env keys      → SetupNotice
                     ├── checking session  → LoadingScreen
                     ├── logged out        → AuthScreen (log in / sign up)
                     └── logged in         → AppProvider ◄── src/store/AppContext.tsx
                                               │              (ALL app data + actions,
                                               │               talks to Supabase)
                                               └── Shell      (layout + which tab is open)
                                                     ├── Sidebar            (tablet/desktop) ┐
                                                     ├── MobileHeader       (phone)          │ Navigation.tsx
                                                     ├── BottomTabs         (phone)          ┘
                                                     ├── ONE screen at a time, chosen by `tab`:
                                                     │      home     → Feed      → Stories + PostCard list + Suggestions
                                                     │      explore  → Explore   → PhotoGrid (+ PostViewer modal)
                                                     │      activity → Activity
                                                     │      messages → Messages  → inbox + Chat
                                                     │      profile  → Profile   → PhotoGrid + EditProfileModal + PostViewer
                                                     ├── CreatePostModal   (post or story)
                                                     └── Toast

            ┌────────────────────────── Supabase (cloud) ──────────────────────────┐
  src/lib/  │  Auth  ·  Postgres tables (RLS-protected)  ·  Storage  ·  Realtime  │
            └──────────────────────────────────────────────────────────────────────┘
```

Three ideas hold it together:

1. **`App.tsx` owns navigation.** The `Gate` decides between setup, login and the app; the `Shell` remembers which tab is active (`tab`) and whether the Create modal is open (`creating`).
2. **`AuthContext.tsx` owns identity.** It knows who is logged in and offers `signIn`, `signUp` and `signOut`.
3. **`AppContext.tsx` owns data.** It loads everything from Supabase, exposes simple actions, and every component reads and changes data through the `useApp()` hook instead of calling the database itself.

Because the `AppProvider` is created with `key={session.user.id}`, logging out (or switching accounts) throws away all of the previous user's data automatically.

---

## 6. How data flows (the single most important idea)

Every change follows the same loop. Here is a like, step by step:

```
  user taps ♥                           (PostCard.tsx)
        │  calls toggleLike(postId)
        ▼
  1. OPTIMISTIC UPDATE                  (AppContext.tsx)
     dispatch({ type: 'TOGGLE_LIKE' })  the reducer flips the heart and count immediately,
        │                               so the screen responds with no waiting
        ▼
  2. SAVE TO SUPABASE
     insert (or delete) a row in the `likes` table
        │
        ├── success → nothing more to do, the screen is already right
        └── failure → dispatch TOGGLE_LIKE again (roll back) + show a toast
```

Why this matters:

- **One source of truth on the client.** A post lives in exactly one place (`state.posts`). The feed, explore grid, profile grid and popup viewer all show the same post, so they can never disagree.
- **Predictable.** Every change to client data is one `case` in the `reducer`. To find out how likes work, read `case 'TOGGLE_LIKE'`.
- **Immutable updates.** The reducer never edits state in place; it returns copies (`{ ...p, likes: p.likes + 1 }`). React relies on this to know what changed.
- **Fast and safe.** The user sees instant feedback; the database stays the real source of truth; failures are undone.

**Loading.** When you log in, `AppContext` runs six queries in parallel (profiles, posts with their likes/saves/comments, who you follow, recent stories, notifications, messages), converts the rows with `src/lib/mappers.ts`, and puts them in the store with a single `LOAD` action. A spinner shows until that finishes.

**Live updates.** `AppContext` also subscribes to a Supabase Realtime channel. When someone sends you a message or triggers a notification, the database pushes it to the app, which dispatches `ADD_MESSAGE` or `ADD_NOTIFICATION`. The chat updates and the notification appears without a refresh.

The client state has this shape:

```ts
{
  users:         Record<string, User>,   // looked up by id, e.g. state.users[someId]
  posts:         Post[],
  notifications: AppNotification[],
  stories:       Story[],                // from the last 24 hours
  conversations: Conversation[],         // one per person you've messaged
  blocked:       string[],               // ids of people YOU have blocked
  seenStories:   string[],               // user ids whose story you've opened (this session)
}
```

Posts, comments and messages refer to people by `userId` only. To show a username and avatar, components call `getUser(id)`. This is how a relational database works too: store the id, look up the details.

---

## 7. The database

Everything is defined in **`supabase/schema.sql`**, which you ran in step 2.

### Tables

| Table | What a row is | Key columns |
|---|---|---|
| `profiles` | One per user (created automatically at sign-up) | `id` (= auth user id), `username` (unique), `name`, `bio`, `avatar_url` |
| `posts` | A photo post | `user_id`, `image_url`, `aspect_ratio`, `caption`, `created_at` |
| `comments` | A comment on a post | `post_id`, `user_id`, `text` |
| `likes` | One like | `post_id` + `user_id` (together the primary key, so you can't like twice) |
| `saves` | One bookmark (private) | `post_id` + `user_id` |
| `follows` | "A follows B" | `follower_id` + `following_id` |
| `blocks` | "A has blocked B" (visible only to A) | `blocker_id` + `blocked_id` |
| `stories` | A 24-hour story | `user_id`, `image_url`, `created_at` |
| `messages` | One direct message | `sender_id`, `receiver_id`, `text`, `read_at` (null = unread) |
| `notifications` | An alert for a user | `user_id` (receiver), `actor_id`, `type` (`like`/`comment`/`follow`), `post_id`, `text` |

There is also a **view**, `profiles_with_counts`, which adds follower and following counts to each profile so the app can fetch them in one query.

### Automation (triggers)

- **`handle_new_user`**: when someone signs up, automatically creates their `profiles` row using the username and name sent with the sign-up form.
- **`on_block_created`**: when someone blocks another account, automatically removes any follow between the two.
- **`notify_like`, `notify_comment`, `notify_follow`**: when a like, comment or follow row is inserted, automatically create a notification for the right person (never for your own actions on your own posts).

This is why the app code never writes notifications itself.

### Security (Row Level Security)

Because the anon key is inside the app (anyone can see it), **the database itself enforces the rules**. A few examples:

- Anyone logged in can read posts, but you can only **insert or delete posts where `user_id` is you**.
- You can only like, follow or save **as yourself**.
- `saves` and `notifications` are **private**: you only ever see your own.
- You can only read **messages you sent or received**; and the receiver may only change `read_at`, never the text.
- `profiles` can be read by anyone (the sign-up form needs this to check if a username is free) but only edited by their owner.
- **Blocking is enforced here, not in the app.** Two helper functions, `is_blocked_between(a, b)` and `can_interact_with_post(post)`, are used inside the policies for posts, comments, likes, stories, follows and messages. Once A blocks B (or B blocks A), each can no longer see the other's posts, stories, comments or likes, and cannot like, comment, follow or message the other. The `blocks` table itself is private, so **nobody can ever query "who blocked me"**; the other person just stops seeing your content, as on Instagram.

### Storage

One public bucket, **`media`**. Files are saved as `<your user id>/<avatars|posts|stories>/<timestamp>.<ext>`. Anyone can view images; you can only upload, replace or delete files inside **your own folder**.

### Realtime

`messages` and `notifications` are added to Supabase's realtime publication so inserts are pushed to subscribed clients (and only to people whose security policy allows them to see the row).

---

## 8. File-by-file guide

### Root files

| File | What it does |
|---|---|
| `package.json` | Lists dependencies and the `npm run ...` scripts. |
| `app.json` | Expo configuration: app name, web bundler (Metro, single-page output) and the `expo-image-picker` plugin with the permission messages shown on phones. |
| `tsconfig.json` | TypeScript settings; extends Expo's base config with `strict: true`. |
| `babel.config.js` | Uses `babel-preset-expo` so Expo can compile the code. |
| `index.ts` | Entry point. Calls `registerRootComponent(App)` so Expo knows what to render. |
| `.env.example` | Template for the two Supabase settings. Copy it to `.env` (which Git ignores). Variables starting with `EXPO_PUBLIC_` are built into the app. |
| `.gitignore` | Keeps `node_modules`, build output and your `.env` secrets out of Git. |
| `supabase/schema.sql` | The whole backend definition (see section 7). Run it once in the Supabase SQL Editor. |
| `App.tsx` | **The root.** Wraps everything in providers; the `Gate` picks setup / login / app; the `Shell` tracks the active tab and chooses the layout. |

### `App.tsx`: the gate and the shell

- `App` wraps everything in `SafeAreaProvider` and `AuthProvider`.
- `Gate` reads `useAuth()` and shows `SetupNotice` (no keys), `LoadingScreen` (checking session), `AuthScreen` (logged out) or the real app. The real app is wrapped in `AppProvider`, which receives the logged-in user's id.
- `Shell` keeps two pieces of local state: `tab` (`'home' | 'explore' | 'create' | 'activity' | 'profile' | 'messages'`) and `creating` (is the Create modal open?). It shows a spinner while `AppContext` is loading the first data.
- `handleSelect`: tapping **Create** opens the modal *without* changing the visible screen; any other tab switches `tab`.
- Uses `useBreakpoint()` to choose navigation: **phone** gets `MobileHeader` + `BottomTabs`; **tablet/desktop** gets the `Sidebar` (icon-only on tablet, full on desktop).
- The `screen` variable is a `switch` on `tab` that picks which screen component to show.

### `src/types.ts`: the shapes of the data

Defines the TypeScript interfaces everything else uses: `User`, `Post`, `Comment`, `Story`, `AppNotification`, `Message`, `Conversation` and the `TabKey` union. Read this file first; it is the vocabulary of the app. For example, a `Post` has `id`, `userId`, `image`, `aspectRatio`, `caption`, `likes`, `likedByMe`, `saved`, `comments[]` and `createdAt`.

### `src/theme.ts`: design tokens

One place for colors (`text`, `primary` blue, `like` red, borders), the story gradient colors, and layout numbers (feed max width **470**, profile max width **935**, sidebar widths, and the breakpoints **768 / 1024 / 1160**). Changing a value here restyles the whole app.

### `src/lib/`: the Supabase connection

| File | What it does |
|---|---|
| **`supabase.ts`** | Creates the one shared Supabase client from the `.env` keys; configures saved logins; exports `isSupabaseConfigured` (so the app can show setup help instead of crashing) and `errorMessage()` (turns any error into a readable message). |
| **`storage.ts`** | `uploadImage(userId, uri, folder)` reads a local photo, uploads it to the `media` bucket under the user's own folder, and returns its public URL. `isLocalUri()` tells apart a photo picked on this device from a link on the internet (links are used as they are, with no upload). |
| **`mappers.ts`** | The translation layer. The database uses `snake_case` rows (`image_url`, `user_id`); the UI uses the friendly types from `types.ts`. These functions convert one to the other (`mapPost`, `mapProfile`, `mapMessage`...). They also count likes, work out `likedByMe`, and generate a placeholder avatar for people with no photo. Components never see raw database rows. |

### `src/store/`: state

| File | What it does |
|---|---|
| **`AuthContext.tsx`** | `AuthProvider` + `useAuth()`. Restores a saved session on startup, listens for login/logout, and offers `signIn`, `signUp` and `signOut`. `signUp` first checks the username is free, then sends the username and name as sign-up metadata so the database trigger can create the profile. |
| **`AppContext.tsx`** | **The brain.** The `reducer` has one `case` per client-side change (`LOAD`, `TOGGLE_LIKE`, `TOGGLE_SAVE`, `ADD_COMMENT`, `ADD_POST`, `DELETE_POST`, `ADD_STORY`, `SEEN_STORY`, `UPSERT_USER`, `UPDATE_PROFILE`, `TOGGLE_FOLLOW`, `ADD_MESSAGE`, `MARK_READ`, `ADD_NOTIFICATION`, `BLOCK`, `UNBLOCK`). `AppProvider` loads the data, subscribes to realtime, and exposes friendly action functions (`toggleLike`, `addComment`, `addPost`, `sendMessage`...) that update the screen first and then save to Supabase. `useApp()` is the hook every component calls. |

### `src/hooks/useBreakpoint.ts`: responsive helper

Wraps React Native's `useWindowDimensions()` and returns `isMobile` (< 768px), `isTablet` (768-1023px) and `isDesktop` (>= 1024px). It re-runs whenever the window is resized, so the layout reflows live in the browser.

### `src/utils/time.ts`: time formatting

- `timeAgo(ts)` gives short forms: `5s`, `12m`, `3h`, `2d`, `4w` (used in notifications and message previews).
- `timeAgoLong(ts)` gives `just now`, `3 hours ago`, `2 days ago` (used under posts).

### `src/components/`: the UI

| File | Responsibility | Talks to |
|---|---|---|
| **`AuthScreen.tsx`** | Three small screens: `AuthScreen` (log in / sign up with validation and error messages), `SetupNotice` (shown when `.env` is missing) and `LoadingScreen` (spinner). | `useAuth()` |
| **`Avatar.tsx`** | Round profile picture. With `ring="unseen"` it draws the colourful gradient border; `"seen"` gives a grey border; `"none"` gives a plain image. | Used by almost every component |
| **`Navigation.tsx`** | `Logo`, `Sidebar` (full or icon-only), `MobileHeader` (logo + notifications + messages icons) and `BottomTabs` (five tabs; the Profile tab shows your avatar). | Receives `active` tab and `onSelect` from `App.tsx`; reads your avatar from the store |
| **`Stories.tsx`** | Horizontal scrolling row of story avatars. "Your story" opens the Create modal. Unseen stories sort first. Tapping a story opens a full-screen viewer showing that person's latest story image with a 5-second progress bar that closes itself when finished. | Reads `users`, `stories`, `seenStories`; calls `markStorySeen` |
| **`PostCard.tsx`** | One post: header, image, action bar, likes, caption, comments, comment box. The `...` menu has Copy link, Delete (your own posts) and **Block** (other people's, with a confirmation bar). The largest component. | Store: like, save, comment, delete, block, toast |
| **`Feed.tsx`** | The Home screen: a `FlatList` with `Stories` as the header and a `PostCard` per post, newest first. Pull down to refresh. On wide screens (>= 1160px) shows the `Suggestions` panel with Follow buttons. | `Stories`, `PostCard`; store for posts, follow, refresh |
| **`PhotoGrid.tsx`** | Two exports. `PhotoGrid` is the reusable 3-column square grid (it measures its own width and divides it by 3). Hovering a tile on desktop shows likes and comment counts. `PostViewer` is a popup that shows a full `PostCard`. | Used by `Explore` and `Profile`; renders `PostCard` |
| **`Explore.tsx`** | Search box plus a `PhotoGrid` of all posts sorted by likes. Searches captions, hashtags and usernames. | `PhotoGrid`, `PostViewer` |
| **`Profile.tsx`** | Your profile: avatar, username, post/follower/following counts, bio, **Edit profile**, **Blocked accounts** (with Unblock), **Log out**, Posts/Saved tabs, and a grid. Contains the `EditProfileModal`. | Store; `AuthContext` (log out); `PhotoGrid`; `expo-image-picker` |
| **`Activity.tsx`** | The notifications list: likes, comments and follows, with post thumbnails. New ones appear live. | Store |
| **`Messages.tsx`** | Direct messages. A conversation list (with unread dots and a "Start a new chat" list) and a `Chat` view with bubbles, an input and a **Block** button in the header. Desktop shows list and chat side by side; phone shows one at a time with a back button. | Store: conversations, `sendMessage`, `markConversationRead` |
| **`CreatePostModal.tsx`** | Popup for new content: choose **Post** or **Story**; pick from gallery, take a photo, or paste a URL; choose aspect ratio and caption (posts); preview; Share (with a spinner while uploading). | Store `addPost` / `addStory`; `expo-image-picker` |
| **`Toast.tsx`** | Small dark pop-up ("Post shared", "Profile updated", error messages...). | Reads `toast` from the store |

---

## 9. Feature walkthroughs (what happens when you tap X)

### Sign up and log in
1. `AuthScreen` validates the form (email format, password of 6+ characters, username pattern).
2. **Sign up**: `signUp` checks the username is not taken, then calls Supabase Auth with the username and name attached. A database trigger creates the matching `profiles` row. If your project requires email confirmation, the screen asks you to check your email; otherwise you are logged in straight away.
3. **Log in**: `signInWithPassword`. On success, the auth listener updates `session`, the `Gate` mounts the `AppProvider`, and data loads.
4. The session is saved (localStorage on the web), so refreshing the page keeps you logged in. **Log out** (on the Profile screen) clears it and wipes the in-memory data.

### Double-tap to like (`PostCard.tsx`)
1. Tapping the photo records `Date.now()` in a `useRef`.
2. If a second tap lands within **300 ms** of the first, it counts as a double-tap.
3. The post is liked (only if it wasn't already; double-tapping never *unlikes*) and a big white heart animates: it springs from 30% to full size, holds for 350 ms, then fades out over 250 ms (`Animated.sequence`).
4. A `pointerEvents="none"` overlay means the heart never blocks taps.

### Like, save, comment, share, follow
- **Like / Save / Follow**: optimistic update, then insert or delete a row in `likes` / `saves` / `follows`; rolled back with a toast on failure. Saved posts appear in **Profile > Saved**.
- **Comment**: type in the input and press Enter or **Post**; the row is inserted, then added to the post, which expands to show all comments.
- **View all comments**: only the last two show by default; the toggle reveals the rest.
- **Share**: on the web this copies a link to the clipboard (`navigator.clipboard`) and shows a toast.
- **Hashtags and @mentions** are detected with a regular expression (`/(#\w+|@[\w.]+)/g`) and coloured blue.
- **Menu (...)**: *Copy link* and *Cancel* for every post; *Delete* appears only on your own posts (and the database refuses deletes of anyone else's).

### Stories
Choose **Story** in the Create modal; the photo is uploaded and a `stories` row is inserted. Stories older than 24 hours are no longer returned by the database. Tapping an avatar opens the viewer; `markStorySeen` turns the ring grey (remembered for the current session only) and unseen stories sort first. The progress bar is an `Animated.Value` running from 0 to 1 over 5 seconds.

### Explore
Type in the search box; the post list is filtered live (case-insensitive, a leading `#` or `@` is ignored). Tap a tile to open the post in a popup where you can like and comment.

### Profile and Edit Profile
- The profile counts posts by filtering `state.posts` for your `userId`; follower and following counts come from the database view.
- **Edit profile** opens a form where you can change your **photo** (from gallery or camera, cropped square), **username**, **name** and **bio**.
- **Username validation** runs as you type: 3-30 characters of lowercase letters, numbers, `.` and `_`, and it must not match any other user's username. If invalid, an error shows and **Save** is disabled. The database also enforces uniqueness, so even a race between two people is caught ("That username is already taken").
- On Save, a new photo is uploaded to Storage, the `profiles` row is updated, and `UPDATE_PROFILE` merges the change into the store. Because every component reads your details from the store, the **new photo and username appear everywhere at once**.

### Create a post
1. Tap **Create** (or "Your story").
2. Choose **Gallery** or **Camera**, or paste an image URL (the **Sample** button inserts a random photo).
3. The preview appears immediately. If an image fails to load, the preview says so and **Share** stays disabled.
4. Pick an aspect ratio (picking a photo auto-selects the closest of 1:1, 4:5 and 16:9) and write a caption.
5. **Share** uploads the photo (if it came from your device), inserts the `posts` row, adds it to the top of your feed, takes you to Home and shows a toast. Pasted URLs are stored as they are.

### Direct messages (real time)
- Open **Messages** (paper-plane icon). Conversations are sorted by most recent message; a blue dot marks unread ones.
- Send a message: it is inserted into the `messages` table and appears as a blue bubble on the right.
- If the other person is online, **their** app receives it instantly through Realtime and shows it without a refresh. (To see this, log in as two different users in two browser windows.)
- Opening a chat (or receiving a message while it's open) clears the unread dot and sets `read_at` in the database.
- **Start a new chat** lists everyone you have not messaged yet.

### Blocking
- **Where:** the `...` menu on anyone else's post, the block icon in a chat header, or manage everyone you've blocked under **Profile > Blocked accounts** (where you can **Unblock**).
- **What happens:** a confirmation bar appears (a custom bar is used instead of `Alert`, which does not work on the web). On confirm, a row is inserted into `blocks`; the screen immediately hides that person's posts, stories, notifications and chat, and the app reloads quietly so counts match the database. A database trigger also removes any follow between you.
- **What the blocked person experiences:** their view of your posts and stories simply disappears, they can't like, comment on, follow or message you (a message attempt shows "You can't message this person"), and they are never told that you blocked them.
- **Unblocking** deletes the row and the other person's posts reappear after the reload. Follows that were removed are not restored.

### Notifications
Likes, comments and follows are turned into notifications by database triggers. They are loaded at start-up and new ones arrive live through Realtime.

### Camera and gallery
`expo-image-picker` provides `launchImageLibraryAsync` (gallery) and `launchCameraAsync` (camera). On phones the app first asks for permission and shows a friendly message if refused. In a desktop browser the gallery opens the system file dialog; the camera opens a webcam prompt or a file picker if no camera exists. All calls are wrapped in `try/catch`, so a failure becomes a toast instead of a crash.

---

## 10. Responsive design

| Window width | Navigation | Layout |
|---|---|---|
| **< 768px** (phone) | Top header + bottom tab bar | One column; profile shows a small avatar; messages show list *or* chat |
| **768-1023px** (tablet) | Icon-only sidebar | Feed centered |
| **>= 1024px** (desktop) | Full sidebar with labels | Feed centered at **470px** max width |
| **>= 1160px** (wide desktop) | Full sidebar | Feed plus a "Suggested for you" column |

How it is achieved:
- `useBreakpoint()` reads the window size and `App.tsx` swaps the navigation component.
- Feed, Explore, Profile and Activity use a `maxWidth` on their container so they stay centred and readable on huge monitors.
- `PhotoGrid` measures its own width with `onLayout` and makes each tile a third of it, so the grid is always three perfect squares across.
- Desktop-only touches: hover highlights on sidebar items and grid tiles (React Native Web's `hovered` state and `onHoverIn`).

---

## 11. Design decisions worth mentioning

- **Backend as a service.** Supabase gives auth, a real database, file storage and realtime with no server to build or host.
- **Security in the database, not the app.** Row Level Security means even a user who tampers with the front-end code cannot read private data or act as someone else.
- **Optimistic updates.** The UI responds instantly and corrects itself if the server says no.
- **Mappers isolate the database.** If a column name changes, only `mappers.ts` and the queries change; components are untouched.
- **Context + reducer instead of a state library.** Fewer dependencies, easy to explain, and the actions list doubles as the app's feature list.
- **Normalised data.** Posts store `userId`, not a copy of the user. Editing your username once changes it everywhere.
- **Triggers for side effects.** Profiles and notifications are created by the database, so they can never be forgotten or faked by a client.
- **Shared components.** `PhotoGrid` serves both Explore and Profile; `PostCard` serves the feed and the popup viewer.
- **`React.memo` on `PostCard`** so a like on one post doesn't re-render every other post card.
- **`FlatList` for the feed** renders only what is near the screen.
- **Platform-aware code.** `Platform.OS` checks decide when to ask for permissions, which animation driver to use (the native driver isn't supported on the web), and whether the clipboard is available.
- **Honest failure handling.** Bad image URLs, denied permissions, missing cameras, network errors and refused database writes all produce a clear message.
- **Accessibility basics.** Buttons have `accessibilityRole` and `accessibilityLabel` so screen readers can announce them.

---

## 12. Known limitations

- **Not run or tested yet.** This code was written without being able to install packages or connect to a Supabase project, so it has only been checked for syntax. Expect to fix small issues on the first run; start with `npm run typecheck` and `npx expo start -c`.
- **Small-scale data loading.** On login the app loads *all* profiles, the latest 100 posts (with every like row and comment), your messages and notifications. That is fine for a project and demo, but a large app would need pagination and server-side counts.
- **Realtime covers messages and notifications only.** New posts, likes and comments from other people appear after a refresh (pull down on the feed) or the next login.
- **Email + password only.** There is no password reset, email change, social login or account deletion screen yet.
- **Limited moderation tools.** Blocking exists, but there is no reporting, no admin dashboard, no bans, and no private accounts (see "Moderation and admin" below). Old messages with someone you blocked stay in the database; they are just hidden from you.
- **Block hides, it doesn't erase.** Blocked people's profiles can still be found by username, as the sign-up form needs to read profiles; only their content and interactions are cut off.
- **Deleting a post leaves its image file** in Storage (the database row is removed).
- **Stories** show only a person's latest story image, and "seen" status is not saved between sessions.
- **Share link is cosmetic.** The copied link points to `/p/<id>`, which doesn't exist as a route (the app has no URL routing).
- **Logo font.** The wordmark uses a cursive system-font stack, not Instagram's own typeface.

---

## 13. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Connect Supabase to continue" screen | `.env` is missing or misnamed. Copy `.env.example` to `.env`, fill it in, then restart with `npx expo start -c`. |
| Sign-up says "Database error saving new user" | `supabase/schema.sql` has not been run (the profile trigger is missing), or the username is invalid. |
| Sign-up works but you can't log in | Email confirmation is on. Click the link in the email, or turn "Confirm email" off while developing. |
| "new row violates row-level security policy" | The schema was not fully run, or you are not logged in. Re-run `schema.sql`. |
| Posting a photo fails with a storage error | The `media` bucket is missing. Re-run the storage section of `schema.sql`. |
| Messages don't arrive live | Check Database > Replication/Publications shows `messages` and `notifications` in `supabase_realtime`; re-run the last section of `schema.sql`. |
| Feed is empty | Expected on a new project. Create a post (or a second account and post from it). Pull down to refresh. |
| Images from other people don't load | Check the `media` bucket is **public** in Storage. |
| Blocking fails with an error or posts don't disappear after blocking | `schema.sql` was updated after you first ran it. Re-run the whole file (it is safe to run again) so the `blocks` table, helper functions and updated policies exist. |
| Changes to `.env` have no effect | Restart with a cleared cache: `npx expo start -c`. |
| Version mismatch warnings | `npx expo install --fix`. |
| Expo Go says the project is incompatible / "SDK version" error | The SDK in `package.json` doesn't match the Expo Go app on your phone. This project uses **SDK 58**; run `npx expo install expo@^58.0.0 --fix`. Expo Go only supports the single newest SDK. |
| TypeScript errors after upgrading (e.g. about ref types) | SDK 58 enables React Native's strict TypeScript API. Fix the type named in the error, or see Expo's SDK 58 upgrade guide. The app's code uses none of the APIs SDK 58 removed. |

---

## 14. How to extend it

| Goal | Where to start |
|---|---|
| Reporting + admin review | Add a `reports` table (reporter, reported user/post, reason, status), a Report button next to Block, and review the rows in the Supabase Table Editor. See "Moderation and admin" below. |
| Password reset | `supabase.auth.resetPasswordForEmail`, plus a screen that calls `supabase.auth.updateUser` after the link is opened. |
| Social login (Google, GitHub...) | Enable the provider in Supabase, then `supabase.auth.signInWithOAuth` from `AuthScreen.tsx`. |
| Pagination / infinite scroll | Change the `posts` query in `AppContext.load` to use `.range(from, to)` and load more from `Feed`'s `onEndReached`. |
| Realtime posts, likes, comments | Add those tables to the realtime publication in `schema.sql` and extra `.on('postgres_changes', ...)` listeners next to the existing ones in `AppContext.tsx`. |
| Viewing other people's profiles | Make `Profile` accept a `userId`, and open it when tapping a username or avatar. |
| URL routing (`/profile`, `/p/123`) | Swap the `tab` state in `App.tsx` for Expo Router. |
| Push notifications | Expo Notifications + a Supabase Edge Function triggered by new `notifications` rows. |
| Dark mode | Turn `colors` in `theme.ts` into two palettes and switch with `useColorScheme()`. |
| Video posts or carousels | Extend `posts` (e.g. a `post_media` table), the `Post` type in `types.ts`, and `PostCard.tsx`. |
| Zustand instead of Context | Recreate the same actions in a Zustand store and have `useApp()` return it. Components stay the same. |

---

## Moderation and admin (design note)

**Do real social apps have admins?** Yes, but not in the way a user sees. Large platforms have trust-and-safety teams with internal tools to review reports, remove content and ban accounts, and they also need a published Terms of Service and Privacy Policy. Mobile app stores require apps with user-generated content to offer at least **reporting, blocking and a way to remove abusive users**.

**What this project does:**

| Need | How it is handled |
|---|---|
| Users protecting themselves | **Blocking** (built in, enforced by the database) |
| Removing someone's content or account | You, as the project owner, in the **Supabase dashboard** (Table Editor to delete a post, Authentication > Users to delete or ban a user). No admin screen is built. |
| Reporting rule-breakers | Not built yet |
| Terms and Privacy Policy | Not included |

**Recommendation for a school project:** an in-app admin panel is *not* necessary, and building one would add roles, extra security rules and a whole new interface. Blocking plus "the owner can manage data in the Supabase dashboard" is already a complete and defensible answer. If you want one step more that is cheap and impressive, add a **Report** button (a small `reports` table, reviewed in the dashboard) and describe the admin as "the project owner using the database console". Only build a true admin interface (a `role` column on profiles, policies that let admins read reports and ban users, and a protected screen) if your project requirements ask for it.

---

## 15. Presentation cheat sheet

**One-sentence pitch:** "An Instagram-style social app built once with React Native and TypeScript that runs in any browser, adapts from phone to desktop, and is powered by a secure Supabase backend with live messaging."

**Suggested demo order (about 6 minutes):**
1. Sign up a new account; show you stay logged in after a refresh.
2. On desktop, point out the sidebar, centred feed and suggestions panel; shrink the window to show the phone layout with a bottom tab bar.
3. Create a post from the gallery or a URL and watch it appear at the top of the feed.
4. Double-tap a photo (heart animation), add a comment, save a post.
5. Add a story and open it (the ring turns grey).
6. **Explore**: search a hashtag, open a result.
7. With a second account in another window: follow the first account, then exchange **live messages** and show the notification arriving.
8. **Block** the second account from a post or chat and show their posts vanish and their message attempts fail; then **Unblock** under Profile > Blocked accounts.
9. **Profile > Edit profile**: change the photo and username and show it update across the app.
10. Open the Supabase dashboard and show the tables, the Storage bucket and a security policy.

**Questions you may be asked:**

- *Why React Native for a web app?* One codebase for web, iOS and Android; React Native Web renders it as normal HTML/CSS.
- *Why Supabase?* It provides auth, a Postgres database, storage and realtime without writing a server, and it uses standard SQL.
- *Is it safe to put the Supabase key in the app?* Yes, the **anon** key is meant to be public. Security comes from Row Level Security policies in the database, which decide what each logged-in user may read or change. The powerful `service_role` key is never used in the app.
- *How does state work?* One store (`AppContext`); components call actions; the reducer updates the screen immediately and the action saves to Supabase, rolling back if it fails.
- *Why not mutate state directly?* React detects changes by reference; copies keep updates predictable.
- *How do posts know who wrote them?* Each post stores `user_id`, and `getUser(id)` looks up the details.
- *How does blocking work?* A `blocks` table plus helper functions used inside the database's security policies, so the rules apply no matter how the data is requested. See section 7.
- *Do you have an admin?* No admin screen. Security is enforced by the database policies, and you can manage data as the project owner in the Supabase dashboard. See "Moderation and admin".
- *How do messages arrive instantly?* The app subscribes to a Supabase Realtime channel; the database pushes new rows to the recipient.
- *How are notifications created?* By database triggers when a like, comment or follow row is inserted, so the app never has to remember to create them.
- *How is it responsive?* `useBreakpoint()` reads the window width; `App.tsx` swaps navigation components; containers use `maxWidth`.
- *What would you do next?* Pagination, realtime for posts, password reset, profiles for other users (see section 14).
