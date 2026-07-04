"use client";

import { FormEvent, useState } from "react";
import { getApiBase } from "../apiBase";

const API_BASE = getApiBase();

const PRODUCTS = [
  { key: "cleanote_one_time_premium", label: "One-Time Premium ($0.99)" }
];

type RevenueRow = {
  amount: string;
  dba_name?: string;
  month?: string;
};

type ActiveSubscription = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  customer_email: string;
  status: string;
  dba_name: string;
  product_name: string;
  current_period_end: string;
};

type Customer = {
  customer_name: string;
  customer_email: string;
  stripe_customer_id: string;
  dba_name: string;
  total_amount: string;
  latest_payment_date: string;
};

type ScanSummary = {
  configured: boolean;
  available: boolean;
  total_scans: number;
  successful_scans: number;
  failed_scans: number;
  by_status: Array<{ status: string; count: number }>;
  by_subject: Array<{ subject: string; count: number }>;
};

type FeedbackRow = {
  email: string;
  name: string;
  role: string;
  created_at: string;
  rating: number;
  feedback: string;
  worked: string;
  missing: string;
  pay_value: string;
  note_filename: string;
  subject: string;
  word_count: number;
};

type FeedbackSummary = {
  feedback_count: number;
  average_rating: number;
  recent_feedback: FeedbackRow[];
};

type BetaSignup = {
  email: string;
  name: string;
  role: string;
  status: string;
  beta_access: boolean;
  created_at: string;
  verified_at: string;
  last_requested_at: string;
  last_feedback_at: string;
  followup_status: string;
  auto_reply_status: string;
  tablet_bundle_status: string;
  app_link: string;
  premium_link: string;
  manual_email_subject: string;
  manual_email_body: string;
};

type BetaSummary = {
  available?: boolean;
  error?: string;
  signup_count: number;
  beta_access_count: number;
  manual_required_count: number;
  emailed_count: number;
  recent_signups: BetaSignup[];
};

type TabletPreorder = {
  created_at: string;
  email: string;
  name: string;
  role: string;
  quantity: number;
  use_case: string;
  status: string;
  product: string;
};

type TabletPreorderSummary = {
  available?: boolean;
  error?: string;
  preorder_count: number;
  total_quantity: number;
  recent_preorders: TabletPreorder[];
};

type RevenueSummary = {
  total_revenue: string;
  revenue_by_dba: RevenueRow[];
  revenue_by_month: RevenueRow[];
  active_subscriptions: ActiveSubscription[];
  active_subscription_count: number;
  customers: Customer[];
  scan_summary?: ScanSummary;
  feedback_summary?: FeedbackSummary;
  beta_summary?: BetaSummary;
  tablet_preorder_summary?: TabletPreorderSummary;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [paymentLinkProduct, setPaymentLinkProduct] = useState(PRODUCTS[0].key);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);

  async function loadDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/admin/revenue`, {
        headers: { "X-Admin-Token": token }
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not load admin dashboard.");
      }
      setSummary(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load admin dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createPaymentLink() {
    setIsCreatingPaymentLink(true);
    setMessage(null);
    setPaymentLinkUrl(null);

    try {
      const response = await fetch(`${API_BASE}/api/stripe/payment-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        body: JSON.stringify({ product_key: paymentLinkProduct })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not create payment link.");
      }
      setPaymentLinkUrl(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create payment link.");
    } finally {
      setIsCreatingPaymentLink(false);
    }
  }

  function downloadFeedbackCsv() {
    const rows = summary?.feedback_summary?.recent_feedback ?? [];
    if (!rows.length) {
      setMessage("No feedback yet.");
      return;
    }

    const header = [
      "created_at",
      "rating",
      "email",
      "name",
      "role",
      "subject",
      "note_filename",
      "feedback",
      "worked",
      "missing",
      "pay_value"
    ];
    const csvRows = [
      header,
      ...rows.map((row) => [
        row.created_at,
        String(row.rating),
        row.email,
        row.name,
        row.role,
        row.subject,
        row.note_filename,
        row.feedback,
        row.worked,
        row.missing,
        row.pay_value
      ])
    ];
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cleanote-feedback.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadBetaCsv() {
    const rows = summary?.beta_summary?.recent_signups ?? [];
    if (!rows.length) {
      setMessage("No beta signups yet.");
      return;
    }

    const header = [
      "created_at",
      "email",
      "name",
      "role",
      "status",
      "beta_access",
      "followup_status",
      "auto_reply_status",
      "tablet_bundle_status",
      "app_link",
      "premium_link",
      "manual_email_subject",
      "manual_email_body"
    ];
    const csvRows = [
      header,
      ...rows.map((row) => [
        row.created_at,
        row.email,
        row.name,
        row.role,
        row.status,
        row.beta_access ? "yes" : "no",
        row.followup_status,
        row.auto_reply_status,
        row.tablet_bundle_status,
        row.app_link,
        row.premium_link,
        row.manual_email_subject,
        row.manual_email_body
      ])
    ];
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cleanote-beta-signups.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadTabletPreorderCsv() {
    const rows = summary?.tablet_preorder_summary?.recent_preorders ?? [];
    if (!rows.length) {
      setMessage("No tablet preorder interest yet.");
      return;
    }

    const header = [
      "created_at",
      "email",
      "name",
      "role",
      "quantity",
      "status",
      "product",
      "use_case"
    ];
    const csvRows = [
      header,
      ...rows.map((row) => [
        row.created_at,
        row.email,
        row.name,
        row.role,
        String(row.quantity),
        row.status,
        row.product,
        row.use_case
      ])
    ];
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cleanote-tablet-preorders.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="eyebrow">Cleanote admin</p>
          <h1>Revenue dashboard</h1>
          <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
        </div>
        <form className="admin-token-form" onSubmit={loadDashboard}>
          <input
            onChange={(event) => setToken(event.target.value)}
            placeholder="Admin token"
            type="password"
            value={token}
          />
          <button className="primary" disabled={isLoading} type="submit">
            {isLoading ? "Loading" : "Load"}
          </button>
        </form>
      </section>

      {message ? <p className="message">{message}</p> : null}

      {summary ? (
        <section className="admin-grid">
          <div className="admin-card metric-card">
            <p className="eyebrow">Total revenue</p>
            <strong>${summary.total_revenue}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Active subscriptions</p>
            <strong>{summary.active_subscription_count}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Total scans</p>
            <strong>{summary.scan_summary?.total_scans ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Successful scans</p>
            <strong>{summary.scan_summary?.successful_scans ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Feedback responses</p>
            <strong>{summary.feedback_summary?.feedback_count ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Average rating</p>
            <strong>{summary.feedback_summary?.average_rating ?? 0}/5</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Beta signups</p>
            <strong>{summary.beta_summary?.signup_count ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Manual emails needed</p>
            <strong>{summary.beta_summary?.manual_required_count ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Tablet preorder leads</p>
            <strong>{summary.tablet_preorder_summary?.preorder_count ?? 0}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Tablet units requested</p>
            <strong>{summary.tablet_preorder_summary?.total_quantity ?? 0}</strong>
          </div>
          <div className="admin-card payment-link-card">
            <h2>Create Payment Link</h2>
            <select
              onChange={(event) => setPaymentLinkProduct(event.target.value)}
              value={paymentLinkProduct}
            >
              {PRODUCTS.map((product) => (
                <option key={product.key} value={product.key}>
                  {product.label}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={isCreatingPaymentLink}
              onClick={createPaymentLink}
              type="button"
            >
              {isCreatingPaymentLink ? "Creating" : "Create link"}
            </button>
            {paymentLinkUrl ? (
              <a href={paymentLinkUrl} rel="noreferrer" target="_blank">
                {paymentLinkUrl}
              </a>
            ) : null}
          </div>
          <div className="admin-card payment-link-card">
            <h2>Feedback Export</h2>
            <p className="message">Download recent ratings and customer discovery comments.</p>
            <button className="primary" onClick={downloadFeedbackCsv} type="button">
              Download CSV
            </button>
          </div>
          <div className="admin-card payment-link-card">
            <h2>Beta Signup Export</h2>
            {summary.beta_summary?.available === false ? (
              <p className="message">
                Beta list unavailable: {summary.beta_summary.error}. Add dynamodb:Scan on
                cleanote-beta to the backend task role.
              </p>
            ) : (
              <p className="message">
                Download beta leads with app link, Premium link, and manual email copy.
              </p>
            )}
            <button className="primary" onClick={downloadBetaCsv} type="button">
              Download beta CSV
            </button>
          </div>
          <div className="admin-card payment-link-card">
            <h2>Tablet Preorder Export</h2>
            {summary.tablet_preorder_summary?.available === false ? (
              <p className="message">
                Tablet preorder list unavailable: {summary.tablet_preorder_summary.error}. Check
                backend DynamoDB permissions for cleanote-beta.
              </p>
            ) : (
              <p className="message">
                Download early Cleanote+ tablet bundle preorder interest.
              </p>
            )}
            <button className="primary" onClick={downloadTabletPreorderCsv} type="button">
              Download preorder CSV
            </button>
          </div>

          <Table
            columns={["Name", "Email", "Role", "Qty", "Use case", "Status", "Date"]}
            rows={(summary.tablet_preorder_summary?.recent_preorders ?? []).map((row) => [
              row.name || "Unknown",
              row.email,
              row.role,
              String(row.quantity),
              row.use_case,
              row.status,
              row.created_at.slice(0, 10)
            ])}
            title="Tablet preorder interest"
          />
          <Table
            columns={["Name", "Email", "Role", "Access", "Email status", "Follow-up", "App link", "Premium"]}
            rows={(summary.beta_summary?.recent_signups ?? []).map((row) => [
              row.name || "Unknown",
              row.email,
              row.role,
              row.beta_access ? "yes" : "waitlist",
              row.auto_reply_status,
              row.followup_status,
              row.app_link,
              row.premium_link
            ])}
            title="Beta signup list"
          />
          <Table
            columns={["Rating", "Email", "Role", "Feedback", "Wrong or missing", "Pay value", "Date"]}
            rows={(summary.feedback_summary?.recent_feedback ?? []).map((row) => [
              row.rating ? `${row.rating}/5` : "-",
              row.email,
              row.role,
              row.feedback || row.worked,
              row.missing,
              row.pay_value,
              row.created_at.slice(0, 10)
            ])}
            title="Recent feedback"
          />
          <Table
            columns={["DBA", "Revenue"]}
            rows={summary.revenue_by_dba.map((row) => [row.dba_name ?? "", `$${row.amount}`])}
            title="Revenue by DBA"
          />
          <Table
            columns={["Month", "Revenue"]}
            rows={summary.revenue_by_month.map((row) => [row.month ?? "", `$${row.amount}`])}
            title="Revenue by month"
          />
          <Table
            columns={["Subject", "Scans"]}
            rows={(summary.scan_summary?.by_subject ?? []).map((row) => [
              row.subject,
              String(row.count)
            ])}
            title="Scans by subject"
          />
          <Table
            columns={["Status", "Scans"]}
            rows={(summary.scan_summary?.by_status ?? []).map((row) => [
              row.status,
              String(row.count)
            ])}
            title="Scans by status"
          />
          <Table
            columns={["Customer", "Email", "Total", "Latest payment"]}
            rows={summary.customers.map((customer) => [
              customer.customer_name || "Unknown",
              customer.customer_email,
              `$${customer.total_amount}`,
              customer.latest_payment_date.slice(0, 10)
            ])}
            title="Customer list"
          />
          <Table
            columns={["Product", "Email", "Status", "Current period end"]}
            rows={summary.active_subscriptions.map((subscription) => [
              subscription.product_name,
              subscription.customer_email || subscription.stripe_customer_id,
              subscription.status,
              subscription.current_period_end.slice(0, 10)
            ])}
            title="Active subscriptions"
          />
        </section>
      ) : null}
    </main>
  );
}

function Table({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <div className="admin-card table-card">
      <h2>{title}</h2>
      <div className="admin-table">
        <div className="admin-table-row admin-table-head">
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {rows.length ? (
          rows.map((row, index) => (
            <div className="admin-table-row" key={`${title}-${index}`}>
              {row.map((cell, cellIndex) => (
                <span key={`${title}-${index}-${cellIndex}`} title={cell}>{cell}</span>
              ))}
            </div>
          ))
        ) : (
          <p className="message">No data yet.</p>
        )}
      </div>
    </div>
  );
}
