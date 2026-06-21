# BigQuery Release Insights Hub 🚀

A premium, modern web dashboard for tracking and analyzing Google Cloud BigQuery release notes in real time. This application parses Google's release feed into single-subject updates and features an integrated sharing workflow that lets you tweet updates or custom text highlights with a single click.

> [!NOTE]
> **AI-Generated Code Disclaimer**  
> This entire codebase was fully generated using **`antigravity-cli`**, Google DeepMind's Advanced Agentic Coding assistant.

---

## ✨ Features

* **Atomic Parsing**: Parses the consolidated Google Cloud XML feed, separating daily aggregations into individual, categorized cards (`Feature`, `Changed`, `Deprecated`, `Issue/Fixed`, `Announcement`).
* **Sleek Glassmorphic Interface**: Built with raw vanilla HTML, CSS, and JS. Features a responsive dashboard, dark console theme, neon glow highlights, and skeleton loading screens.
* **Double Tweet Sharing Workflows**:
  * **Card Action**: Quick-share any update card in a pre-formatted tweet.
  * **Highlight-to-Tweet**: Drag your cursor to select any snippet of text in a card. A floating tooltip will instantly appear to draft a tweet containing that specific quote.
* **X/Twitter Character Progress Ring**: Displays character constraints in real time with a glowing circular SVG loader that changes colors as you approach the 280-character limit.
* **Smart Server Caching**: Saves feed results to a local cache (`cache.json`) for 5 minutes to avoid rate-limiting, with a force-refresh option in the UI.
* **Light / Dark Theme Switcher**: Toggle between light and dark modes via a header button. It instantly overrides CSS root variables and persists your choice using browser `localStorage`.
* **Copy to Clipboard Utility**: A card-level copy button that formats release information (Type, Date, description, and source link) cleanly for messaging or team channels.
* **Export to CSV Utility**: Generates a downloadable, RFC-compliant CSV of your **currently active filtered and searched** release notes list.

---

## 🛠️ Technology Stack

* **Backend**: Python, Flask, requests, BeautifulSoup4
* **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Flexbox, Grid), Vanilla ES6 JavaScript (Selection API, DOM Manipulation)

---

## 💻 How to Get Started

### Prerequisites
Make sure you have Python 3.10+ installed.

### Setup & Run
1. **Activate the Virtual Environment**:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

2. **Start the Flask Server**:
   ```powershell
   python app.py
   ```

3. **Open the Application**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.

---

## 📂 Project Structure

```
├── app.py              # Flask server, Atom XML parser, and caching logic
├── templates/
│   └── index.html      # Glassmorphic layout, inline SVGs, and sharing modal
├── static/
│   ├── css/
│   │   └── style.css   # Modern CSS tokens, radial glows, and typography
│   └── js/
│       └── main.js     # Live search/filters, selection handlers, and composer
├── .gitignore          # Configured to exclude virtualenv, pycache, and cache files
└── README.md           # Project documentation
```
