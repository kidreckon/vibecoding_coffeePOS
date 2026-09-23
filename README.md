# Seceda Homebrew POS

A simple, offline-first point-of-sale web app for a coffee shop:

- **Big buttons.** Tap drink → tap add-ons → **CHARGE** → tap **Cash / QRIS / Card**. That's the whole flow.
- **Bluetooth receipts.** Prints straight to a 58mm ESC/POS thermal printer (EPPOS and similar) from Android Chrome.
- **Running order numbers.** Orders are numbered `#001`, `#002`, … and the count resets every day (you can change that in Settings).
- **Works offline.** Orders are stored on the phone and the app loads without internet.
- **Sales export.** Download a **CSV** for Google Sheets, or connect a Google Sheet so orders sync automatically.

No accounts, no server and no build step. It's plain HTML, CSS and JS hosted free on GitHub Pages.

---

## 1. Publish it (one time, about 2 minutes)

Web Bluetooth and "install to home screen" only work over **HTTPS**, and GitHub Pages provides that for free.

1. On GitHub, open this repo and go to **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**, pick your branch (e.g. `main`) and the `/ (root)` folder, then click **Save**.
3. After about a minute your app is live at `https://<your-username>.github.io/vibecoding_coffeePOS/`.

## 2. Install on your Android phone

1. Open the link above in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. Open **Seceda POS** from your home screen. It runs full-screen, like a normal app.

> **iPhone:** Safari can't use Bluetooth. To take orders and export CSV, add the app to the home screen from Safari (Share → Add to Home Screen). If you also need printing, open the same link in the free **Bluefy** browser instead. Bluefy supports Web Bluetooth.

## 3. Connect the printer

1. Turn the EPPOS printer on. You **don't** need to pair it in Android's Bluetooth settings first.
2. In the app, tap **🖨 Connect** (top right), then pick the printer from the list.
3. Go to **Settings → Test print**.

The app remembers the printer for as long as it stays open. If the printer switches off, the next CHARGE reconnects automatically or shows the picker again.

**If printing fails**, the order is still saved. The error message offers **Reprint** and **Phone print** (which uses the system print dialog). You can also reprint any order from the **Sales** tab.

**Paper:** the receipt is laid out for 58mm width (32 characters per line). With 58×30mm *label* paper (paper with gaps between labels), a big order runs across 2–3 labels. For receipts, **58mm continuous roll paper** works best.

### Receipt sample

```
      SECEDA HOMEBREW
        Order #007
--------------------------------
1x Iced Latte          Rp28.000
   + Oat milk           Rp5.000
   + Extra shot         Rp6.000
2x Americano           Rp44.000
--------------------------------
TOTAL                  Rp83.000
--------------------------------
       23 Sep 2026  14:32
```

## 4. Set up your menu

Go to **Settings → Menu items / Add-ons** to edit names, prices (Rp), categories, and which add-ons each item offers. Then tap **Save settings & menu**.

- Items with no add-ons go straight into the cart in one tap.
- **Hot** and **Iced** can't both be selected on the same drink.

## 5. Getting sales into Google Sheets

### Option A: CSV (always works)

1. Open the **Sales** tab, choose a date range, and tap **Export CSV**.
2. In Google Sheets, go to **File → Import → Upload**, choose the CSV, and pick **Append to current sheet**.

The CSV has one row per line item:

| order_no | date | time | item | qty | unit_price | addons | addons_price | line_total | order_total | payment | status | order_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

- Prices are plain numbers, so Sheets can sum them and use them in pivot tables.
- Voided orders stay in the file with `status = void`. Filter them out when you total.

### Option B: automatic sync (optional, about 5 minutes to set up)

Each order is pushed to your sheet as soon as it's charged. When you're offline, orders wait on the phone and upload when you're back online.

1. Open your Google Sheet and go to **Extensions → Apps Script**.
2. Delete what's there and paste in the contents of [`apps-script/Code.gs`](apps-script/Code.gs). Click **Save**.
3. Click **Deploy → New deployment** and choose the type **Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
4. Click **Deploy** and approve the permission prompts. Copy the **Web app URL** (it ends in `/exec`).
5. In the POS, go to **Settings → Google Sheets**, paste the URL, then tap **Test** and **Save**.

Orders go to a `Sales` tab, which the script creates if it doesn't exist.

- **No duplicates.** Rows are matched by `order_id`, so a retry replaces the existing rows instead of adding new ones.
- **Voids sync too.** Voiding an order later updates its rows in the sheet.
- **Security trade-off:** anyone who has the URL could add rows to that tab. Keep the URL private. If it ever leaks, create a new deployment and paste the new URL into Settings.

## 6. Daily use tips

- The screen stays awake while the app is open.
- **Sales** shows today's order count, revenue and a breakdown by payment method.
- **Void** keeps a record of the cancelled order instead of deleting it.
- Data lives on the phone only. Export CSV regularly (or use sync) as your backup. Clearing Chrome's site data for the app erases the orders.

## 7. Updating the app

After changing any file, bump `VERSION` in `sw.js` (for example `seceda-pos-v2`) and push. Phones pick up the update the second time the app is opened.

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | App shell and big-button UI |
| `app.js` | Screens, cart, checkout, sales, settings |
| `db.js` | IndexedDB storage (orders, menu, settings, order counter) |
| `receipt.js` | 58mm receipt layout and ESC/POS commands |
| `printer.js` | Web Bluetooth printer connection |
| `export.js` | CSV export |
| `sheets.js` | Optional Google Sheets sync |
| `menu.js` | Sample menu |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen install |
| `apps-script/Code.gs` | Script you paste into your Google Sheet |

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
