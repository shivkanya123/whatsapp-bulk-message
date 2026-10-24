
import { useState, useEffect, useCallback } from "react";
import Register from "./components/Register";
import "./App.css";

const API = "http://127.0.0.1:5000/api";

const chartData = [
  { day: "Apr 20", recipients: 800, sent: 700 },
  { day: "Apr 21", recipients: 830, sent: 720 },
  { day: "Apr 22", recipients: 950, sent: 810 },
  { day: "Apr 23", recipients: 1300, sent: 1100 },
  { day: "Apr 24", recipients: 1150, sent: 920 },
  { day: "Apr 25", recipients: 1700, sent: 1550 },
  { day: "Apr 26", recipients: 1200, sent: 1050 },
];

function App() {
  const [showRegister, setShowRegister] = useState(() => {
    return localStorage.getItem("isRegistered") !== "true";
  });

  const [numbers, setNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [campaigns, setCampaigns] = useState([]);

  const [stats, setStats] = useState({
    total_campaigns: 0,
    total_recipients: 0,
    messages_sent: 0,
  });

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);

  // Profile data is loaded from browser storage
  const [profileName, setProfileName] = useState(
    () => localStorage.getItem("profileName") || "Rahul Sharma"
  );

  const [profilePhoto, setProfilePhoto] = useState(
    () => localStorage.getItem("profilePhoto") || ""
  );

  const [photoInputKey, setPhotoInputKey] = useState(0);

  const recipients = numbers
    .split(/[\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const normalizeNumber = (number) => {
    let cleaned = number.replace(/[\s()-]/g, "");

    if (cleaned.startsWith("+91")) {
      cleaned = cleaned.slice(3);
    } else if (/^91\d{10}$/.test(cleaned)) {
      cleaned = cleaned.slice(2);
    }

    return cleaned;
  };

  const validNumbers = recipients.filter((n) =>
    /^[6-9]\d{9}$/.test(normalizeNumber(n))
  );

  const invalidNumbers = recipients.filter(
    (n) => !/^[6-9]\d{9}$/.test(normalizeNumber(n))
  );

  const normalized = recipients.map(normalizeNumber);

  const duplicateNumbers = [
    ...new Set(
      normalized.filter((n, i) => normalized.indexOf(n) !== i)
    ),
  ];

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch(`${API}/campaigns`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load campaigns");
      }

      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Campaign history error:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API}/stats`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load statistics");
      }

      setStats({
        total_campaigns: Number(data.total_campaigns) || 0,
        total_recipients: Number(data.total_recipients) || 0,
        messages_sent: Number(data.messages_sent) || 0,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
    }
  }, []);

  useEffect(() => {
    if (!showRegister) {
      fetchCampaigns();
      fetchStats();
    }
  }, [showRegister, fetchCampaigns, fetchStats]);

  const handleRegisterSuccess = () => {
    localStorage.setItem("isRegistered", "true");
    setShowRegister(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("isRegistered");
    setShowRegister(true);
    setProfileOpen(false);
  };

  const goTo = (id) => {
    setActiveNav(id);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Save profile name and photo in localStorage
  const handleSaveProfile = () => {
    const name = profileName.trim();

    if (!name) {
      alert("Please enter your name.");
      return;
    }

    try {
      localStorage.setItem("profileName", name);
      localStorage.setItem("profilePhoto", profilePhoto);

      setProfileName(name);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Profile save error:", error);
      alert(
        "Could not save profile. Please choose a smaller photo."
      );
    }
  };

  // Read and preview the selected profile photo
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      setPhotoInputKey((key) => key + 1);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Please select an image smaller than 2 MB.");
      setPhotoInputKey((key) => key + 1);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfilePhoto(reader.result);
      }
    };

    reader.onerror = () => {
      alert("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recipients.length || !message.trim()) {
      alert("Please enter mobile numbers and a message.");
      return;
    }

    if (invalidNumbers.length) {
      alert("Please correct all invalid mobile numbers.");
      return;
    }

    if (duplicateNumbers.length) {
      alert("Please remove duplicate mobile numbers.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numbers: recipients,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Campaign creation failed"
        );
      }

      setNumbers("");
      setMessage("");

      await Promise.all([fetchCampaigns(), fetchStats()]);

      alert(data.message || "Campaign prepared successfully!");
    } catch (error) {
      alert("Backend error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showRegister) {
    return (
      <div className="register-page">
        <Register onRegisterSuccess={handleRegisterSuccess} />
      </div>
    );
  }

  const successRate =
    stats.total_recipients > 0
      ? (
          (stats.messages_sent / stats.total_recipients) *
          100
        ).toFixed(1)
      : "0.0";

  // Display initials when no profile photo is selected
  const profileInitials =
    profileName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 4a19 19 0 0 0-16.3 28.8L5 43l10.7-2.8A19 19 0 1 0 24 4Z" />
              <path d="M18 14c-1.3 0-3.2 1.7-3.2 4.2 0 4.3 5.4 11.4 11.9 13.8 3.5 1.3 6.1-.9 6.8-3 .3-.9-.2-1.4-1-1.8l-4.2-2c-.7-.3-1.1-.2-1.6.5l-1.6 2c-2.7-1.1-4.8-3.1-6.1-5.7l1.7-1.7c.4-.5.5-1 .2-1.6l-1.8-4c-.3-.6-.6-.7-1.1-.7Z" />
            </svg>
          </div>

          <div>
            <h2>WhatsApp</h2>
            <p>Bulk Messaging</p>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={
              activeNav === "dashboard"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => goTo("dashboard")}
          >
            <span className="nav-icon">⌂</span> Dashboard
          </button>

          <button
            type="button"
            className={
              activeNav === "compose"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => goTo("compose")}
          >
            <span className="nav-icon">➤</span> Compose Message
          </button>

          <button
            type="button"
            className={
              activeNav === "history"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => goTo("history")}
          >
            <span className="nav-icon">◷</span> Campaign History
          </button>

          <button
            type="button"
            className="nav-link"
            onClick={() => goTo("contacts")}
          >
            <span className="nav-icon">♧</span> Contacts
          </button>

          <button
            type="button"
            className="nav-link"
            onClick={() => setProfileOpen((prev) => !prev)}
          >
            <span className="nav-icon">♙</span> Profile
          </button>

          <button
            type="button"
            className="nav-link"
            onClick={() => goTo("settings")}
          >
            <span className="nav-icon">⚙</span> Settings
          </button>

          <button
            type="button"
            className="nav-link"
            onClick={handleLogout}
          >
            <span className="nav-icon">⇥</span> Logout
          </button>
        </nav>

        {profileOpen && (
          <div className="sidebar-profile">
            <h3>Account Profile</h3>

            <div className="profile-avatar">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                />
              ) : (
                profileInitials
              )}
            </div>

            <label htmlFor="profileName">Full Name</label>

            <input
              type="text"
              id="profileName"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Enter your name"
            />

            <label htmlFor="profilePhoto">Profile Photo</label>

            <input
              key={photoInputKey}
              type="file"
              id="profilePhoto"
              accept="image/*"
              onChange={handlePhotoChange}
            />

            <button
              type="button"
              onClick={handleSaveProfile}
            >
              Save Changes
            </button>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="online-dot" />

            <div>
              <strong>System Online</strong>
              <small>Backend connection available</small>
            </div>
          </div>

          <div className="sidebar-promo">
            <div className="promo-whatsapp">◉</div>
            <p>Send messages.</p>
            <p>Grow your business.</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>
              Welcome back! <span className="wave">👋</span>
            </h1>

            <p>Here's what's happening with your campaigns.</p>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="notification-button"
              aria-label="Notifications"
            >
              ♧<span className="notification-dot" />
            </button>

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                setProfileOpen((prev) => !prev)
              }
            >
              <span className="profile-avatar">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  profileInitials
                )}
              </span>

              <span className="profile-text">
                <strong>{profileName}</strong>
                <small>Premium User</small>
              </span>

              <span className="profile-chevron">⌄</span>
            </button>
          </div>
        </header>

        <section className="stats" id="dashboard">
          <article className="stat-card">
            <div className="stat-icon recipients-icon">♟</div>

            <div className="stat-content">
              <span>Total Recipients</span>
              <h2>{stats.total_recipients.toLocaleString()}</h2>
              <p><b>↗</b> All campaigns</p>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon messages-icon">➤</div>

            <div className="stat-content">
              <span>Messages Sent</span>
              <h2>{stats.messages_sent.toLocaleString()}</h2>
              <p><b>↗</b> Reported by backend</p>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon campaigns-icon">▣</div>

            <div className="stat-content">
              <span>Campaigns Prepared</span>
              <h2>{stats.total_campaigns.toLocaleString()}</h2>
              <p><b>↗</b> Saved campaigns</p>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon rate-icon">◷</div>

            <div className="stat-content">
              <span>Success Rate</span>
              <h2>{successRate}%</h2>
              <p><b>↗</b> Based on reported totals</p>
            </div>
          </article>
        </section>

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="panel compose-card" id="compose">
              <div className="section-heading">
                <div className="heading-icon">➤</div>

                <div className="heading-copy">
                  <h2>Create a New Campaign</h2>
                  <p>
                    Send your message to multiple WhatsApp recipients
                  </p>
                </div>

                <span className="ready-badge">Ready to Send</span>
              </div>

              <form onSubmit={handleSubmit}>
                <label htmlFor="numbers">
                  Recipient Mobile Numbers
                </label>

                <textarea
                  id="numbers"
                  rows={4}
                  placeholder={"+919876543210\n+919876543211\n+919876543212"}
                  value={numbers}
                  onChange={(e) => setNumbers(e.target.value)}
                  required
                />

                <small className="field-help">
                  Enter one number per line or separate with commas.
                  Indian mobile numbers only.
                </small>

                <div className="validation-summary">
                  <div className="validation-stat valid-stat">
                    <span>✓</span>
                    <div>
                      <strong>{validNumbers.length}</strong>
                      <small>Valid</small>
                    </div>
                  </div>

                  <div className="validation-stat invalid-stat">
                    <span>!</span>
                    <div>
                      <strong>{invalidNumbers.length}</strong>
                      <small>Invalid</small>
                    </div>
                  </div>

                  <div className="validation-stat duplicate-stat">
                    <span>⟳</span>
                    <div>
                      <strong>{duplicateNumbers.length}</strong>
                      <small>Duplicates</small>
                    </div>
                  </div>
                </div>

                {invalidNumbers.length > 0 && (
                  <div className="validation-detail error-detail">
                    <strong>Invalid numbers</strong>

                    {invalidNumbers.map((n, i) => (
                      <p key={`${n}-${i}`}>{n}</p>
                    ))}
                  </div>
                )}

                {duplicateNumbers.length > 0 && (
                  <div className="validation-detail warning-detail">
                    <strong>Duplicate numbers</strong>

                    {duplicateNumbers.map((n) => (
                      <p key={n}>{n}</p>
                    ))}
                  </div>
                )}

                <label htmlFor="message">Your Message</label>

                <textarea
                  id="message"
                  rows={4}
                  maxLength={4096}
                  placeholder="Type your WhatsApp message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />

                <div className="message-meta">
                  <span>Message content</span>
                  <span>{message.length}/4096</span>
                </div>

                <div className="form-footer">
                  <span className="demo-note">
                    ⓘ Campaign will be saved in demo mode.
                  </span>

                  <button type="submit" disabled={loading}>
                    <span>➤</span>{" "}
                    {loading ? "Preparing..." : "Prepare Campaign"}
                  </button>
                </div>
              </form>
            </section>

            <section className="integration-card" id="settings">
              <div className="integration-icon">
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M24 4a19 19 0 0 0-16.3 28.8L5 43l10.7-2.8A19 19 0 1 0 24 4Z" />
                  <path d="M18 14c-1.3 0-3.2 1.7-3.2 4.2 0 4.3 5.4 11.4 11.9 13.8 3.5 1.3 6.1-.9 6.8-3 .3-.9-.2-1.4-1-1.8l-4.2-2c-.7-.3-1.1-.2-1.6.5l-1.6 2c-2.7-1.1-4.8-3.1-6.1-5.7l1.7-1.7c.4-.5.5-1 .2-1.6l-1.8-4c-.3-.6-.6-.7-1.1-.7Z" />
                </svg>
              </div>

              <div className="integration-copy">
                <h3>WhatsApp Business API Integration</h3>
                <p>Send real WhatsApp messages with Meta's official API.</p>
                <small>Secure, reliable and scalable messaging.</small>
              </div>

              <button
                type="button"
                onClick={() =>
                  alert(
                    "Connect your Meta WhatsApp Business API credentials in the backend to enable sending."
                  )
                }
              >
                ♧ Connect Now
              </button>
            </section>
          </div>

          <div className="right-column">
            <section className="panel chart-card">
              <div className="section-heading chart-heading">
                <div className="chart-heading-icon">▥</div>
                <h2>Campaign Overview</h2>

                <div className="chart-legend">
                  <span>
                    <i className="legend-green" /> Recipients
                  </span>
                  <span>
                    <i className="legend-blue" /> Messages Sent
                  </span>
                </div>
              </div>

              <div className="chart">
                <div className="chart-y-labels">
                  <span>2,000</span>
                  <span>1,500</span>
                  <span>1,000</span>
                  <span>500</span>
                  <span>0</span>
                </div>

                <div className="chart-main">
                  <div className="chart-grid-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="chart-bars">
                    {chartData.map((item) => (
                      <div className="chart-group" key={item.day}>
                        <div className="bar-pair">
                          <div
                            className="bar bar-green"
                            style={{
                              height: `${(item.recipients / 2000) * 100}%`,
                            }}
                            title={`Recipients: ${item.recipients}`}
                          />

                          <div
                            className="bar bar-blue"
                            style={{
                              height: `${(item.sent / 2000) * 100}%`,
                            }}
                            title={`Messages sent: ${item.sent}`}
                          />
                        </div>

                        <small>{item.day}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="chart-note">
                Illustrative sample chart — replace with daily backend
                statistics for live reporting.
              </p>
            </section>

            <section className="panel history-card" id="history">
              <div className="section-heading history-heading">
                <div className="history-heading-icon">◷</div>
                <h2>Recent Campaigns</h2>

                <button
                  type="button"
                  className="view-all"
                  onClick={() => {
                    setHistoryLoading(true);
                    fetchCampaigns();
                    fetchStats();
                  }}
                >
                  Refresh <span>↻</span>
                </button>
              </div>

              {historyLoading ? (
                <div className="empty-state">
                  <span className="loading-spinner" />
                  Loading campaigns...
                </div>
              ) : campaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✉</div>
                  <strong>No campaigns yet</strong>
                  <p>Your prepared campaigns will appear here.</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="campaign-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date &amp; Time</th>
                        <th>Recipients</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id}>
                          <td>#{campaign.id}</td>
                          <td>{campaign.created_at || "—"}</td>
                          <td>{campaign.total_recipients ?? 0}</td>
                          <td>
                            <span
                              className={`table-status ${String(
                                campaign.status || "Prepared"
                              ).toLowerCase()}`}
                            >
                              {campaign.status || "Prepared"}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="row-action"
                              title={campaign.message || "Campaign details"}
                              onClick={() =>
                                alert(
                                  campaign.message ||
                                    "No message details available."
                                )
                              }
                            >
                              •••
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel contacts-card" id="contacts">
              <div className="section-heading">
                <div className="heading-icon">♧</div>

                <div className="heading-copy">
                  <h2>Contacts</h2>
                  <p>Recipients from your saved campaigns</p>
                </div>
              </div>

              <div className="contacts-summary">
                <strong>{stats.total_recipients.toLocaleString()}</strong>
                <span>Total recipients saved across campaigns</span>
              </div>
            </section>
          </div>
        </div>

        <footer className="app-footer">
          <span>© 2025 WhatsApp Bulk Messaging System</span>
          <span>
            React <b>•</b> Flask <b>•</b> MySQL <b>•</b> Meta WhatsApp API
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
