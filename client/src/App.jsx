import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import { api, setAuthToken } from "./api.js";
import airportData from "./airportData.js";
import countryCodes from "./countryCodes.js";
import TicketDetails from "./TicketDetails.jsx";

const createEmptyLoad = () => ({
  unitCount: "",
  weightPerUnit: "",
  totalWeight: "",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "CM",
  stackable: false,
  turnable: false,
});

const emptyTender = {
  origin: "",
  destination: "",
  cargoType: "",
  shipperIdStatus: "",
  loads: [createEmptyLoad()],
  notes: "",
};

const emptyQuote = {
  carrier: "",
  serviceType: "",
  rate: "",
  currency: "USD",
  transitTime: "",
  validity: "",
  remarks: "",
  chargeableWeight: "",
  totalAmount: "",
  quoteDate: "",
};

const emptyBooking = {
  reference: "",
  notes: "",
};

const statusLabel = (status) => {
  if (!status) return "";
  if (status === "open") return "PENDING";
  return status.replace(/_/g, " ").toUpperCase();
};
const MAX_WEIGHT_DECIMALS = 2;
const departments = ["Sales", "Pricing", "Operations", "Customer Support", "Management"];
const roleLevels = ["Employee", "Senior Employee", "Team Lead", "Manager"];
const emptyEmployeeForm = {
  name: "",
  email: "",
  password: "",
  phoneCountryCode: "+91",
  phoneNumber: "",
  department: "Sales",
  roleLevel: "Employee",
  branch: "",
  status: "active",
};

const nameRegex = /^[A-Za-z ]+$/;
const nameMinLength = 2;
const nameMaxLength = 50;
const nameErrorMessage = "Name can contain only letters and spaces";
const phoneErrorMessage = "Enter a valid 10-digit phone number";
const consecutiveSpaceRegex = /\s{2,}/;

const normalizeNameInput = (value) => {
  if (!value) return "";
  const cleaned = value.replace(/[^A-Za-z ]/g, "");
  const collapsed = cleaned.replace(/\s{2,}/g, " ");
  return collapsed.slice(0, nameMaxLength);
};

const trimName = (value) => normalizeNameInput(value).trim();

const isValidName = (value) => {
  const rawTrimmed = value.trim();
  const trimmed = trimName(value);
  if (!trimmed || trimmed.length < nameMinLength || trimmed.length > nameMaxLength) {
    return false;
  }
  if (consecutiveSpaceRegex.test(rawTrimmed)) {
    return false;
  }
  return nameRegex.test(trimmed);
};

const normalizePhoneInput = (value) => {
  if (!value) return "";
  return value.replace(/[^0-9]/g, "").slice(0, 10);
};

const isValidPhone = (value) => {
  if (!value) return false;
  return /^[0-9]{10}$/.test(value);
};

const airportOptions = airportData.map((airport) => ({
  value: airport.code,
  label: `${airport.code} - ${airport.name}, ${airport.city}, ${airport.country}`,
  code: airport.code,
  city: airport.city,
  country: airport.country,
  name: airport.name,
}));

const selectStyles = {
  control: (base) => ({
    ...base,
    borderRadius: 10,
    borderColor: "rgba(15, 20, 27, 0.2)",
    minHeight: 40,
    boxShadow: "none",
    fontFamily: "Space Grotesk, sans-serif",
    fontSize: 14,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 5,
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    backgroundColor: state.isFocused ? "#f4f1e9" : "white",
    color: "#0f141b",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f141b",
  }),
};

const airportFilter = (option, inputValue) => {
  const search = inputValue.toLowerCase();
  const { code, city, country, name } = option.data;
  return (
    code.toLowerCase().includes(search) ||
    city.toLowerCase().includes(search) ||
    country.toLowerCase().includes(search) ||
    name.toLowerCase().includes(search)
  );
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState("login");
  const [role, setRole] = useState("customer");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [token, setToken] = useState("");
  const [tickets, setTickets] = useState([]);
  const [ticketFilters, setTicketFilters] = useState({
    status: "",
    origin: "",
    destination: "",
    dateFrom: "",
    dateTo: "",
  });
  const [dashboardStats, setDashboardStats] = useState({
    totalTickets: 0,
    pendingTickets: 0,
    quotedTickets: 0,
    closedTickets: 0,
    todayTickets: 0,
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [tender, setTender] = useState(emptyTender);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [quote, setQuote] = useState(emptyQuote);
  const [booking, setBooking] = useState(emptyBooking);
  const [adminView, setAdminView] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [employeeEditId, setEmployeeEditId] = useState(null);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [closeModalTicket, setCloseModalTicket] = useState(null);
  const [closeForm, setCloseForm] = useState({
    bookedOn: "",
    finalRate: "",
    awbNumber: "",
    screenshotUrl: "",
    closingNotes: "",
  });
  const [closeError, setCloseError] = useState("");
  const [employeeFilters, setEmployeeFilters] = useState({
    search: "",
    department: "",
    roleLevel: "",
    status: "",
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const settingsRef = useRef(null);
  const lastFocusRef = useRef(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: "", email: "", message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [settingsData, setSettingsData] = useState({
    name: "",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
    company: "",
    avatarUrl: "",
    preferences: {
      theme: "light",
      language: "en",
      notifications: {
        tenderAssigned: true,
        quoteSubmitted: true,
        ticketClosed: true,
        systemAlerts: true,
      },
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("freight_auth");
    if (saved) {
      const parsed = JSON.parse(saved);
      setToken(parsed.token);
      setRole(parsed.role);
      setUserName(parsed.name);
      setUserEmail(parsed.email || "");
      setAuthToken(parsed.token);
    }
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    lastFocusRef.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = settingsRef.current?.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      if (lastFocusRef.current && lastFocusRef.current.focus) {
        lastFocusRef.current.focus();
      }
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (token) {
      fetchTickets();
      fetchProfile();
      fetchNotifications();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [ticketFilters, token]);

  useEffect(() => {
    if (token && (role === "admin" || role === "employee")) {
      fetchDashboardStats();
    }
  }, [token, role]);

  useEffect(() => {
    if (token && role === "admin") {
      fetchEmployees();
      fetchFeedback();
    }
  }, [token, role]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = setTimeout(() => setToastMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const fetchTickets = async (filters = ticketFilters) => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.origin) params.origin = filters.origin;
      if (filters.destination) params.destination = filters.destination;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const { data } = await api.get("/tickets", { params });
      setTickets(data);
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to load tickets");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setDashboardLoading(true);
      const { data } = await api.get("/dashboard/stats");
      setDashboardStats(data);
      setDashboardReady(true);
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to load dashboard stats");
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const { data } = await api.get("/users/me");
      setProfileData(data);
      setSettingsData((prev) => ({
        ...prev,
        name: data.name || "",
        email: data.email || "",
        phoneCountryCode: data.phoneCountryCode || "+91",
        phoneNumber: data.phoneNumber || "",
        company: data.company || "",
        avatarUrl: data.avatarUrl || "",
        preferences: data.preferences || prev.preferences,
      }));
      setUserName(data.name || "");
      setUserEmail(data.email || "");
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications || []);
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchFeedback = async () => {
    try {
      setFeedbackLoading(true);
      const { data } = await api.get("/feedback");
      setFeedbackList(data.feedback || []);
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to load feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await api.get("/employees");
    setEmployees(data);
  };

  const onAuthChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    try {
      const normalizedName = trimName(authForm.name);
      if (!isValidName(normalizedName)) {
        setMessage(`${nameErrorMessage}.`);
        return;
      }
      const { data } = await api.post("/auth/signup", {
        name: normalizedName,
        email: authForm.email,
        password: authForm.password,
      });
      setMessage("Account created. Please login.");
      setAuthMode("login");
    } catch (error) {
      setMessage(error.response?.data?.message || "Signup failed");
    }
  };

  const handleLogin = async () => {
    try {
      const { data } = await api.post("/auth/login", {
        email: authForm.email,
        password: authForm.password,
      });
      setToken(data.token);
      setAuthToken(data.token);
      setUserName(data.name);
      setRole(data.role);
      setUserEmail(data.email || authForm.email);
      localStorage.setItem("freight_auth", JSON.stringify(data));
      setMessage("");
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  };

  const handleLogout = () => {
    setToken("");
    setUserName("");
    setUserEmail("");
    setTickets([]);
    setTicketFilters({ status: "", origin: "", destination: "", dateFrom: "", dateTo: "" });
    setDashboardStats({
      totalTickets: 0,
      pendingTickets: 0,
      quotedTickets: 0,
      closedTickets: 0,
      todayTickets: 0,
    });
    setDashboardReady(false);
    setEmployees([]);
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeEditId(null);
    setEmployeeMessage("");
    setToastMessage("");
    setCloseModalTicket(null);
    setCloseForm({ bookedOn: "", finalRate: "", awbNumber: "", screenshotUrl: "", closingNotes: "" });
    setCloseError("");
    setEmployeeFilters({ search: "", department: "", roleLevel: "", status: "" });
    setAuthForm({ name: "", email: "", password: "" });
    setAuthMode("login");
    setProfileOpen(false);
    setProfileModalOpen(false);
    setSettingsOpen(false);
    setPasswordOpen(false);
    setNotificationsOpen(false);
    setNotifications([]);
    setProfileData(null);
    localStorage.removeItem("freight_auth");
    setAuthToken(null);
    navigate("/");
  };

  const saveProfile = async () => {
    try {
      const normalizedName = trimName(settingsData.name);
      const normalizedPhone = settingsData.phoneNumber ? normalizePhoneInput(settingsData.phoneNumber) : "";
      if (!normalizedName) {
        setToastMessage("Name is required.");
        return;
      }
      if (!isValidName(normalizedName)) {
        setToastMessage(`${nameErrorMessage}.`);
        return;
      }
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        setToastMessage(phoneErrorMessage);
        return;
      }
      const payload = {
        name: normalizedName,
        email: settingsData.email,
        phoneCountryCode: settingsData.phoneCountryCode,
        phoneNumber: normalizedPhone,
        company: settingsData.company,
        avatarUrl: settingsData.avatarUrl,
      };
      const { data } = await api.put("/users/profile", payload);
      setProfileData((prev) => ({ ...prev, ...data }));
      setUserName(data.name || "");
      setUserEmail(data.email || "");
      const saved = localStorage.getItem("freight_auth");
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem("freight_auth", JSON.stringify({
          ...parsed,
          name: data.name || parsed.name,
          email: data.email || parsed.email,
        }));
      }
      setToastMessage("Profile updated successfully.");
    } catch (error) {
      setToastMessage(error.response?.data?.message || "Failed to update profile");
    }
  };

  const saveSettings = async () => {
    try {
      setSettingsSaving(true);
      setSettingsError("");
      const normalizedName = trimName(settingsData.name);
      const normalizedPhone = settingsData.phoneNumber ? normalizePhoneInput(settingsData.phoneNumber) : "";
      if (!normalizedName) {
        setSettingsError("Name is required.");
        setSettingsSaving(false);
        return;
      }
      if (!isValidName(normalizedName)) {
        setSettingsError(`${nameErrorMessage}.`);
        setSettingsSaving(false);
        return;
      }
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        setSettingsError(phoneErrorMessage);
        setSettingsSaving(false);
        return;
      }
      const payload = {
        name: normalizedName,
        email: settingsData.email,
        phoneCountryCode: settingsData.phoneCountryCode,
        phoneNumber: normalizedPhone,
        company: settingsData.company,
        avatarUrl: settingsData.avatarUrl,
        preferences: settingsData.preferences,
      };
      const { data } = await api.put("/users/profile", payload);
      setProfileData((prev) => ({ ...prev, ...data, preferences: data.preferences || settingsData.preferences }));
      setUserName(data.name || "");
      setUserEmail(data.email || "");
      const saved = localStorage.getItem("freight_auth");
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem("freight_auth", JSON.stringify({
          ...parsed,
          name: data.name || parsed.name,
          email: data.email || parsed.email,
        }));
      }
      setToastMessage("Settings saved successfully.");
    } catch (error) {
      setSettingsError(error.response?.data?.message || "Failed to save settings");
    }
    setSettingsSaving(false);
  };

  const updatePassword = async () => {
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    try {
      await api.put("/users/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordError("");
      setToastMessage("Password updated successfully.");
      setPasswordOpen(false);
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Failed to update password");
    }
  };

  const markNotificationRead = async (id) => {
    await api.patch("/notifications/read", { id });
    fetchNotifications();
  };

  const markAllNotificationsRead = async () => {
    await api.patch("/notifications/read", { all: true });
    fetchNotifications();
  };

  const clearNotifications = async () => {
    await api.delete("/notifications");
    fetchNotifications();
  };

  const submitFeedback = async () => {
    if (!feedbackForm.name.trim() || !feedbackForm.email.trim() || !feedbackForm.message.trim()) {
      setFeedbackMessage("All fields are required.");
      return;
    }
    const normalizedName = trimName(feedbackForm.name);
    if (!isValidName(normalizedName)) {
      setFeedbackMessage(`${nameErrorMessage}.`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedbackForm.email.trim())) {
      setFeedbackMessage("Please enter a valid email.");
      return;
    }
    try {
      await api.post("/feedback", { ...feedbackForm, name: normalizedName });
      setFeedbackForm({ name: "", email: "", message: "" });
      setFeedbackMessage("Thank you! Your feedback has been submitted.");
    } catch (error) {
      setFeedbackMessage(error.response?.data?.message || "Failed to submit feedback.");
    }
  };

  const markFeedbackRead = async (id) => {
    await api.patch(`/feedback/${id}/read`);
    fetchFeedback();
  };

  const deleteFeedback = async (id) => {
    await api.delete(`/feedback/${id}`);
    fetchFeedback();
  };

  const scrollToSection = (id) => {
    const target = document.getElementById(id);
    if (target) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  };

  const initials = (profileData?.name || userName)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "U";

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const isProfileRoute = location.pathname === "/profile";
  const isSettingsRoute = location.pathname === "/settings";

  const authNameInvalid = authMode === "signup" && authForm.name ? !isValidName(authForm.name) : false;
  const profileNameInvalid = settingsData.name ? !isValidName(settingsData.name) : false;
  const profilePhoneInvalid = settingsData.phoneNumber ? !isValidPhone(settingsData.phoneNumber) : false;
  const employeeNameInvalid = employeeForm.name ? !isValidName(employeeForm.name) : false;
  const employeePhoneInvalid = employeeForm.phoneNumber ? !isValidPhone(employeeForm.phoneNumber) : false;
  const feedbackNameInvalid = feedbackForm.name ? !isValidName(feedbackForm.name) : false;

  const isSignupDisabled = authMode === "signup" && (
    !authForm.name.trim() ||
    !authForm.email.trim() ||
    !authForm.password.trim() ||
    !isValidName(authForm.name)
  );
  const isProfileSaveDisabled = !isValidName(settingsData.name) || profilePhoneInvalid;
  const isSettingsSaveDisabled = settingsSaving || !isValidName(settingsData.name) || profilePhoneInvalid;
  const isEmployeeSubmitDisabled =
    !employeeForm.name.trim() ||
    !employeeForm.email.trim() ||
    employeeNameInvalid ||
    employeePhoneInvalid;
  const isFeedbackSubmitDisabled =
    !feedbackForm.name.trim() ||
    !feedbackForm.email.trim() ||
    !feedbackForm.message.trim() ||
    feedbackNameInvalid;

  const profileSection = (
    <section className="section">
      <div className="card profile-page">
        <div className="modal-header">
          <h2>My Profile</h2>
        </div>
        {profileLoading && <div className="note">Loading profile...</div>}
        {!profileLoading && (
          <>
            <label>Full Name</label>
            <input
              value={settingsData.name}
              onChange={(e) => setSettingsData({ ...settingsData, name: normalizeNameInput(e.target.value) })}
              onBlur={(e) => setSettingsData({ ...settingsData, name: trimName(e.target.value) })}
              className={profileNameInvalid ? "input-error" : ""}
            />
            {profileNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
            <label>Email</label>
            <input
              value={settingsData.email}
              onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
            />
            <label>Phone</label>
            <div className="phone-row">
              <select
                className="phone-code"
                value={settingsData.phoneCountryCode}
                onChange={(e) => setSettingsData({ ...settingsData, phoneCountryCode: e.target.value })}
              >
                {countryCodes.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
              <input
                value={settingsData.phoneNumber}
                onChange={(e) => setSettingsData({
                  ...settingsData,
                  phoneNumber: normalizePhoneInput(e.target.value),
                })}
                className={`phone-input ${profilePhoneInvalid ? "input-error" : ""}`}
              />
            </div>
            {profilePhoneInvalid && <div className="input-error-text">{phoneErrorMessage}</div>}
            {role === "customer" && (
              <>
                <label>Company</label>
                <input
                  value={settingsData.company}
                  onChange={(e) => setSettingsData({ ...settingsData, company: e.target.value })}
                />
              </>
            )}
            {role === "employee" && (
              <>
                <label>Department</label>
                <input value={profileData?.department || ""} disabled />
                <label>Employee ID</label>
                <input value={profileData?.employeeId || ""} disabled />
                <label>Assigned tickets</label>
                <input value={profileData?.assignedTicketsCount ?? 0} disabled />
              </>
            )}
            {role === "customer" && (
              <>
                <label>Active tenders</label>
                <input value={profileData?.activeTendersCount ?? 0} disabled />
              </>
            )}
            {role === "admin" && (
              <>
                <label>Privileges</label>
                <input value="Full system access" disabled />
              </>
            )}
            <label>Role</label>
            <input value={roleLabel} disabled />
            <label>Joined Date</label>
            <input value={profileData?.joinedAt ? new Date(profileData.joinedAt).toLocaleDateString() : ""} disabled />
            <label>Avatar URL</label>
            <input
              value={settingsData.avatarUrl}
              onChange={(e) => setSettingsData({ ...settingsData, avatarUrl: e.target.value })}
            />
            <div className="flex">
              <button className="btn" onClick={saveProfile} disabled={isProfileSaveDisabled}>Save Profile</button>
              <button className="btn secondary" onClick={() => navigate("/")}>Back</button>
            </div>
          </>
        )}
      </div>
    </section>
  );

  const settingsSection = (
    <section className="section">
      <div className="card settings-page">
        <div className="settings-modal">
          <div className="modal-header sticky">
            <div>
              <h2>Account Settings</h2>
              <div className="note">Update your profile, preferences, and notification options.</div>
            </div>
          </div>
          <div className="modal-body">
            <div className="settings-section">
              <h4>Profile Info</h4>
              <label>Name</label>
              <input
                value={settingsData.name}
                onChange={(e) => setSettingsData({ ...settingsData, name: normalizeNameInput(e.target.value) })}
                onBlur={(e) => setSettingsData({ ...settingsData, name: trimName(e.target.value) })}
                className={profileNameInvalid ? "input-error" : ""}
              />
              {profileNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
              <label>Email</label>
              <input
                value={settingsData.email}
                onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
              />
              <label>Avatar URL</label>
              <input
                value={settingsData.avatarUrl}
                onChange={(e) => setSettingsData({ ...settingsData, avatarUrl: e.target.value })}
              />
            </div>
            <div className="settings-section">
              <h4>Contact Info</h4>
              <label>Phone</label>
              <div className="phone-row">
                <select
                  className="phone-code"
                  value={settingsData.phoneCountryCode}
                  onChange={(e) => setSettingsData({ ...settingsData, phoneCountryCode: e.target.value })}
                >
                  {countryCodes.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
                <input
                  value={settingsData.phoneNumber}
                  onChange={(e) => setSettingsData({
                    ...settingsData,
                    phoneNumber: normalizePhoneInput(e.target.value),
                  })}
                  className={`phone-input ${profilePhoneInvalid ? "input-error" : ""}`}
                />
              </div>
              {profilePhoneInvalid && <div className="input-error-text">{phoneErrorMessage}</div>}
              {role === "customer" && (
                <>
                  <label>Company</label>
                  <input
                    value={settingsData.company}
                    onChange={(e) => setSettingsData({ ...settingsData, company: e.target.value })}
                  />
                </>
              )}
            </div>
            <div className="settings-section">
              <h4>Preferences</h4>
              <label>Theme</label>
              <select
                value={settingsData.preferences.theme || "light"}
                onChange={(e) => setSettingsData({
                  ...settingsData,
                  preferences: { ...settingsData.preferences, theme: e.target.value },
                })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <label>Language</label>
              <select
                value={settingsData.preferences.language || "en"}
                onChange={(e) => setSettingsData({
                  ...settingsData,
                  preferences: { ...settingsData.preferences, language: e.target.value },
                })}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div className="settings-section">
              <h4>Notifications</h4>
              <div className="toggle-grid">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settingsData.preferences.notifications?.tenderAssigned ?? true}
                    onChange={(e) => setSettingsData({
                      ...settingsData,
                      preferences: {
                        ...settingsData.preferences,
                        notifications: {
                          ...settingsData.preferences.notifications,
                          tenderAssigned: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Tender assigned</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settingsData.preferences.notifications?.quoteSubmitted ?? true}
                    onChange={(e) => setSettingsData({
                      ...settingsData,
                      preferences: {
                        ...settingsData.preferences,
                        notifications: {
                          ...settingsData.preferences.notifications,
                          quoteSubmitted: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Quote submitted</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settingsData.preferences.notifications?.ticketClosed ?? true}
                    onChange={(e) => setSettingsData({
                      ...settingsData,
                      preferences: {
                        ...settingsData.preferences,
                        notifications: {
                          ...settingsData.preferences.notifications,
                          ticketClosed: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Ticket closed</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settingsData.preferences.notifications?.systemAlerts ?? true}
                    onChange={(e) => setSettingsData({
                      ...settingsData,
                      preferences: {
                        ...settingsData.preferences,
                        notifications: {
                          ...settingsData.preferences.notifications,
                          systemAlerts: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>System alerts</span>
                </label>
              </div>
            </div>
            {settingsError && <div className="note">{settingsError}</div>}
          </div>
          <div className="modal-footer sticky">
            <button className="btn" onClick={saveSettings} disabled={isSettingsSaveDisabled}>
              {settingsSaving ? "Saving..." : "Save Changes"}
            </button>
            <button className="btn secondary" onClick={() => navigate("/")}>Back</button>
          </div>
        </div>
      </div>
    </section>
  );

  const updateTender = (field, value) => {
    setTender((prev) => ({ ...prev, [field]: value }));
  };

  const updateTicketFilter = (field, value) => {
    setTicketFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetTicketFilters = () => {
    setTicketFilters({ status: "", origin: "", destination: "", dateFrom: "", dateTo: "" });
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatWeight = (value) => {
    if (value === "") return "";
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "";
    return parsed.toFixed(MAX_WEIGHT_DECIMALS).replace(/\.00$/, "");
  };

  const updateLoad = (index, updater) => {
    setTender((prev) => {
      const loads = prev.loads.map((load, loadIndex) => {
        if (loadIndex !== index) return load;
        return typeof updater === "function" ? updater(load) : { ...load, ...updater };
      });
      return { ...prev, loads };
    });
  };

  const updateUnitCount = (index, value) => {
    const clean = value.replace(/[^0-9]/g, "");
    const units = clean === "" ? "" : String(Math.max(1, Number(clean)));
    updateLoad(index, (load) => {
      const count = units === "" ? 0 : Number(units);
      const weightPerUnit = load.weightPerUnit === "" ? 0 : Number(load.weightPerUnit);
      const totalWeight = count > 0 ? formatWeight(count * weightPerUnit) : "";
      return { ...load, unitCount: units, totalWeight };
    });
  };

  const updateWeightPerUnit = (index, value) => {
    const clean = value.replace(/[^0-9.]/g, "");
    const parsed = clean === "" ? "" : Number(clean);
    if (clean !== "" && (!Number.isFinite(parsed) || parsed < 0)) {
      return;
    }
    updateLoad(index, (load) => {
      const count = load.unitCount === "" ? 0 : Number(load.unitCount);
      const weightPerUnit = clean === "" ? "" : formatWeight(parsed);
      const totalWeight = count > 0 && weightPerUnit !== "" ? formatWeight(count * Number(weightPerUnit)) : "";
      return { ...load, weightPerUnit, totalWeight };
    });
  };

  const updateTotalWeight = (index, value) => {
    const clean = value.replace(/[^0-9.]/g, "");
    const parsed = clean === "" ? "" : Number(clean);
    if (clean !== "" && (!Number.isFinite(parsed) || parsed < 0)) {
      return;
    }
    updateLoad(index, (load) => {
      const count = load.unitCount === "" ? 0 : Number(load.unitCount);
      const totalWeight = clean === "" ? "" : formatWeight(parsed);
      const weightPerUnit = count > 0 && totalWeight !== "" ? formatWeight(Number(totalWeight) / count) : load.weightPerUnit;
      return { ...load, totalWeight, weightPerUnit };
    });
  };

  const updateDimension = (index, field, value) => {
    const clean = value.replace(/[^0-9.]/g, "");
    updateLoad(index, { [field]: clean });
  };

  const getLoadSummary = (load) => {
    const units = load.unitCount;
    const length = load.length;
    const width = load.width;
    const height = load.height;
    const totalWeight = load.totalWeight || formatWeight(toNumber(load.unitCount) * toNumber(load.weightPerUnit));
    if (!units || !length || !width || !height || !totalWeight) {
      return "";
    }
    return `${units}@${length}${width}${height} - CW-${totalWeight} KG`;
  };

  const addLoad = () => {
    setTender((prev) => ({ ...prev, loads: [...prev.loads, createEmptyLoad()] }));
  };

  const removeLoad = (index) => {
    setTender((prev) => ({ ...prev, loads: prev.loads.filter((_, loadIndex) => loadIndex !== index) }));
  };

  const selectedOrigin = airportOptions.find((option) => option.value === tender.origin) || null;
  const selectedDestination = airportOptions.find((option) => option.value === tender.destination) || null;

  const submitTender = async () => {
    try {
      if (!tender.origin || !tender.destination || !tender.cargoType) {
        setMessage("Origin, destination, and cargo type are required.");
        return;
      }
      if (!tender.shipperIdStatus) {
        setMessage("Please select whether the shipper ID is known.");
        return;
      }
      if (!tender.loads.length) {
        setMessage("At least one load is required.");
        return;
      }
      const loads = tender.loads.map((load, index) => {
        const units = Number(load.unitCount);
        const weightPerUnit = Number(load.weightPerUnit);
        const totalWeight = Number(load.totalWeight || units * weightPerUnit);
        const dimensionsReady = load.length && load.width && load.height;
        if (!Number.isFinite(units) || units <= 0) {
          throw new Error(`Load ${index + 1}: Units must be greater than zero.`);
        }
        if (!Number.isFinite(weightPerUnit) || weightPerUnit <= 0) {
          throw new Error(`Load ${index + 1}: Weight per unit must be greater than zero.`);
        }
        if (!dimensionsReady) {
          throw new Error(`Load ${index + 1}: All dimensions are required.`);
        }
        const summary = getLoadSummary(load);
        if (!summary) {
          throw new Error(`Load ${index + 1}: Summary could not be generated.`);
        }
        return {
          unitCount: units,
          weightPerUnit,
          totalWeight,
          dimensions: {
            length: Number(load.length),
            width: Number(load.width),
            height: Number(load.height),
            unit: load.dimensionUnit,
          },
          stackable: load.stackable,
          turnable: load.turnable,
          summary,
        };
      });
      const loadSummary = loads.map((load) => load.summary);
      await api.post("/tickets", {
        ...tender,
        loads,
        loadSummary,
      });
      setTender(emptyTender);
      fetchTickets();
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Tender submission failed");
    }
  };

  const openTicketDetails = (ticketId) => {
    navigate(`/ticket/${ticketId}`);
  };

  const stopPropagation = (event) => {
    event.stopPropagation();
  };

  const selectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setQuote(emptyQuote);
    setBooking(ticket.booking || emptyBooking);
  };

  const updateStatus = async (ticketId, status) => {
    await api.patch(`/tickets/${ticketId}/status`, { status });
    fetchTickets();
  };

  const sendQuote = async () => {
    if (!selectedTicket) return;
    if (!quote.carrier || !quote.rate) {
      setMessage("Carrier and rate are required for a quote.");
      return;
    }
    await api.post(`/tickets/${selectedTicket.ticketId}/quote`, {
      ...quote,
      rate: Number(quote.rate),
      chargeableWeight: quote.chargeableWeight ? Number(quote.chargeableWeight) : undefined,
      totalAmount: quote.totalAmount ? Number(quote.totalAmount) : undefined,
    });
    fetchTickets();
  };

  const confirmQuote = async (ticketId) => {
    await api.post(`/tickets/${ticketId}/confirm`);
    fetchTickets();
  };

  const reopenTicket = async (ticketId) => {
    await api.post(`/tickets/${ticketId}/reopen`);
    fetchTickets();
  };

  const bookShipment = async () => {
    if (!selectedTicket) return;
    await api.post(`/tickets/${selectedTicket.ticketId}/book`, booking);
    fetchTickets();
  };

  const handleEmployeeFormChange = (field, value) => {
    setEmployeeForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetEmployeeForm = () => {
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeEditId(null);
  };

  const submitEmployee = async () => {
    try {
      const normalizedName = trimName(employeeForm.name);
      const normalizedPhone = employeeForm.phoneNumber ? normalizePhoneInput(employeeForm.phoneNumber) : "";
      if (!isValidName(normalizedName)) {
        setEmployeeMessage(`${nameErrorMessage}.`);
        return;
      }
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        setEmployeeMessage(phoneErrorMessage);
        return;
      }
      const payload = {
        ...employeeForm,
        name: normalizedName,
        phoneNumber: normalizedPhone,
      };
      if (employeeEditId) {
        await api.put(`/employees/${employeeEditId}`, payload);
        setEmployeeMessage("Employee updated successfully.");
      } else {
        const { data } = await api.post("/employees", payload);
        setEmployeeMessage(`Employee created. Temp password: ${data.tempPassword}`);
        setToastMessage("Employee created successfully.");
      }
      resetEmployeeForm();
      fetchEmployees();
    } catch (error) {
      setEmployeeMessage(error.response?.data?.message || "Employee action failed");
    }
  };

  const editEmployee = (employee) => {
    setEmployeeEditId(employee._id);
    setEmployeeForm({
      name: employee.name || "",
      email: employee.email || "",
      password: "",
      phoneCountryCode: employee.phoneCountryCode || "+91",
      phoneNumber: employee.phoneNumber || "",
      department: employee.department || "Sales",
      roleLevel: employee.roleLevel || "Employee",
      branch: employee.branch || "",
      status: employee.status || "active",
    });
  };

  const toggleEmployeeStatus = async (employee) => {
    const nextStatus = employee.status === "active" ? "inactive" : "active";
    await api.patch(`/employees/${employee._id}/status`, { status: nextStatus });
    fetchEmployees();
  };

  const resetEmployeePassword = async (employee) => {
    try {
      const { data } = await api.patch(`/employees/${employee._id}/reset-password`);
      setEmployeeMessage(`Password reset. Temp password: ${data.tempPassword}`);
    } catch (error) {
      setEmployeeMessage(error.response?.data?.message || "Reset password failed");
    }
  };

  const deleteEmployee = async (employee) => {
    await api.delete(`/employees/${employee._id}`);
    fetchEmployees();
  };

  const openCloseModal = (ticket) => {
    if (ticket.status === "closed") {
      return;
    }
    setCloseModalTicket(ticket);
    setCloseForm({ bookedOn: "", finalRate: "", awbNumber: "", screenshotUrl: "", closingNotes: "" });
    setCloseError("");
  };

  const closeTicket = async () => {
    if (!closeModalTicket) return;
    if (!closeForm.bookedOn || !closeForm.finalRate || !closeForm.awbNumber) {
      setCloseError("Booked on, final rate, and AWB number are required.");
      return;
    }
    if (!/^[A-Za-z0-9-]+$/.test(closeForm.awbNumber)) {
      setCloseError("AWB number can include letters, numbers, and hyphen only.");
      return;
    }
    if (Number.isNaN(Number(closeForm.finalRate))) {
      setCloseError("Final rate must be numeric.");
      return;
    }
    await api.post(`/tickets/${closeModalTicket.ticketId}/close`, {
      ...closeForm,
      finalRate: Number(closeForm.finalRate),
    });
    setCloseModalTicket(null);
    setToastMessage("Ticket closed successfully.");
    fetchTickets();
  };

  const assignTicket = async (ticketId, employeeId) => {
    await api.patch(`/tickets/${ticketId}/assign`, { employeeId });
    fetchTickets();
  };

  const filteredEmployees = employees.filter((employee) => {
    const search = employeeFilters.search.toLowerCase();
    const matchesSearch = !search ||
      employee.name?.toLowerCase().includes(search) ||
      employee.email?.toLowerCase().includes(search) ||
      employee.employeeId?.toLowerCase().includes(search);
    const matchesDepartment = !employeeFilters.department || employee.department === employeeFilters.department;
    const matchesRole = !employeeFilters.roleLevel || employee.roleLevel === employeeFilters.roleLevel;
    const matchesStatus = !employeeFilters.status || employee.status === employeeFilters.status;
    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  const employeeStats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((employee) => employee.status === "active").length;
    const departmentCount = employees.reduce((acc, employee) => {
      const dept = employee.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
    const now = new Date();
    const newThisMonth = employees.filter((employee) => {
      if (!employee.createdAt) return false;
      const created = new Date(employee.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { total, active, departmentCount, newThisMonth };
  }, [employees]);

  const departmentSummary = Object.entries(employeeStats.departmentCount)
    .map(([dept, count]) => `${dept}: ${count}`)
    .join(" | ");

  const stats = useMemo(() => {
    const total = tickets.length;
    return {
      total,
      open: tickets.filter((t) => t.status === "open").length,
      quoted: tickets.filter((t) => t.status === "quoted").length,
      transit: tickets.filter((t) => t.status === "in_transit").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    };
  }, [tickets]);

  const dashboard = dashboardReady
    ? dashboardStats
    : {
        totalTickets: stats.total,
        pendingTickets: stats.open,
        quotedTickets: stats.quoted,
        closedTickets: stats.closed,
        todayTickets: 0,
      };

  const dashboardCards = [
    {
      key: "total",
      label: "Total Tenders",
      value: dashboard.totalTickets,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 9h10M7 13h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "pending",
      label: "Pending",
      value: dashboard.pendingTickets,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "quoted",
      label: "Quoted",
      value: dashboard.quotedTickets,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16v10H7l-3 3V7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 11h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "closed",
      label: "Closed",
      value: dashboard.closedTickets,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const ticketFilterControls = (
    <div className="filters">
      <select
        value={ticketFilters.status}
        onChange={(e) => updateTicketFilter("status", e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="quoted">Quoted</option>
        <option value="closed">Closed</option>
      </select>
      <input
        placeholder="Origin"
        value={ticketFilters.origin}
        onChange={(e) => updateTicketFilter("origin", e.target.value)}
      />
      <input
        placeholder="Destination"
        value={ticketFilters.destination}
        onChange={(e) => updateTicketFilter("destination", e.target.value)}
      />
      <input
        type="date"
        value={ticketFilters.dateFrom}
        onChange={(e) => updateTicketFilter("dateFrom", e.target.value)}
      />
      <input
        type="date"
        value={ticketFilters.dateTo}
        onChange={(e) => updateTicketFilter("dateTo", e.target.value)}
      />
      <button className="btn secondary" type="button" onClick={resetTicketFilters}>
        Reset
      </button>
    </div>
  );

  const dashboardSection = (
    <div className="dashboard-grid">
      {dashboardCards.map((card) => (
        <div className="card dashboard-card" key={card.key}>
          <div className="dashboard-icon">{card.icon}</div>
          <div>
            <div className="dashboard-value">{card.value}</div>
            <div className="note">{card.label}</div>
          </div>
        </div>
      ))}
      {dashboardLoading && <div className="note">Refreshing dashboard...</div>}
    </div>
  );

  return (
    <div className="app">
      {toastMessage && <div className="toast">{toastMessage}</div>}
      <header>
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>SkyBridge Logistics</h1>
            <div className="note">Tender, quote, confirm, and book shipments.</div>
          </div>
        </div>
        {token && (
          <div className="profile-area" ref={profileRef}>
            <button
              type="button"
              className="bell-btn"
              onClick={() => setNotificationsOpen(true)}
            >
              <span className="bell-icon">!</span>
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            <button
              className={`profile-card ${profileOpen ? "open" : ""}`}
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              <div className="avatar">
                {profileData?.avatarUrl ? (
                  <img src={profileData.avatarUrl} alt="User avatar" />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="status-dot" />
              </div>
              <div className="profile-text">
                <div className="profile-name">
                  {profileData?.name || userName || "User"}
                  <span className={`role-badge ${role}`}>{roleLabel}</span>
                </div>
                <div className="profile-email">{profileData?.email || userEmail || authForm.email || ""}</div>
              </div>
              <div className="profile-chevron">v</div>
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <button
                  type="button"
                  className={`menu-item ${isProfileRoute ? "active" : ""}`}
                  onClick={() => {
                    navigate("/profile");
                    setProfileOpen(false);
                  }}
                >
                  My Profile
                </button>
                <button
                  type="button"
                  className={`menu-item ${isSettingsRoute ? "active" : ""}`}
                  onClick={() => {
                    navigate("/settings");
                    setProfileOpen(false);
                  }}
                >
                  Account Settings
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setPasswordOpen(true);
                    setProfileOpen(false);
                  }}
                >
                  Change Password
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setNotificationsOpen(true);
                    setProfileOpen(false);
                  }}
                >
                  Notifications
                </button>
                <div className="menu-divider" />
                <button type="button" className="menu-item danger" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </header>
      <main>
        <Routes>
          <Route
            path="/profile"
            element={token ? profileSection : <Navigate to="/" replace />}
          />
          <Route
            path="/settings"
            element={token ? settingsSection : <Navigate to="/" replace />}
          />
          <Route
            path="/ticket/:id"
            element={token ? <TicketDetails /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={!token ? (
              <div className="landing">
                <section id="home" className="landing-hero">
                  <div className="hero-content">
                    <div className="hero-kicker">SkyBridge Logistics</div>
                    <h2>Fast, Reliable Global Freight Solutions</h2>
                    <p className="hero-subtext">
                      Design and Development of a Web-Based Freight Tender Management System — A MERN stack
                      logistics platform for managing freight tenders, customer quotations, booking workflows,
                      and role-based operations for Admin, Employees, and Customers.
                    </p>
                    <div className="hero-actions">
                      <button className="btn accent" onClick={() => scrollToSection("auth")}>Get Started</button>
                      <button className="btn secondary" onClick={() => {
                        setAuthMode("login");
                        scrollToSection("auth");
                      }}>Login</button>
                      <button className="btn" onClick={() => scrollToSection("services")}>Request Quote</button>
                    </div>
                  </div>
                  <div className="hero-glass">
                    <div className="hero-card">
                      <div className="note">Trusted by global supply teams</div>
                      <div className="hero-metrics">
                        <div>
                          <h3>500+</h3>
                          <span>Shipments</span>
                        </div>
                        <div>
                          <h3>120+</h3>
                          <span>Clients</span>
                        </div>
                        <div>
                          <h3>35+</h3>
                          <span>Countries</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section id="about" className="landing-section">
                  <div className="section-header">
                    <h2>About SkyBridge Logistics</h2>
                    <p className="note">Built to orchestrate modern freight tender and booking workflows.</p>
                  </div>
                  <div className="feature-grid">
                    <div className="feature-card">Freight Tender Management</div>
                    <div className="feature-card">Customer Quote Handling</div>
                    <div className="feature-card">Shipment Booking Workflow</div>
                    <div className="feature-card">Role-Based Operations</div>
                    <div className="feature-card">Real-Time Coordination</div>
                  </div>
                </section>

                <section id="services" className="landing-section">
                  <div className="section-header">
                    <h2>Services</h2>
                    <p className="note">Multi-modal logistics services for every shipment type.</p>
                  </div>
                  <div className="service-grid">
                    <div className="service-card">Air Freight</div>
                    <div className="service-card">Ocean Freight</div>
                    <div className="service-card">Road Transport</div>
                    <div className="service-card">Customs Clearance</div>
                    <div className="service-card">Warehousing</div>
                    <div className="service-card">Express Delivery</div>
                  </div>
                </section>

                <section id="why" className="landing-section">
                  <div className="section-header">
                    <h2>Why Choose Us</h2>
                    <p className="note">Operational excellence backed by intelligent tracking and secure workflows.</p>
                  </div>
                  <div className="pill-grid">
                    <div className="pill">Fast Response</div>
                    <div className="pill">Competitive Rates</div>
                    <div className="pill">Secure Operations</div>
                    <div className="pill">Expert Team</div>
                    <div className="pill">Global Network</div>
                    <div className="pill">Smart Tracking</div>
                  </div>
                </section>

                <section id="stats" className="landing-section stats-section">
                  <div className="stat-card">500+<span>Shipments</span></div>
                  <div className="stat-card">120+<span>Clients</span></div>
                  <div className="stat-card">35+<span>Countries</span></div>
                  <div className="stat-card">24/7<span>Support</span></div>
                </section>

                <section id="auth" className="hero auth-landing">
                  <div className="auth-shell">
                    <div className="auth-media">
                      <div className="auth-media-content">
                        <div className="auth-kicker">SkyBridge Logistics</div>
                        <h2>Global freight, simplified.</h2>
                        <p className="auth-copy">
                          Move cargo with confidence. Real-time quotes, smart routing, and seamless booking in one place.
                        </p>
                        <div className="auth-highlights">
                          <div className="auth-pill">Fast quotes</div>
                          <div className="auth-pill">Secure bookings</div>
                          <div className="auth-pill">Transparent tracking</div>
                        </div>
                      </div>
                    </div>
                    <div className="auth-card">
                      <div className="auth-header">
                        <div>
                          <h2>Welcome back</h2>
                          <div className="note">Sign in to manage tenders and bookings.</div>
                        </div>
                        <div className="auth-toggle">
                          <button
                            className={`btn ${authMode === "login" ? "" : "secondary"}`}
                            onClick={() => setAuthMode("login")}
                          >
                            Login
                          </button>
                          <button
                            className={`btn ${authMode === "signup" ? "" : "secondary"}`}
                            onClick={() => setAuthMode("signup")}
                          >
                            Signup
                          </button>
                        </div>
                      </div>
                      {authMode === "signup" && (
                        <>
                          <label>Full name</label>
                          <input
                            value={authForm.name}
                            onChange={(e) => onAuthChange("name", normalizeNameInput(e.target.value))}
                            onBlur={(e) => onAuthChange("name", trimName(e.target.value))}
                            className={authNameInvalid ? "input-error" : ""}
                          />
                          {authNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
                        </>
                      )}
                      <label>Email</label>
                      <input value={authForm.email} onChange={(e) => onAuthChange("email", e.target.value)} />
                      <label>Password</label>
                      <div className="input-with-action">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authForm.password}
                          onChange={(e) => onAuthChange("password", e.target.value)}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {authMode === "login" && (
                        <>
                          <label>Role</label>
                          <select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="customer">Customer</option>
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                          </select>
                        </>
                      )}
                      <button
                        className="btn accent"
                        onClick={authMode === "login" ? handleLogin : handleSignup}
                        disabled={authMode === "signup" && isSignupDisabled}
                      >
                        {authMode === "login" ? "Login" : "Create account"}
                      </button>
                      {message && <div className="note">{message}</div>}
                    </div>
                  </div>
                </section>

                <footer className="footer" id="footer">
                  <div className="footer-grid">
                    <div>
                      <h3>SkyBridge Logistics</h3>
                      <p className="note">Fast, reliable freight tender management for global operations.</p>
                      <div className="note">Phone: +91 9000000000</div>
                      <div className="note">Email: info@skybridgelogistics.com</div>
                      <div className="note">Address: 221B Logistics Park, Global Avenue</div>
                    </div>
                    <div>
                      <h4>Quick Links</h4>
                      <div className="footer-links">
                        <button type="button" className="link-btn" onClick={() => scrollToSection("home")}>Home</button>
                        <button type="button" className="link-btn" onClick={() => scrollToSection("services")}>Services</button>
                        <button type="button" className="link-btn" onClick={() => scrollToSection("about")}>About</button>
                        <button type="button" className="link-btn" onClick={() => scrollToSection("auth")}>Login</button>
                      </div>
                    </div>
                    <div>
                      <h4>Feedback</h4>
                      <label>Name</label>
                      <input
                        value={feedbackForm.name}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, name: normalizeNameInput(e.target.value) })}
                        onBlur={(e) => setFeedbackForm({ ...feedbackForm, name: trimName(e.target.value) })}
                        className={feedbackNameInvalid ? "input-error" : ""}
                      />
                      {feedbackNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
                      <label>Email</label>
                      <input
                        value={feedbackForm.email}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                      />
                      <label>Message</label>
                      <textarea
                        value={feedbackForm.message}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                      />
                      <button className="btn" onClick={submitFeedback} disabled={isFeedbackSubmitDisabled}>Submit Feedback</button>
                      {feedbackMessage && <div className="note">{feedbackMessage}</div>}
                    </div>
                  </div>
                </footer>
              </div>
            ) : role === "customer" ? (
        <section className="section">
          <div className="grid">
            <div className="card">
              <h2>Create tender</h2>
              <label>Origin</label>
              <Select
                value={selectedOrigin}
                onChange={(option) => updateTender("origin", option ? option.value : "")}
                options={airportOptions}
                placeholder="Search by IATA, city, airport, or country"
                styles={selectStyles}
                filterOption={airportFilter}
                isClearable
              />
              <label>Destination</label>
              <Select
                value={selectedDestination}
                onChange={(option) => updateTender("destination", option ? option.value : "")}
                options={airportOptions}
                placeholder="Search by IATA, city, airport, or country"
                styles={selectStyles}
                filterOption={airportFilter}
                isClearable
              />
              <label>Cargo type</label>
              <select value={tender.cargoType} onChange={(e) => updateTender("cargoType", e.target.value)}>
                <option value="">Select cargo type</option>
                <option value="General Goods">General Goods</option>
                <option value="HazMat">HazMat</option>
                <option value="Household Goods">Household Goods</option>
                <option value="Dangerous Goods">Dangerous Goods</option>
                <option value="Perishable Items">Perishable Items</option>
                <option value="Used Goods w/ Battery">Used Goods w/ Battery</option>
              </select>
              <label>Shipper ID</label>
              <select
                value={tender.shipperIdStatus}
                onChange={(e) => updateTender("shipperIdStatus", e.target.value)}
              >
                <option value="">Select option</option>
                <option value="known">Known</option>
                <option value="unknown">Unknown</option>
              </select>
              <div className="load-list">
                {tender.loads.map((load, index) => (
                  <div className="load-card" key={`load-${index}`}>
                    <div className="load-header">
                      <div className="note">Load {index + 1}</div>
                      {tender.loads.length > 1 && (
                        <button className="btn secondary" type="button" onClick={() => removeLoad(index)}>
                          Remove
                        </button>
                      )}
                    </div>
                    <label>No. of Units / Pallets</label>
                    <input
                      inputMode="numeric"
                      value={load.unitCount}
                      onChange={(e) => updateUnitCount(index, e.target.value)}
                      placeholder="e.g. 2"
                    />
                    <label>Weight per unit (kg)</label>
                    <input
                      inputMode="decimal"
                      value={load.weightPerUnit}
                      onChange={(e) => updateWeightPerUnit(index, e.target.value)}
                      placeholder="e.g. 250"
                    />
                    <label>Total weight (kg)</label>
                    <input
                      inputMode="decimal"
                      value={load.totalWeight}
                      onChange={(e) => updateTotalWeight(index, e.target.value)}
                      placeholder="Auto-calculated"
                    />
                    <label>Dimensions L x W x H</label>
                    <div className="dim-row">
                      <input
                        className="dim-box"
                        inputMode="decimal"
                        placeholder="48"
                        value={load.length}
                        onChange={(e) => updateDimension(index, "length", e.target.value)}
                      />
                      <input
                        className="dim-box"
                        inputMode="decimal"
                        placeholder="40"
                        value={load.width}
                        onChange={(e) => updateDimension(index, "width", e.target.value)}
                      />
                      <input
                        className="dim-box"
                        inputMode="decimal"
                        placeholder="58"
                        value={load.height}
                        onChange={(e) => updateDimension(index, "height", e.target.value)}
                      />
                      <select
                        className="dim-unit"
                        value={load.dimensionUnit}
                        onChange={(e) => updateLoad(index, { dimensionUnit: e.target.value })}
                      >
                        <option value="IN">IN</option>
                        <option value="CM">CM</option>
                      </select>
                    </div>
                    <div className="toggle-row">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={load.stackable}
                          onChange={(e) => updateLoad(index, { stackable: e.target.checked })}
                        />
                        <span>Stackable</span>
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={load.turnable}
                          onChange={(e) => updateLoad(index, { turnable: e.target.checked })}
                        />
                        <span>Turnable</span>
                      </label>
                    </div>
                    {getLoadSummary(load) && (
                      <div className="summary">Load summary: {getLoadSummary(load)}</div>
                    )}
                  </div>
                ))}
                <button className="btn" type="button" onClick={addLoad}>Add another load</button>
              </div>
              <label>Notes</label>
              <textarea value={tender.notes} onChange={(e) => updateTender("notes", e.target.value)} />
              <button className="btn accent" onClick={submitTender}>Submit tender</button>
            </div>
                  <div className="card">
                    <h2>Your tickets</h2>
                    {ticketFilterControls}
                    {tickets.length === 0 && <div className="note">No tickets yet.</div>}
                    {tickets.map((ticket) => (
                      <div
                        className="ticket clickable"
                        key={ticket.ticketId}
                        role="button"
                        tabIndex={0}
                        onClick={() => openTicketDetails(ticket.ticketId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            openTicketDetails(ticket.ticketId);
                          }
                        }}
                      >
                        <h4>{ticket.ticketId}</h4>
                        <div className="status">{statusLabel(ticket.status)}</div>
                        <div className="note">{ticket.origin} to {ticket.destination} | {ticket.cargoType}</div>
                  {ticket.shipperIdStatus && (
                    <div className="note">Shipper ID: {ticket.shipperIdStatus}</div>
                  )}
                  {Array.isArray(ticket.loadSummary) && ticket.loadSummary.length > 0 && (
                    <div className="note">Load: {ticket.loadSummary.join(" | ")}</div>
                  )}
                  {!Array.isArray(ticket.loadSummary) && ticket.loadSummary && (
                    <div className="note">Load: {ticket.loadSummary}</div>
                  )}
                  {Array.isArray(ticket.quotes) && ticket.quotes.length > 0 && (
                    <div className="quote-grid">
                      {ticket.quotes.map((q) => (
                        <div className="quote-card" key={q.quoteId}>
                          <div className="note">Carrier: {q.carrier}</div>
                          <div className="note">Service: {q.serviceType || "-"}</div>
                          <div className="note">Rate: {q.rate} {q.currency}</div>
                          <div className="note">Transit: {q.transitTime || "-"}</div>
                          <div className="note">Validity: {q.validity || "-"}</div>
                          <div className="note">Chargeable Wt: {q.chargeableWeight || "-"}</div>
                          <div className="note">Total: {q.totalAmount || "-"}</div>
                          <div className="note">Quote date: {q.quoteDate || "-"}</div>
                          <div className="note">By: {q.createdByName || "-"}</div>
                          <div className="note">Status: {q.status}</div>
                          {q.remarks && <div className="note">Remarks: {q.remarks}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {(!ticket.quotes || ticket.quotes.length === 0) && (
                    <div className="note">Awaiting employee quote.</div>
                  )}
                  {ticket.status === "closed" && (
                    <div className="note">
                      Closed on {ticket.bookedOn || "-"} | Final rate {ticket.finalRate || "-"} | AWB {ticket.awbNumber || "-"}
                      {ticket.closingNotes ? ` | Notes: ${ticket.closingNotes}` : ""}
                    </div>
                  )}
                  {ticket.screenshotUrl && (
                    <div className="note">Proof: {ticket.screenshotUrl}</div>
                  )}
                  {ticket.booking && (
                    <div className="note">Booking ref: {ticket.booking.reference}</div>
                  )}
                  {ticket.quotes && ticket.quotes.length > 0 && ticket.status === "quoted" && (
                    <div className="flex">
                      <button className="btn" onClick={(event) => {
                        stopPropagation(event);
                        confirmQuote(ticket.ticketId);
                      }}>Confirm</button>
                      <button className="btn secondary" onClick={(event) => {
                        stopPropagation(event);
                        reopenTicket(ticket.ticketId);
                      }}>Request change</button>
                    </div>
                  )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : role === "employee" ? (
              <section>
                {dashboardSection}
                <div className="grid">
                  <div className="card">
                    <h2>Tickets</h2>
                    {ticketFilterControls}
                    {tickets.map((ticket) => (
                      <div
                        className="ticket clickable"
                        key={ticket.ticketId}
                        role="button"
                        tabIndex={0}
                        onClick={() => openTicketDetails(ticket.ticketId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            openTicketDetails(ticket.ticketId);
                          }
                        }}
                      >
                        <h4>{ticket.ticketId}</h4>
                        <div className="status">{statusLabel(ticket.status)}</div>
                        <div className="note">{ticket.origin} to {ticket.destination}</div>
                        <div className="note">{ticket.cargoType}</div>
                        {ticket.shipperIdStatus && (
                          <div className="note">Shipper ID: {ticket.shipperIdStatus}</div>
                        )}
                        {Array.isArray(ticket.loadSummary) && ticket.loadSummary.length > 0 && (
                          <div className="note">{ticket.loadSummary.join(" | ")}</div>
                        )}
                        {!Array.isArray(ticket.loadSummary) && ticket.loadSummary && (
                          <div className="note">{ticket.loadSummary}</div>
                        )}
                        {Array.isArray(ticket.loads) && ticket.loads.length > 0 && (
                          <div className="note">
                            {ticket.loads.map((load, idx) => (
                              <span key={`${ticket.ticketId}-load-${idx}`}>
                                {load.unitCount} units | {load.weightPerUnit} kg per unit | Total {load.totalWeight} kg | {load.dimensions.length}x{load.dimensions.width}x{load.dimensions.height} {load.dimensions.unit}{idx < ticket.loads.length - 1 ? " / " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {ticket.assignedEmployeeName && (
                          <div className="note">Assigned to: {ticket.assignedEmployeeName}</div>
                        )}
                        {ticket.status !== "closed" && (
                          <button className="btn" onClick={(event) => {
                            stopPropagation(event);
                            openCloseModal(ticket);
                          }}>Close ticket</button>
                        )}
                        <button className="btn secondary" onClick={(event) => {
                          stopPropagation(event);
                          selectTicket(ticket);
                        }}>Open</button>
                        <div className="flex">
                          <button className="btn" onClick={(event) => {
                            stopPropagation(event);
                            updateStatus(ticket.ticketId, "open");
                          }}>Open</button>
                          <button className="btn" onClick={(event) => {
                            stopPropagation(event);
                            updateStatus(ticket.ticketId, "in_transit");
                          }}>In-transit</button>
                          <button className="btn" onClick={(event) => {
                            stopPropagation(event);
                            updateStatus(ticket.ticketId, "closed");
                          }}>Closed</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <h2>Quote & booking</h2>
                    {!selectedTicket && <div className="note">Select a ticket to work on.</div>}
                    {selectedTicket && (
                      <>
                        <div className="note">Working on {selectedTicket.ticketId}</div>
                        <label>Freighter / Airline</label>
                        <input value={quote.carrier} onChange={(e) => setQuote({ ...quote, carrier: e.target.value })} />
                  <label>Service type</label>
                  <input value={quote.serviceType} onChange={(e) => setQuote({ ...quote, serviceType: e.target.value })} />
                  <label>Rate</label>
                  <input type="number" value={quote.rate} onChange={(e) => setQuote({ ...quote, rate: e.target.value })} />
                  <label>Currency</label>
                  <select value={quote.currency} onChange={(e) => setQuote({ ...quote, currency: e.target.value })}>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                  </select>
                  <label>Transit time</label>
                  <input value={quote.transitTime} onChange={(e) => setQuote({ ...quote, transitTime: e.target.value })} />
                  <label>Validity</label>
                  <input value={quote.validity} onChange={(e) => setQuote({ ...quote, validity: e.target.value })} />
                  <label>Chargeable weight</label>
                  <input type="number" value={quote.chargeableWeight} onChange={(e) => setQuote({ ...quote, chargeableWeight: e.target.value })} />
                  <label>Total amount</label>
                  <input type="number" value={quote.totalAmount} onChange={(e) => setQuote({ ...quote, totalAmount: e.target.value })} />
                  <label>Quote date</label>
                  <input type="date" value={quote.quoteDate} onChange={(e) => setQuote({ ...quote, quoteDate: e.target.value })} />
                  <label>Remarks</label>
                  <textarea value={quote.remarks} onChange={(e) => setQuote({ ...quote, remarks: e.target.value })} />
                    <button className="btn" onClick={sendQuote}>Send quote</button>

                        <label>Booking reference</label>
                        <input value={booking.reference} onChange={(e) => setBooking({ ...booking, reference: e.target.value })} />
                        <label>Booking notes</label>
                        <textarea value={booking.notes} onChange={(e) => setBooking({ ...booking, notes: e.target.value })} />
                        <button className="btn accent" onClick={bookShipment}>Book shipment</button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <div className="flex" style={{ marginBottom: 16 }}>
                  <button
                    className={`btn ${adminView === "overview" ? "" : "secondary"}`}
                    onClick={() => setAdminView("overview")}
                  >
                    Overview
                  </button>
                  <button
                    className={`btn ${adminView === "employees" ? "" : "secondary"}`}
                    onClick={() => setAdminView("employees")}
                  >
                    Employee Management
                  </button>
                  <button
                    className={`btn ${adminView === "feedback" ? "" : "secondary"}`}
                    onClick={() => setAdminView("feedback")}
                  >
                    Feedback Management
                  </button>
                </div>
                {adminView === "overview" && dashboardSection}
                <div className="grid">
                  {adminView === "overview" ? (
                    <>
                      <div className="card">
                        <h2>Admin overview</h2>
                        {ticketFilterControls}
                        {tickets.map((ticket) => (
                          <div
                            className="ticket clickable"
                            key={ticket.ticketId}
                            role="button"
                            tabIndex={0}
                            onClick={() => openTicketDetails(ticket.ticketId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                openTicketDetails(ticket.ticketId);
                              }
                            }}
                          >
                            <h4>{ticket.ticketId}</h4>
                            <div className="status">{statusLabel(ticket.status)}</div>
                            <div className="note">{ticket.customerName} | {ticket.origin} to {ticket.destination}</div>
                            <div className="note">Cargo: {ticket.cargoType}</div>
                            {ticket.assignedEmployeeName && (
                              <div className="note">Assigned: {ticket.assignedEmployeeName} ({ticket.assignedEmployeeId})</div>
                            )}
                            {ticket.status !== "closed" && (
                              <button className="btn" onClick={(event) => {
                                stopPropagation(event);
                                openCloseModal(ticket);
                              }}>Close ticket</button>
                            )}
                            <label>Assign employee</label>
                            <select
                              value={ticket.assignedEmployee || ""}
                              onClick={stopPropagation}
                              onChange={(e) => {
                                stopPropagation(e);
                                assignTicket(ticket.ticketId, e.target.value);
                              }}
                            >
                              <option value="">Unassigned</option>
                              {employees
                                .filter((employee) => employee.status === "active")
                                .map((employee) => (
                                  <option key={employee._id} value={employee._id}>
                                    {employee.name} ({employee.employeeId})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="card">
                        <h2>Employee stats</h2>
                        <div className="note">Total employees: {employeeStats.total}</div>
                        <div className="note">Active employees: {employeeStats.active}</div>
                        <div className="note">New this month: {employeeStats.newThisMonth}</div>
                        {departmentSummary && <div className="note">Departments: {departmentSummary}</div>}
                      </div>
                    </>
                  ) : adminView === "feedback" ? (
                    <>
                      <div className="card">
                        <h2>Feedback Management</h2>
                        {feedbackLoading && <div className="note">Loading feedback...</div>}
                        {!feedbackLoading && feedbackList.length === 0 && (
                          <div className="note">No feedback submitted yet.</div>
                        )}
                        {!feedbackLoading && feedbackList.length > 0 && (
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Message</th>
                                  <th>Date</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {feedbackList.map((item) => (
                                  <tr key={item._id}>
                                    <td>{item.name}</td>
                                    <td>{item.email}</td>
                                    <td>{item.message}</td>
                                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                                    <td>{item.status}</td>
                                    <td>
                                      <div className="table-actions">
                                        {item.status !== "read" && (
                                          <button className="btn secondary" onClick={() => markFeedbackRead(item._id)}>
                                            Mark read
                                          </button>
                                        )}
                                        <button className="btn" onClick={() => deleteFeedback(item._id)}>Delete</button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="card">
                        <h2>Employee management</h2>
                        <div className="note">Create or update employee accounts.</div>
                        <label>Full name</label>
                        <input
                          value={employeeForm.name}
                          onChange={(e) => handleEmployeeFormChange("name", normalizeNameInput(e.target.value))}
                          onBlur={(e) => handleEmployeeFormChange("name", trimName(e.target.value))}
                          className={employeeNameInvalid ? "input-error" : ""}
                        />
                        {employeeNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
                    <label>Email</label>
                    <input value={employeeForm.email} onChange={(e) => handleEmployeeFormChange("email", e.target.value)} />
                        <label>Password (optional)</label>
                        <input
                          type="password"
                          value={employeeForm.password}
                          onChange={(e) => handleEmployeeFormChange("password", e.target.value)}
                          placeholder="Leave blank to auto-generate"
                        />
                        <label>Phone number</label>
                        <div className="phone-row">
                          <select
                            className="phone-code"
                            value={employeeForm.phoneCountryCode}
                            onChange={(e) => handleEmployeeFormChange("phoneCountryCode", e.target.value)}
                          >
                            {countryCodes.map((item) => (
                              <option key={item.code} value={item.code}>{item.label}</option>
                            ))}
                          </select>
                          <input
                            inputMode="numeric"
                            value={employeeForm.phoneNumber}
                            onChange={(e) => handleEmployeeFormChange("phoneNumber", normalizePhoneInput(e.target.value))}
                            placeholder="10 digit number"
                            className={`phone-input ${employeePhoneInvalid ? "input-error" : ""}`}
                          />
                        </div>
                        {employeePhoneInvalid && <div className="input-error-text">{phoneErrorMessage}</div>}
                        <label>Department</label>
                        <select value={employeeForm.department} onChange={(e) => handleEmployeeFormChange("department", e.target.value)}>
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        <label>Role</label>
                        <select value={employeeForm.roleLevel} onChange={(e) => handleEmployeeFormChange("roleLevel", e.target.value)}>
                          {roleLevels.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                        <label>Branch / Office location</label>
                        <input value={employeeForm.branch} onChange={(e) => handleEmployeeFormChange("branch", e.target.value)} />
                        <label>Status</label>
                        <select value={employeeForm.status} onChange={(e) => handleEmployeeFormChange("status", e.target.value)}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <div className="flex">
                          <button className="btn" onClick={submitEmployee} disabled={isEmployeeSubmitDisabled}>
                            {employeeEditId ? "Update employee" : "Create employee"}
                          </button>
                          {employeeEditId && (
                            <button className="btn secondary" onClick={resetEmployeeForm}>Cancel</button>
                          )}
                        </div>
                        {employeeMessage && <div className="note">{employeeMessage}</div>}
                      </div>
                      <div className="card">
                        <h2>Employees</h2>
                        <div className="note">Total: {employeeStats.total} | Active: {employeeStats.active} | New this month: {employeeStats.newThisMonth}</div>
                        {departmentSummary && <div className="note">Departments: {departmentSummary}</div>}
                        <div className="filters">
                          <input
                            placeholder="Search by name, email, ID"
                            value={employeeFilters.search}
                            onChange={(e) => setEmployeeFilters({ ...employeeFilters, search: e.target.value })}
                          />
                          <select
                            value={employeeFilters.department}
                            onChange={(e) => setEmployeeFilters({ ...employeeFilters, department: e.target.value })}
                          >
                            <option value="">All departments</option>
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                          <select
                            value={employeeFilters.roleLevel}
                            onChange={(e) => setEmployeeFilters({ ...employeeFilters, roleLevel: e.target.value })}
                          >
                            <option value="">All roles</option>
                            {roleLevels.map((level) => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                          <select
                            value={employeeFilters.status}
                            onChange={(e) => setEmployeeFilters({ ...employeeFilters, status: e.target.value })}
                          >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredEmployees.map((employee) => (
                                <tr key={employee._id}>
                                  <td>{employee.employeeId}</td>
                                  <td>{employee.name}</td>
                                  <td>{employee.email}</td>
                                  <td>{employee.department || "-"}</td>
                                  <td>{employee.roleLevel || "-"}</td>
                                  <td>{employee.status}</td>
                                  <td>{employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : "-"}</td>
                                  <td>
                                    <div className="table-actions">
                                      <button className="btn secondary" onClick={() => editEmployee(employee)}>Edit</button>
                                      <button className="btn secondary" onClick={() => resetEmployeePassword(employee)}>Reset password</button>
                                      <button className="btn" onClick={() => toggleEmployeeStatus(employee)}>
                                        {employee.status === "active" ? "Deactivate" : "Activate"}
                                      </button>
                                      <button className="btn" onClick={() => deleteEmployee(employee)}>Delete</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </main>
          {profileModalOpen && (
            <div className="modal-overlay" onClick={() => setProfileModalOpen(false)}>
              <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <h3>My Profile</h3>
                  <button type="button" className="modal-close" onClick={() => setProfileModalOpen(false)}>Close</button>
                </div>
                {profileLoading && <div className="note">Loading profile...</div>}
                {!profileLoading && (
                  <>
                    <label>Full Name</label>
                    <input
                      value={settingsData.name}
                      onChange={(e) => setSettingsData({ ...settingsData, name: normalizeNameInput(e.target.value) })}
                      onBlur={(e) => setSettingsData({ ...settingsData, name: trimName(e.target.value) })}
                      className={profileNameInvalid ? "input-error" : ""}
                    />
                    {profileNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
                    <label>Email</label>
                    <input
                      value={settingsData.email}
                      onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
                    />
                    <label>Phone</label>
                    <div className="phone-row">
                      <select
                        className="phone-code"
                        value={settingsData.phoneCountryCode}
                        onChange={(e) => setSettingsData({ ...settingsData, phoneCountryCode: e.target.value })}
                      >
                        {countryCodes.map((item) => (
                          <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                      </select>
                      <input
                        value={settingsData.phoneNumber}
                        onChange={(e) => setSettingsData({
                          ...settingsData,
                          phoneNumber: normalizePhoneInput(e.target.value),
                        })}
                        className={`phone-input ${profilePhoneInvalid ? "input-error" : ""}`}
                      />
                    </div>
                    {profilePhoneInvalid && <div className="input-error-text">{phoneErrorMessage}</div>}
                    {role === "customer" && (
                      <>
                        <label>Company</label>
                        <input
                          value={settingsData.company}
                          onChange={(e) => setSettingsData({ ...settingsData, company: e.target.value })}
                        />
                      </>
                    )}
                    {role === "employee" && (
                      <>
                        <label>Department</label>
                        <input value={profileData?.department || ""} disabled />
                        <label>Employee ID</label>
                        <input value={profileData?.employeeId || ""} disabled />
                        <label>Assigned tickets</label>
                        <input value={profileData?.assignedTicketsCount ?? 0} disabled />
                      </>
                    )}
                    {role === "customer" && (
                      <>
                        <label>Active tenders</label>
                        <input value={profileData?.activeTendersCount ?? 0} disabled />
                      </>
                    )}
                    {role === "admin" && (
                      <>
                        <label>Privileges</label>
                        <input value="Full system access" disabled />
                      </>
                    )}
                    <label>Role</label>
                    <input value={roleLabel} disabled />
                    <label>Joined Date</label>
                    <input value={profileData?.joinedAt ? new Date(profileData.joinedAt).toLocaleDateString() : ""} disabled />
                    <label>Avatar URL</label>
                    <input
                      value={settingsData.avatarUrl}
                      onChange={(e) => setSettingsData({ ...settingsData, avatarUrl: e.target.value })}
                    />
                    <div className="flex">
                      <button className="btn" onClick={saveProfile} disabled={isProfileSaveDisabled}>Save Profile</button>
                      <button className="btn secondary" onClick={() => setProfileModalOpen(false)}>Close</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {settingsOpen && (
            <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
              <div
                className="modal settings-modal"
                ref={settingsRef}
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header sticky">
                  <div>
                    <h3>Account Settings</h3>
                    <div className="note">Update your profile, preferences, and notification options.</div>
                  </div>
                  <button type="button" className="modal-close" onClick={() => setSettingsOpen(false)}>Close</button>
                </div>
                <div className="modal-body">
                  <div className="settings-section">
                    <h4>Profile Info</h4>
                    <label>Name</label>
                    <input
                      value={settingsData.name}
                      onChange={(e) => setSettingsData({ ...settingsData, name: normalizeNameInput(e.target.value) })}
                      onBlur={(e) => setSettingsData({ ...settingsData, name: trimName(e.target.value) })}
                      className={profileNameInvalid ? "input-error" : ""}
                    />
                    {profileNameInvalid && <div className="input-error-text">{nameErrorMessage}</div>}
                    <label>Email</label>
                    <input
                      value={settingsData.email}
                      onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
                    />
                    <label>Avatar URL</label>
                    <input
                      value={settingsData.avatarUrl}
                      onChange={(e) => setSettingsData({ ...settingsData, avatarUrl: e.target.value })}
                    />
                  </div>
                  <div className="settings-section">
                    <h4>Contact Info</h4>
                    <label>Phone</label>
                    <div className="phone-row">
                      <select
                        className="phone-code"
                        value={settingsData.phoneCountryCode}
                        onChange={(e) => setSettingsData({ ...settingsData, phoneCountryCode: e.target.value })}
                      >
                        {countryCodes.map((item) => (
                          <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                      </select>
                      <input
                        value={settingsData.phoneNumber}
                        onChange={(e) => setSettingsData({
                          ...settingsData,
                          phoneNumber: normalizePhoneInput(e.target.value),
                        })}
                        className={`phone-input ${profilePhoneInvalid ? "input-error" : ""}`}
                      />
                    </div>
                    {profilePhoneInvalid && <div className="input-error-text">{phoneErrorMessage}</div>}
                    {role === "customer" && (
                      <>
                        <label>Company</label>
                        <input
                          value={settingsData.company}
                          onChange={(e) => setSettingsData({ ...settingsData, company: e.target.value })}
                        />
                      </>
                    )}
                  </div>
                  <div className="settings-section">
                    <h4>Preferences</h4>
                    <label>Theme</label>
                    <select
                      value={settingsData.preferences.theme || "light"}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        preferences: { ...settingsData.preferences, theme: e.target.value },
                      })}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                    <label>Language</label>
                    <select
                      value={settingsData.preferences.language || "en"}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        preferences: { ...settingsData.preferences, language: e.target.value },
                      })}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                  <div className="settings-section">
                    <h4>Notifications</h4>
                    <div className="toggle-grid">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settingsData.preferences.notifications?.tenderAssigned ?? true}
                          onChange={(e) => setSettingsData({
                            ...settingsData,
                            preferences: {
                              ...settingsData.preferences,
                              notifications: {
                                ...settingsData.preferences.notifications,
                                tenderAssigned: e.target.checked,
                              },
                            },
                          })}
                        />
                        <span>Tender assigned</span>
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settingsData.preferences.notifications?.quoteSubmitted ?? true}
                          onChange={(e) => setSettingsData({
                            ...settingsData,
                            preferences: {
                              ...settingsData.preferences,
                              notifications: {
                                ...settingsData.preferences.notifications,
                                quoteSubmitted: e.target.checked,
                              },
                            },
                          })}
                        />
                        <span>Quote submitted</span>
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settingsData.preferences.notifications?.ticketClosed ?? true}
                          onChange={(e) => setSettingsData({
                            ...settingsData,
                            preferences: {
                              ...settingsData.preferences,
                              notifications: {
                                ...settingsData.preferences.notifications,
                                ticketClosed: e.target.checked,
                              },
                            },
                          })}
                        />
                        <span>Ticket closed</span>
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settingsData.preferences.notifications?.systemAlerts ?? true}
                          onChange={(e) => setSettingsData({
                            ...settingsData,
                            preferences: {
                              ...settingsData.preferences,
                              notifications: {
                                ...settingsData.preferences.notifications,
                                systemAlerts: e.target.checked,
                              },
                            },
                          })}
                        />
                        <span>System alerts</span>
                      </label>
                    </div>
                  </div>
                  {settingsError && <div className="note">{settingsError}</div>}
                </div>
                <div className="modal-footer sticky">
                  <button className="btn" onClick={saveSettings} disabled={isSettingsSaveDisabled}>
                    {settingsSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="btn secondary" onClick={() => setSettingsOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {passwordOpen && (
            <div className="modal-overlay" onClick={() => setPasswordOpen(false)}>
              <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <h3>Change Password</h3>
                  <button type="button" className="modal-close" onClick={() => setPasswordOpen(false)}>Close</button>
                </div>
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
                {passwordError && <div className="note">{passwordError}</div>}
                <div className="flex">
                  <button className="btn" onClick={updatePassword}>Update Password</button>
                  <button className="btn secondary" onClick={() => setPasswordOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {notificationsOpen && (
            <div className="modal-overlay" onClick={() => setNotificationsOpen(false)}>
              <div className="modal profile-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <h3>Notifications</h3>
                  <button type="button" className="modal-close" onClick={() => setNotificationsOpen(false)}>Close</button>
                </div>
                {notificationsLoading && <div className="note">Loading notifications...</div>}
                {!notificationsLoading && notifications.length === 0 && (
                  <div className="note">No notifications yet.</div>
                )}
                <div className="notification-list">
                  {notifications.map((item) => (
                    <div key={item._id} className={`notification-item ${item.read ? "" : "unread"}`}>
                      <div className="notification-title">{item.title}</div>
                      <div className="note">{item.message}</div>
                      <div className="notification-meta">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                        {!item.read && (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => markNotificationRead(item._id)}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex">
                  <button className="btn" onClick={markAllNotificationsRead}>Mark all read</button>
                  <button className="btn secondary" onClick={clearNotifications}>Clear all</button>
                </div>
              </div>
            </div>
          )}
          {closeModalTicket && (
            <div className="modal-overlay" onClick={() => setCloseModalTicket(null)}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <h3>Close Ticket {closeModalTicket.ticketId}</h3>
                <label>Booked on</label>
                <input
                  type="date"
                  value={closeForm.bookedOn}
                  onChange={(e) => setCloseForm({ ...closeForm, bookedOn: e.target.value })}
                />
                <label>Final rate</label>
                <input
                  inputMode="decimal"
                  value={closeForm.finalRate}
                  onChange={(e) => setCloseForm({ ...closeForm, finalRate: e.target.value.replace(/[^0-9.]/g, "") })}
                />
                <label>AWB number</label>
                <input
                  value={closeForm.awbNumber}
                  onChange={(e) => setCloseForm({ ...closeForm, awbNumber: e.target.value })}
                />
                <label>Screenshot URL (optional)</label>
                <input
                  value={closeForm.screenshotUrl}
                  onChange={(e) => setCloseForm({ ...closeForm, screenshotUrl: e.target.value })}
                />
                <label>Closing notes (optional)</label>
                <textarea
                  value={closeForm.closingNotes}
                  onChange={(e) => setCloseForm({ ...closeForm, closingNotes: e.target.value })}
                />
                {closeError && <div className="note">{closeError}</div>}
                <div className="flex">
                  <button className="btn" onClick={closeTicket}>Close ticket</button>
                  <button className="btn secondary" onClick={() => setCloseModalTicket(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
